/**
 * AN-NAMA QUIZ - Scanner.js
 * Modul Backend Pemrosesan Scan HP Guru:
 * - Verifikasi Kode Sesi Kuis Aktif (misal ANM4827)
 * - Validasi Token Siswa & Deteksi Orientasi Kartu (A / B / C / D)
 * - Pengecekan Duplikat Jawaban per Siswa per Soal
 * - Perhitungan Poin & Bonus Kecepatan (V1.7 Preview)
 * - Penyimpanan Jawaban ke Sheet JAWABAN
 */

/**
 * Guru di HP memasukkan kode kuis (misal ANM4827) untuk menghubungkan kamera ke kuis aktif
 */
function connectScannerSession(token, quizCode) {
  try {
    const guru = assertGuru(token);
    if (!quizCode) return createResponse(false, "Kode kuis wajib diisi.");

    const cleanCode = String(quizCode).trim().toUpperCase();
    const cache = CacheService.getScriptCache();
    const quizId = cache.get("LIVE_CODE_" + cleanCode);

    if (!quizId) {
      return createResponse(false, "Kode kuis '" + cleanCode + "' tidak ditemukan atau kuis belum dimulai di laptop.");
    }

    const sessionRaw = cache.get("LIVE_QUIZ_" + quizId);
    if (!sessionRaw) {
      return createResponse(false, "Sesi kuis tidak aktif.");
    }

    const session = JSON.parse(sessionRaw);

    // Ambil soal aktif saat ini
    const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    const soalList = semuaSoal
      .filter(s => s.quiz_id === quizId)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));

    const currentSoal = soalList[session.currentQuestionIndex || 0];

    return createResponse(true, "Scanner berhasil terhubung ke Live Quiz!", {
      session: session,
      currentSoal: currentSoal,
      totalSoal: soalList.length
    });

  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * HP Guru memproses hasil scan QR kartu siswa:
 * @param {string} token - Token sesi guru
 * @param {string} quizCode - Kode kuis
 * @param {string} rawQrContent - Isi QR yang discan kamera (JSON {"sid":"...","t":"..."} atau string token)
 * @param {string} orientationAnswer - A / B / C / D berdasarkan arah orientasi kartu
 * @param {number} answerDuration - Waktu santri menjawab dalam detik
 */
function submitScanAnswer(token, quizCode, rawQrContent, orientationAnswer, answerDuration) {
  try {
    const guru = assertGuru(token);
    const cleanCode = String(quizCode).trim().toUpperCase();
    const cache = CacheService.getScriptCache();
    const quizId = cache.get("LIVE_CODE_" + cleanCode);

    if (!quizId) {
      return createResponse(false, "Sesi kuis tidak aktif atau kode kuis salah.");
    }

    const sessionRaw = cache.get("LIVE_QUIZ_" + quizId);
    if (!sessionRaw) return createResponse(false, "Sesi live kuis tidak ditemukan.");
    const session = JSON.parse(sessionRaw);

    // Parse identitas siswa dari QR
    let studentId = "";
    let tokenQr = "";
    try {
      const parsed = JSON.parse(rawQrContent);
      studentId = parsed.sid || parsed.student_id || "";
      tokenQr = parsed.t || parsed.token || "";
    } catch (err) {
      // Jika format teks langsung token atau student_id
      studentId = rawQrContent.trim();
    }

    // Validasi siswa di database
    const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const siswa = semuaSiswa.find(s => s.student_id === studentId || s.token_qr === studentId);

    if (!siswa) {
      return createResponse(false, "Kartu siswa tidak terdaftar di sistem!");
    }

    // Cek apakah siswa terdaftar di kelas kuis ini
    if (siswa.kelas_id !== session.kelasId) {
      return createResponse(false, `Siswa ${siswa.nama} bukan siswa kelas ini (${siswa.kelas_id})!`);
    }

    // Ambil soal aktif saat ini
    const semuaSoal = getSheetDataAsObjects(CONFIG.SHEETS.SOAL);
    const soalList = semuaSoal
      .filter(s => s.quiz_id === quizId)
      .sort((a, b) => Number(a.nomor) - Number(b.nomor));

    const currentQuestion = soalList[session.currentQuestionIndex || 0];
    if (!currentQuestion) {
      return createResponse(false, "Soal aktif tidak ditemukan.");
    }

    // ================= CEK DUPLIKASI JAWABAN =================
    // Satu siswa hanya boleh 1 kali jawaban per butir soal
    const sheetJawaban = getSheetSafe(CONFIG.SHEETS.JAWABAN);
    const semuaJawaban = getSheetDataAsObjects(CONFIG.SHEETS.JAWABAN);

    const sudahAda = semuaJawaban.find(j => 
      j.quiz_id === quizId && 
      j.question_id === currentQuestion.question_id && 
      j.student_id === siswa.student_id
    );

    if (sudahAda) {
      return createResponse(false, `Jawaban ${siswa.nama} sudah tercatat sebelumnya (${sudahAda.jawaban})!`);
    }

    // ================= HITUNG SKOR & VALIDASI JAWABAN =================
    const userAns = String(orientationAnswer).trim().toUpperCase();
    const correctAns = String(currentQuestion.jawaban_benar).trim().toUpperCase();
    const isCorrect = (userAns === correctAns);

    const basePoint = Number(currentQuestion.poin) || 100;
    const maxBonus = 50;
    const durasiMaksimal = Number(session.durasi) || 30;
    const durasiJawab = Math.max(0.5, Number(answerDuration) || 5);

    let finalScore = 0;
    if (isCorrect) {
      // Bonus kecepatan proporsional: maks_bonus * (1 - durasi_jawab / durasi_maksimal)
      let bonusSpeed = Math.round(maxBonus * (1 - (durasiJawab / durasiMaksimal)));
      if (bonusSpeed < 0) bonusSpeed = 0;
      if (bonusSpeed > maxBonus) bonusSpeed = maxBonus;
      finalScore = basePoint + bonusSpeed;
    } else {
      finalScore = 0;
    }

    // Simpan ke sheet JAWABAN
    const answerId = "ANS-" + Utilities.getUuid().substring(0, 8);
    const now = new Date().toISOString();

    sheetJawaban.appendRow([
      answerId,
      quizId,
      currentQuestion.question_id,
      siswa.student_id,
      userAns,
      isCorrect ? "BENAR" : "SALAH",
      currentQuestion.nomor,
      now,
      durasiJawab.toFixed(1),
      finalScore,
      now
    ]);

    return createResponse(true, `✓ Jawaban ${siswa.nama} berhasil dicatat!`, {
      namaSiswa: siswa.nama,
      studentId: siswa.student_id,
      jawaban: userAns,
      isCorrect: isCorrect,
      durasi: durasiJawab.toFixed(1),
      skor: finalScore,
      soalNomor: currentQuestion.nomor
    });

  } catch (e) {
    return createResponse(false, e.message);
  }
}
