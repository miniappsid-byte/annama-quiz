/**
 * AN-NAMA QUIZ - LiveQuiz.js
 * Controller untuk Laptop Live Quiz:
 * - Inisialisasi sesi live quiz & kode kuis unik (misal: ANM4827)
 * - Navigasi soal (Prev/Next/Go to Soal)
 * - Status siswa yang sudah menjawab (polling real-time)
 * - Kontrol buka/tutup penerimaan jawaban
 */

/**
 * Memulai sesi Live Quiz dari kuis yang sudah dibuat guru
 */
function startLiveQuizSession(token, quizId) {
  try {
    const guru = assertGuru(token);
    const ss = getDb();
    const kuisSheet = getSheetSafe(CONFIG.SHEETS.KUIS);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuisIdx = semuaKuis.findIndex(k => k.quiz_id === quizId && k.guru_id === guru.guruId);

    if (kuisIdx === -1) {
      return createResponse(false, "Kuis tidak ditemukan atau bukan milik Anda.");
    }

    const kuis = semuaKuis[kuisIdx];
    const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    const soalList = semuaSoal
      .filter(s => s.quiz_id === quizId)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));

    if (soalList.length === 0) {
      return createResponse(false, "Kuis ini belum memiliki butir soal! Tambahkan soal terlebih dahulu.");
    }

    // Ambil daftar siswa dari kelas terkait untuk perhitungan progress
    const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const siswaKelas = semuaSiswa.filter(s => s.kelas_id === kuis.kelas_id && s.status === CONFIG.STATUS.ACTIVE);

    // Ambil nama mapel dan kelas
    const semuaKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    const semuaMapel = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);
    const kelasObj = semuaKelas.find(k => k.kelas_id === kuis.kelas_id);
    const mapelObj = semuaMapel.find(m => m.mapel_id === kuis.mapel_id);

    // Generate kode kuis unik 6-7 karakter, contoh: ANM4827
    const randomCode = "ANM" + Math.floor(1000 + Math.random() * 9000);
    const sessionId = "SES-LIVE-" + Utilities.getUuid().substring(0, 8);
    const now = new Date().toISOString();

    // Update status kuis di sheet KUIS menjadi AKTIF
    const row = kuisIdx + 2;
    kuisSheet.getRange(row, 10).setValue("AKTIF");
    if (!kuis.started_at) {
      kuisSheet.getRange(row, 11).setValue(now);
    }

    // Inisialisasi state sesi live di CacheService (berlaku 12 jam)
    const liveSessionData = {
      sessionId: sessionId,
      quizCode: randomCode,
      quizId: quizId,
      judul: kuis.judul,
      namaKelas: kelasObj ? kelasObj.nama_kelas : kuis.kelas_id,
      namaMapel: mapelObj ? mapelObj.nama_mapel : kuis.mapel_id,
      kelasId: kuis.kelas_id,
      durasi: Number(kuis.durasi) || 30,
      currentQuestionIndex: 0,
      isAcceptingAnswers: true,
      totalSiswaKelas: siswaKelas.length,
      startedAt: now
    };

    const cache = CacheService.getScriptCache();
    cache.put("LIVE_QUIZ_" + quizId, JSON.stringify(liveSessionData), 43200);
    cache.put("LIVE_CODE_" + randomCode, quizId, 43200);

    return createResponse(true, "Sesi Live Quiz berhasil dimulai!", {
      session: liveSessionData,
      soalList: soalList,
      totalSiswa: siswaKelas.length
    });

  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Polling status live kuis untuk tampilan laptop:
 * - Menghitung jumlah siswa yang sudah scan/menjawab soal aktif saat ini
 * - Status apakah jawaban masih diterima
 */
function getLiveQuizStatus(quizId, questionId) {
  try {
    if (!quizId || !questionId) {
      return createResponse(false, "quizId dan questionId diperlukan");
    }

    const cache = CacheService.getScriptCache();
    const sessionRaw = cache.get("LIVE_QUIZ_" + quizId);
    let session = sessionRaw ? JSON.parse(sessionRaw) : null;

    // Hitung jawaban yang sudah masuk untuk soal ini dari sheet JAWABAN
    const semuaJawaban = getSheetDataAsObjects(CONFIG.SHEETS.JAWABAN);
    const jawabanSoalIni = semuaJawaban.filter(j => j.quiz_id === quizId && j.question_id === questionId);

    // Ambil list student_id yang sudah menjawab untuk cegah duplikasi dan list siswa
    const answeredStudentIds = jawabanSoalIni.map(j => j.student_id);

    // Ambil data live ranking
    const leaderboardResp = getLiveRanking(quizId);
    const leaderboard = leaderboardResp.success ? leaderboardResp.data : [];

    return createResponse(true, "Status live kuis berhasil diambil", {
      session: session,
      jumlahMenjawab: answeredStudentIds.length,
      totalSiswa: session ? session.totalSiswaKelas : 0,
      answeredStudentIds: answeredStudentIds,
      leaderboard: leaderboard
    });
  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Guru mengubah nomor soal (Next / Prev / Jump)
 */
function updateLiveQuestionIndex(token, quizId, newIndex) {
  try {
    assertGuru(token);
    const cache = CacheService.getScriptCache();
    const sessionRaw = cache.get("LIVE_QUIZ_" + quizId);
    if (!sessionRaw) return createResponse(false, "Sesi kuis tidak aktif.");

    let session = JSON.parse(sessionRaw);
    session.currentQuestionIndex = Number(newIndex);
    session.isAcceptingAnswers = true;

    cache.put("LIVE_QUIZ_" + quizId, JSON.stringify(session), 43200);

    return createResponse(true, "Nomor soal berhasil diubah", session);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Guru mengakhiri sesi Live Quiz dan menyimpan rekap hasil ke sheet HASIL
 */
function finishLiveQuizSession(token, quizId) {
  try {
    const guru = assertGuru(token);
    const kuisSheet = getSheetSafe(CONFIG.SHEETS.KUIS);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuisIdx = semuaKuis.findIndex(k => k.quiz_id === quizId && k.guru_id === guru.guruId);

    if (kuisIdx !== -1) {
      const row = kuisIdx + 2;
      const now = new Date().toISOString();
      kuisSheet.getRange(row, 10).setValue("SELESAI");
      kuisSheet.getRange(row, 12).setValue(now);
    }

    // Rekap dan simpan ke sheet HASIL
    finalizeAndSaveQuizResults(quizId);

    const cache = CacheService.getScriptCache();
    cache.remove("LIVE_QUIZ_" + quizId);

    return createResponse(true, "Kuis berhasil diakhiri dan hasil telah disimpan!");
  } catch (e) {
    return createResponse(false, e.message);
  }
}
