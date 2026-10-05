/**
 * AN-NAMA QUIZ - QR.js
 * Modul Generator QR Code Siswa & Pengambilan Data Kartu Siap Cetak
 */

/**
 * Mengambil daftar kartu siswa untuk keperluan preview dan cetak
 * Filter berdasarkan kelas_id (opsional)
 */
function getKartuSiswaData(token, filterKelasId) {
  try {
    assertAdmin(token);
    const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const semuaKelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);

    // Map kelas_id ke nama_kelas
    const kelasMap = {};
    semuaKelas.forEach(k => {
      kelasMap[k.kelas_id] = k.nama_kelas;
    });

    let hasilSiswa = semuaSiswa.filter(s => s.status === CONFIG.STATUS.ACTIVE);
    if (filterKelasId && filterKelasId.trim() !== "") {
      hasilSiswa = hasilSiswa.filter(s => s.kelas_id === filterKelasId);
    }

    // Data kartu siap render
    const kartuList = hasilSiswa.map(s => {
      return {
        student_id: s.student_id,
        token_qr: s.token_qr,
        nama: s.nama,
        nis: s.nis || "-",
        kelas_id: s.kelas_id,
        nama_kelas: kelasMap[s.kelas_id] || s.kelas_id,
        // Format payload QR: JSON stringified token unik yang aman (hanya token dan id anonim)
        qr_payload: JSON.stringify({
          sid: s.student_id,
          t: s.token_qr
        })
      };
    });

    return createResponse(true, "Data kartu berhasil diambil", kartuList);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

/**
 * Generate ulang token QR untuk siswa tertentu jika kartu hilang/rusak
 */
function regenerateTokenSiswa(token, studentId) {
  try {
    assertAdmin(token);
    const sheet = getSheetSafe(CONFIG.SHEETS.SISWA);
    const semuaSiswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const idx = semuaSiswa.findIndex(s => s.student_id === studentId);
    
    if (idx === -1) {
      return createResponse(false, "Siswa tidak ditemukan.");
    }

    const newToken = "TK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    const row = idx + 2;
    sheet.getRange(row, 2).setValue(newToken);

    return createResponse(true, "Token QR berhasil diperbarui!", { token_qr: newToken });
  } catch (e) {
    return createResponse(false, e.message);
  }
}
