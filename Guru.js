/**
 * AN-NAMA QUIZ - Guru.js
 * Modul Pengelolaan Kuis & Butir Soal untuk Guru
 */

// Helper validasi hak akses Guru
function assertGuru(token) {
  const sessionResp = validateSession(token);
  if (!sessionResp.success) {
    throw new Error("Sesi tidak valid atau telah berakhir.");
  }
  if (sessionResp.data.role !== CONFIG.ROLES.GURU) {
    throw new Error("Akses ditolak: Hanya Guru yang diperbolehkan.");
  }
  return sessionResp.data; // { userId, username, nama, role, guruId, token }
}

/**
 * Mengambil ringkasan statistik dan referensi form (kelas, mapel, tahun)
 */
function getGuruInitData(token) {
  try {
    const guru = assertGuru(token);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuisGuru = semuaKuis.filter(k => k.guru_id === guru.guruId);

    const semuaKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS).filter(k => k.status === CONFIG.STATUS.ACTIVE);
    const semuaMapel = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL).filter(m => m.status === CONFIG.STATUS.ACTIVE);
    const semuaTahun = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN).filter(t => t.status === CONFIG.STATUS.ACTIVE);

    const totalKuis = kuisGuru.length;
    const kuisAktif = kuisGuru.filter(k => k.status === "AKTIF" || k.status === "BERJALAN").length;

    return createResponse(true, "Data init guru berhasil diambil", {
      stats: {
        totalKuis: totalKuis,
        kuisAktif: kuisAktif,
        totalPeserta: 0,
        rataRataNilai: "-"
      },
      referensi: {
        kelas: semuaKelas,
        mapel: semuaMapel,
        tahun: semuaTahun
      }
    });
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 1. MANAJEMEN KUIS (QUIZ)
// ==========================================

