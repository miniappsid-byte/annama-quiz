/**
 * AN-NAMA QUIZ - Analysis.js
 * Modul Analisis Hasil & Statistik Kuis:
 * - Analisis untuk Guru: Nilai per Siswa, Persentase Benar/Salah, Butir Soal Tersulit & Termudah
 * - Analisis untuk Admin: Rekap seluruh kuis dari semua guru, Filter Kelas/Mapel/Tahun, Rata-rata kelas, Ketuntasan
 */

/**
 * Guru mengambil analisis mendalam dari satu kuis miliknya
 * @param {string} token
 * @param {string} quizId
 */
function getQuizAnalysisGuru(token, quizId) {
  try {
    const guru = assertGuru(token);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuis = semuaKuis.find(k => k.quiz_id === quizId && k.guru_id === guru.guruId);

    if (!kuis) {
      return createResponse(false, "Kuis tidak ditemukan atau bukan milik Anda.");
    }

    return generateDetailedQuizAnalysis(quizId, kuis);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Admin mengambil seluruh rekap hasil kuis dengan filter
 * @param {string} token
 * @param {Object} filters { tahun_id, kelas_id, mapel_id }
 */
function getAllQuizResultsAdmin(token, filters = {}) {
  try {
    assertAdmin(token);
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const semuaHasil = getSheetDataAsObjects(CONFIG.SHEETS.HASIL);
    const semuaGuru = getSheetDataAsObjects(CONFIG.SHEETS.GURU);
    const semuaKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    const semuaMapel = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);
    const semuaTahun = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);

    const guruMap = {}; semuaGuru.forEach(g => guruMap[g.guru_id] = g.nama);
    const kelasMap = {}; semuaKelas.forEach(k => kelasMap[k.kelas_id] = k.nama_kelas);
    const mapelMap = {}; semuaMapel.forEach(m => mapelMap[m.mapel_id] = m.nama_mapel);
    const tahunMap = {}; semuaTahun.forEach(t => tahunMap[t.tahun_id] = t.nama_tahun);

    // Filter kuis yang statusnya SELESAI atau memiliki hasil
    let filteredKuis = semuaKuis.filter(k => k.status === "SELESAI" || semuaHasil.some(h => h.quiz_id === k.quiz_id));

    if (filters.tahun_id) filteredKuis = filteredKuis.filter(k => k.tahun_id === filters.tahun_id);
    if (filters.kelas_id) filteredKuis = filteredKuis.filter(k => k.kelas_id === filters.kelas_id);
    if (filters.mapel_id) filteredKuis = filteredKuis.filter(k => k.mapel_id === filters.mapel_id);

    // Susun rekapitulasi statistik per kuis
    const rekapList = filteredKuis.map(k => {
      const hasilKuis = semuaHasil.filter(h => h.quiz_id === k.quiz_id);
      const totalPeserta = hasilKuis.length;

      let totalNilai = 0;
      let nilaiTertinggi = 0;
      let nilaiTerendah = totalPeserta > 0 ? 999999 : 0;
      let jumlahTuntas = 0; // KKM asumsi >= 70% benar

      hasilKuis.forEach(h => {
        const skor = Number(h.total_skor) || 0;
        const jmlBenar = Number(h.jumlah_benar) || 0;
        const jmlSoal = Number(h.jumlah_soal) || 1;
        const persentase = (jmlBenar / jmlSoal) * 100;

        totalNilai += skor;
        if (skor > nilaiTertinggi) nilaiTertinggi = skor;
        if (skor < nilaiTerendah) nilaiTerendah = skor;
        if (persentase >= 70) jumlahTuntas++;
      });

      if (totalPeserta === 0) nilaiTerendah = 0;

      const rataRataNilai = totalPeserta > 0 ? Math.round(totalNilai / totalPeserta) : 0;
      const persentaseKetuntasan = totalPeserta > 0 ? Math.round((jumlahTuntas / totalPeserta) * 100) : 0;

      return {
        quiz_id: k.quiz_id,
        judul: k.judul,
        nama_guru: guruMap[k.guru_id] || k.guru_id,
        nama_kelas: kelasMap[k.kelas_id] || k.kelas_id,
        nama_mapel: mapelMap[k.mapel_id] || k.mapel_id,
        tahun_pelajaran: tahunMap[k.tahun_id] || k.tahun_id || "-",
        finished_at: k.finished_at || k.created_at,
        total_peserta: totalPeserta,
        rata_rata_nilai: rataRataNilai,
        nilai_tertinggi: nilaiTertinggi,
        nilai_terendah: nilaiTerendah,
        persentase_ketuntasan: persentaseKetuntasan
      };
    });

    return createResponse(true, "Data rekapitulasi admin berhasil diambil", {
      rekapList: rekapList,
      masterFilter: {
        kelas: semuaKelas,
        mapel: semuaMapel,
        tahun: semuaTahun
      }
    });

  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Generator analisis butir soal dan peringkat detail untuk satu kuis
 */
function generateDetailedQuizAnalysis(quizId, kuis) {
  const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL).filter(s => s.quiz_id === quizId);
  const semuaJawaban = getSheetDataAsObjects(CONFIG.SHEETS.JAWABAN).filter(j => j.quiz_id === quizId);
  const semuaHasil = getSheetDataAsObjects(CONFIG.SHEETS.HASIL).filter(h => h.quiz_id === quizId);
  const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);

  const siswaMap = {};
  semuaSiswa.forEach(s => siswaMap[s.student_id] = { nama: s.nama, nis: s.nis || "-" });

  // 1. Analisis Butir Soal (Item Difficulty Analysis)
  const itemAnalysis = semuaSoal.map(soal => {
    const jawabanSoal = semuaJawaban.filter(j => j.question_id === soal.question_id);
    const totalMenjawab = jawabanSoal.length;
    let benar = 0;
    let salah = 0;
    const distribusiOpsi = { A: 0, B: 0, C: 0, D: 0 };

    jawabanSoal.forEach(j => {
      const ans = String(j.jawaban).toUpperCase();
      if (distribusiOpsi[ans] !== undefined) distribusiOpsi[ans]++;
      if (String(j.benar).toUpperCase() === "BENAR") benar++;
      else salah++;
    });

    const persentaseBenar = totalMenjawab > 0 ? Math.round((benar / totalMenjawab) * 100) : 0;
    
    // Klasifikasi tingkat kesulitan
    let kategori = "Sedang";
    if (persentaseBenar >= 75) kategori = "Mudah";
    else if (persentaseBenar < 40) kategori = "Sulit";

    return {
      question_id: soal.question_id,
      nomor: Number(soal.nomor),
      pertanyaan: soal.pertanyaan,
      jawaban_benar: soal.jawaban_benar,
      total_menjawab: totalMenjawab,
      jumlah_benar: benar,
      jumlah_salah: salah,
      persentase_benar: persentaseBenar,
      kategori: kategori,
      distribusi: distribusiOpsi
    };
  });

  // Urutkan soal dari yang paling sulit ke paling mudah
  const soalTersulit = [...itemAnalysis].sort((a, b) => a.persentase_benar - b.persentase_benar)[0] || null;
  const soalTermudah = [...itemAnalysis].sort((a, b) => b.persentase_benar - a.persentase_benar)[0] || null;

  // 2. Daftar Hasil Seluruh Santri Berdasarkan Ranking
  const hasilSantri = semuaHasil.map(h => ({
    student_id: h.student_id,
    nama: siswaMap[h.student_id] ? siswaMap[h.student_id].nama : h.student_id,
    nis: siswaMap[h.student_id] ? siswaMap[h.student_id].nis : "-",
    ranking: Number(h.ranking) || 0,
    total_skor: Number(h.total_skor) || 0,
    jumlah_benar: Number(h.jumlah_benar) || 0,
    jumlah_salah: Number(h.jumlah_salah) || 0,
    jumlah_soal: Number(h.jumlah_soal) || 0,
    persentase_nilai: h.jumlah_soal > 0 ? Math.round((h.jumlah_benar / h.jumlah_soal) * 100) : 0,
    rata_rata_waktu: Number(h.rata_rata_waktu) || 0
  })).sort((a, b) => a.ranking - b.ranking);

  // 3. Ringkasan Keseluruhan Kelas
  const totalPeserta = hasilSantri.length;
  let totalSkorSemua = 0;
  let totalBenarSemua = 0;
  let tuntasCount = 0;

  hasilSantri.forEach(s => {
    totalSkorSemua += s.total_skor;
    totalBenarSemua += s.jumlah_benar;
    if (s.persentase_nilai >= 70) tuntasCount++;
  });

  const rataRataSkor = totalPeserta > 0 ? Math.round(totalSkorSemua / totalPeserta) : 0;
  const persentaseKetuntasan = totalPeserta > 0 ? Math.round((tuntasCount / totalPeserta) * 100) : 0;

  return createResponse(true, "Analisis kuis berhasil dibuat", {
    kuis: kuis,
    summary: {
      totalPeserta: totalPeserta,
      rataRataSkor: rataRataSkor,
      persentaseKetuntasan: persentaseKetuntasan,
      soalTersulit: soalTersulit,
      soalTermudah: soalTermudah
    },
    itemAnalysis: itemAnalysis,
    hasilSantri: hasilSantri
  });
}
