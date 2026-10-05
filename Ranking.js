/**
 * AN-NAMA QUIZ - Ranking.js
 * Modul Live Ranking & Perhitungan Skor Presisi:
 * - Aturan Skor: Jawaban Benar (100) + Bonus Kecepatan (maks 50) = Maks 150
 * - Jawaban Salah: 0 poin (tidak dapat bonus kecepatan)
 * - Live Leaderboard: Urut berdasarkan Total Skor -> Jumlah Benar -> Rata-rata Waktu Tercepat
 * - Simpan Hasil Kuis Akhir ke Sheet HASIL
 */

/**
 * Menghitung dan mengambil Live Ranking kuis saat ini
 * @param {string} quizId
 */
function getLiveRanking(quizId) {
  try {
    if (!quizId) return createResponse(false, "quizId diperlukan");

    // Ambil data jawaban untuk quizId ini
    const semuaJawaban = getSheetDataAsObjects(CONFIG.SHEETS.JAWABAN);
    const quizAnswers = semuaJawaban.filter(j => j.quiz_id === quizId);

    // Ambil master siswa untuk identitas nama
    const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const siswaMap = {};
    semuaSiswa.forEach(s => {
      siswaMap[s.student_id] = {
        nama: s.nama,
        nis: s.nis || "-",
        kelas_id: s.kelas_id
      };
    });

    // Agregasi per siswa
    const studentStats = {};

    quizAnswers.forEach(ans => {
      const sId = ans.student_id;
      if (!studentStats[sId]) {
        studentStats[sId] = {
          student_id: sId,
          nama: siswaMap[sId] ? siswaMap[sId].nama : sId,
          total_skor: 0,
          jumlah_benar: 0,
          jumlah_salah: 0,
          total_waktu: 0,
          jumlah_jawab: 0
        };
      }

      const skor = Number(ans.skor) || 0;
      const durasi = Number(ans.durasi_jawab) || 0;
      const isBenar = (String(ans.benar).toUpperCase() === "BENAR");

      studentStats[sId].total_skor += skor;
      studentStats[sId].total_waktu += durasi;
      studentStats[sId].jumlah_jawab += 1;

      if (isBenar) {
        studentStats[sId].jumlah_benar += 1;
      } else {
        studentStats[sId].jumlah_salah += 1;
      }
    });

    // Ubah ke array dan hitung rata-rata waktu
    const rankingArray = Object.values(studentStats).map(s => {
      const avgTime = s.jumlah_jawab > 0 ? (s.total_waktu / s.jumlah_jawab) : 0;
      return {
        ...s,
        rata_rata_waktu: Number(avgTime.toFixed(1))
      };
    });

    // Sort prioritas ranking:
    // 1. Total Skor tertinggi
    // 2. Jumlah Benar terbanyak
    // 3. Rata-rata waktu tercepat (nilai lebih kecil lebih baik)
    rankingArray.sort((a, b) => {
      if (b.total_skor !== a.total_skor) {
        return b.total_skor - a.total_skor;
      }
      if (b.jumlah_benar !== a.jumlah_benar) {
        return b.jumlah_benar - a.jumlah_benar;
      }
      return a.rata_rata_waktu - b.rata_rata_waktu;
    });

    // Tambahkan nomor ranking
    const finalLeaderboard = rankingArray.map((item, index) => ({
      ranking: index + 1,
      ...item
    }));

    return createResponse(true, "Live ranking berhasil diambil", finalLeaderboard);

  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Menyimpan akumulasi seluruh hasil kuis ke Sheet HASIL ketika kuis selesai
 */
function finalizeAndSaveQuizResults(quizId) {
  try {
    const leaderboardResp = getLiveRanking(quizId);
    if (!leaderboardResp.success) return leaderboardResp;

    const leaderboard = leaderboardResp.data;
    if (leaderboard.length === 0) return createResponse(true, "Tidak ada data jawaban untuk disimpan.");

    const hasilSheet = getSheetSafe(CONFIG.SHEETS.HASIL);
    const existingHasil = getSheetDataAsObjects(CONFIG.SHEETS.HASIL);

    // Hapus data hasil lama untuk quizId ini jika sudah pernah difinalisasi (cegah duplikasi)
    for (let i = existingHasil.length - 1; i >= 0; i--) {
      if (existingHasil[i].quiz_id === quizId) {
        hasilSheet.deleteRow(i + 2);
      }
    }

    // Ambil info jumlah soal kuis
    const semuaKuis = getSheetDataAsObjects(CONFIG.SHEETS.KUIS);
    const kuis = semuaKuis.find(k => k.quiz_id === quizId);
    const totalSoal = kuis ? Number(kuis.jumlah_soal) || 0 : 0;
    const now = new Date().toISOString();

    // Masukkan data ranking final ke Sheet HASIL
    leaderboard.forEach(item => {
      const resultId = "RES-" + Utilities.getUuid().substring(0, 8);
      hasilSheet.appendRow([
        resultId,
        quizId,
        item.student_id,
        item.jumlah_benar,
        item.jumlah_salah,
        totalSoal,
        item.total_skor,
        item.rata_rata_waktu,
        item.ranking,
        now
      ]);
    });

    return createResponse(true, "Hasil kuis dan peringkat final berhasil disimpan ke database!");

  } catch (e) {
    return createResponse(false, e.message);
  }
}