function getKuisGuruList(token) {
  try {
    const guru = assertGuru(token);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuisGuru = semuaKuis.filter(k => k.guru_id === guru.guruId);

    const semuaKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    const semuaMapel = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);
    const kelasMap = {};
    const mapelMap = {};
    semuaKelas.forEach(k => kelasMap[k.kelas_id] = k.nama_kelas);
    semuaMapel.forEach(m => mapelMap[m.mapel_id] = m.nama_mapel);

    const list = kuisGuru.map(k => ({
      ...k,
      nama_kelas: kelasMap[k.kelas_id] || k.kelas_id,
      nama_mapel: mapelMap[k.mapel_id] || k.mapel_id
    }));

    return createResponse(true, "Daftar kuis berhasil diambil", list);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveKuisGuru(token, kuisData) {
  try {
    const guru = assertGuru(token);
    if (!kuisData || !kuisData.judul || !kuisData.mapel_id || !kuisData.kelas_id) {
      return createResponse(false, "Judul, Mapel, dan Kelas wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.KUIS);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);

    if (kuisData.quiz_id) {
      // Edit Kuis
      const idx = existing.findIndex(k => k.quiz_id === kuisData.quiz_id && k.guru_id === guru.guruId);
      if (idx === -1) return createResponse(false, "Kuis tidak ditemukan atau bukan milik Anda.");

      const row = idx + 2;
      sheet.getRange(row, 3).setValue(kuisData.kelas_id);
      sheet.getRange(row, 4).setValue(kuisData.mapel_id);
      sheet.getRange(row, 5).setValue(kuisData.tahun_id || "");
      sheet.getRange(row, 6).setValue(kuisData.judul.trim());
      sheet.getRange(row, 7).setValue(kuisData.deskripsi || "");
      sheet.getRange(row, 9).setValue(Number(kuisData.durasi) || 30); // default 30 detik per soal

      return createResponse(true, "Kuis berhasil diperbarui.");
    } else {
      // Buat Kuis Baru
      const quizId = "QZ-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      const now = new Date().toISOString();

      sheet.appendRow([
        quizId,
        guru.guruId,
        kuisData.kelas_id,
        kuisData.mapel_id,
        kuisData.tahun_id || "",
        kuisData.judul.trim(),
        kuisData.deskripsi || "",
        0, // jumlah_soal awal
        Number(kuisData.durasi) || 30, // durasi per soal (detik)
        "DRAFT", // status: DRAFT, AKTIF, SELESAI
        "",
        "",
        now
      ]);

      return createResponse(true, "Kuis baru berhasil dibuat!", { quiz_id: quizId });
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function deleteKuisGuru(token, quizId) {
  try {
    const guru = assertGuru(token);
    const ss = getDb();
    const kuisSheet = getSheetSafe(CONFIG.SHEETS.KUIS);
    const soalSheet = getSheetSafe(CONFIG.SHEETS.SOAL);

    const existingKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const idx = existingKuis.findIndex(k => k.quiz_id === quizId && k.guru_id === guru.guruId);
    if (idx === -1) return createResponse(false, "Kuis tidak ditemukan.");

    // Hapus baris kuis
    kuisSheet.deleteRow(idx + 2);

    // Hapus seluruh soal yang terhubung ke kuis ini (dari bawah ke atas agar index baris tidak bergeser)
    const existingSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    for (let i = existingSoal.length - 1; i >= 0; i--) {
      if (existingSoal[i].quiz_id === quizId) {
        soalSheet.deleteRow(i + 2);
      }
    }

    return createResponse(true, "Kuis dan seluruh butir soalnya berhasil dihapus.");
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 2. MANAJEMEN BUTIR SOAL (QUESTIONS)
// ==========================================

function getSoalListByQuiz(token, quizId) {
  try {
    const guru = assertGuru(token);
    // Verifikasi kepemilikan kuis
    const existingKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuis = existingKuis.find(k => k.quiz_id === quizId && k.guru_id === guru.guruId);
    if (!kuis) return createResponse(false, "Kuis tidak valid.");

    const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    const soalList = semuaSoal
      .filter(s => s.quiz_id === quizId)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));

    return createResponse(true, "Soal berhasil diambil", {
      kuis: kuis,
      soal: soalList
    });
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveSoalGuru(token, soalData) {
  try {
    const guru = assertGuru(token);
    if (!soalData || !soalData.quiz_id || !soalData.pertanyaan || !soalData.jawaban_benar) {
      return createResponse(false, "Pertanyaan dan Kunci Jawaban benar (A/B/C/D) wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.SOAL);
    const kuisSheet = getSheetSafe(CONFIG.SHEETS.KUIS);
    const existingSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);

    if (soalData.question_id) {
      // Edit Soal
      const idx = existingSoal.findIndex(s => s.question_id === soalData.question_id && s.guru_id === guru.guruId);
      if (idx === -1) return createResponse(false, "Soal tidak ditemukan.");

      const row = idx + 2;
      sheet.getRange(row, 4).setValue(Number(soalData.nomor) || 1);
      sheet.getRange(row, 5).setValue(soalData.pertanyaan.trim());
      sheet.getRange(row, 6).setValue(soalData.opsi_a ? soalData.opsi_a.trim() : "");
      sheet.getRange(row, 7).setValue(soalData.opsi_b ? soalData.opsi_b.trim() : "");
      sheet.getRange(row, 8).setValue(soalData.opsi_c ? soalData.opsi_c.trim() : "");
      sheet.getRange(row, 9).setValue(soalData.opsi_d ? soalData.opsi_d.trim() : "");
      sheet.getRange(row, 10).setValue(String(soalData.jawaban_benar).toUpperCase().trim());
      sheet.getRange(row, 11).setValue(Number(soalData.poin) || 100);

      return createResponse(true, "Soal berhasil diperbarui.");
    } else {
      // Tambah Soal Baru
      const questionId = "QST-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      const nomorUrut = existingSoal.filter(s => s.quiz_id === soalData.quiz_id).length + 1;

      sheet.appendRow([
        questionId,
        guru.guruId,
        soalData.quiz_id,
        Number(soalData.nomor) || nomorUrut,
        soalData.pertanyaan.trim(),
        soalData.opsi_a ? soalData.opsi_a.trim() : "",
        soalData.opsi_b ? soalData.opsi_b.trim() : "",
        soalData.opsi_c ? soalData.opsi_c.trim() : "",
        soalData.opsi_d ? soalData.opsi_d.trim() : "",
        String(soalData.jawaban_benar).toUpperCase().trim(),
        Number(soalData.poin) || 100,
        CONFIG.STATUS.ACTIVE
      ]);

      // Update jumlah_soal di tabel KUIS
      updateJumlahSoalKuis(soalData.quiz_id);

      return createResponse(true, "Soal berhasil ditambahkan.");
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function deleteSoalGuru(token, questionId) {
  try {
    const guru = assertGuru(token);
    const sheet = getSheetSafe(CONFIG.SHEETS.SOAL);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);

    const idx = existing.findIndex(s => s.question_id === questionId && s.guru_id === guru.guruId);
    if (idx === -1) return createResponse(false, "Soal tidak ditemukan.");

    const quizId = existing[idx].quiz_id;
    sheet.deleteRow(idx + 2);

    updateJumlahSoalKuis(quizId);

    return createResponse(true, "Soal berhasil dihapus.");
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function duplikatSoalGuru(token, questionId) {
  try {
    const guru = assertGuru(token);
    const sheet = getSheetSafe(CONFIG.SHEETS.SOAL);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);

    const target = existing.find(s => s.question_id === questionId && s.guru_id === guru.guruId);
    if (!target) return createResponse(false, "Soal tidak ditemukan.");

    const newQuestionId = "QST-" + Utilities.getUuid().substring(0, 6).toUpperCase();
    const countQuiz = existing.filter(s => s.quiz_id === target.quiz_id).length + 1;

    sheet.appendRow([
      newQuestionId,
      guru.guruId,
      target.quiz_id,
      countQuiz,
      target.pertanyaan + " (Salinan)",
      target.opsi_a,
      target.opsi_b,
      target.opsi_c,
      target.opsi_d,
      target.jawaban_benar,
      target.poin,
      CONFIG.STATUS.ACTIVE
    ]);

    updateJumlahSoalKuis(target.quiz_id);

    return createResponse(true, "Soal berhasil diduplikasi.");
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// Helper sinkronisasi jumlah soal pada tabel KUIS
function updateJumlahSoalKuis(quizId) {
  const kuisSheet = getSheetSafe(CONFIG.SHEETS.KUIS);
  const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
  const kuisIdx = semuaKuis.findIndex(k => k.quiz_id === quizId);
  if (kuisIdx !== -1) {
    const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    const count = semuaSoal.filter(s => s.quiz_id === quizId).length;
    kuisSheet.getRange(kuisIdx + 2, 8).setValue(count);
  }
}
