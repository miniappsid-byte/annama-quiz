/**
 * AN-NAMA QUIZ - Admin.js
 * Controller CRUD Master Data untuk Admin:
 * - Guru
 * - Siswa
 * - Kelas
 * - Mapel
 * - Tahun Pelajaran
 */

// Helper validasi hak akses Admin
function assertAdmin(token) {
  const sessionResp = validateSession(token);
  if (!sessionResp.success) {
    throw new Error("Sesi tidak valid atau telah berakhir.");
  }
  if (sessionResp.data.role !== CONFIG.ROLES.ADMIN) {
    throw new Error("Akses ditolak: Hanya Admin yang diperbolehkan.");
  }
  return sessionResp.data;
}

/**
 * Mengambil ringkasan statistik master data untuk dashboard admin
 */
function getAdminStats(token) {
  try {
    assertAdmin(token);
    const guru = getSheetDataAsObjects(CONFIG.SHEETS.GURU);
    const siswa = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    const kelas = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    const mapel = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);
    const tahun = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);

    return createResponse(true, "Data statistik berhasil diambil", {
      totalGuru: guru.length,
      totalSiswa: siswa.length,
      totalKelas: kelas.length,
      totalMapel: mapel.length,
      totalTahun: tahun.length
    });
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 1. CRUD GURU
// ==========================================

function getGuruList(token) {
  try {
    assertAdmin(token);
    const data = getSheetDataAsObjects(CONFIG.SHEETS.GURU);
    return createResponse(true, "Data guru berhasil diambil", data);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveGuru(token, guruData) {
  try {
    assertAdmin(token);
    if (!guruData || !guruData.nama || !guruData.username) {
      return createResponse(false, "Nama dan Username wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.GURU);
    const usersSheet = getSheetSafe(CONFIG.SHEETS.USERS);
    const existingGuru = getSheetDataAsObjects(CONFIG.SHEETS.GURU);

    // Cek mode EDIT atau TAMBAH
    if (guruData.guru_id) {
      // Mode Edit
      const rowIndex = existingGuru.findIndex(g => g.guru_id === guruData.guru_id);
      if (rowIndex === -1) return createResponse(false, "Data guru tidak ditemukan.");
      
      const row = rowIndex + 2; // +1 header, +1 1-based index
      sheet.getRange(row, 2).setValue(guruData.nama);
      sheet.getRange(row, 3).setValue(guruData.email || "");
      sheet.getRange(row, 5).setValue(guruData.status || CONFIG.STATUS.ACTIVE);
      
      return createResponse(true, "Data guru berhasil diperbarui.");
    } else {
      // Mode Tambah Baru
      // Cek duplikasi username
      const users = getSheetDataAsObjects(CONFIG.SHEETS.USERS);
      const usernameInput = String(guruData.username).trim().toLowerCase();
      if (users.some(u => String(u.username).trim().toLowerCase() === usernameInput)) {
        return createResponse(false, "Username sudah digunakan! Gunakan username lain.");
      }

      const guruId = "GUR-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      const newStatus = CONFIG.STATUS.ACTIVE;
      
      // Simpan ke sheet GURU
      sheet.appendRow([
        guruId,
        guruData.nama.trim(),
        guruData.email ? guruData.email.trim() : "",
        usernameInput,
        newStatus
      ]);

      // Buat akun login guru ke sheet USERS
      const defaultPassword = guruData.password && guruData.password.trim() !== "" ? guruData.password : "123456";
      const now = new Date().toISOString();
      usersSheet.appendRow([
        "USR-" + Utilities.getUuid().substring(0, 8),
        usernameInput,
        hashPassword(defaultPassword),
        guruData.nama.trim(),
        CONFIG.ROLES.GURU,
        guruId,
        newStatus,
        now
      ]);

      return createResponse(true, "Guru baru berhasil ditambahkan! Password default: " + defaultPassword);
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 2. CRUD SISWA
// ==========================================

function getSiswaList(token) {
  try {
    assertAdmin(token);
    const data = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);
    return createResponse(true, "Data siswa berhasil diambil", data);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveSiswa(token, siswaData) {
  try {
    assertAdmin(token);
    if (!siswaData || !siswaData.nama || !siswaData.kelas_id) {
      return createResponse(false, "Nama dan Kelas siswa wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.SISWA);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.SISWA);

    if (siswaData.student_id) {
      // Edit
      const rowIndex = existing.findIndex(s => s.student_id === siswaData.student_id);
      if (rowIndex === -1) return createResponse(false, "Data siswa tidak ditemukan.");

      const row = rowIndex + 2;
      sheet.getRange(row, 3).setValue(siswaData.nis || "");
      sheet.getRange(row, 4).setValue(siswaData.nama.trim());
      sheet.getRange(row, 5).setValue(siswaData.kelas_id);
      sheet.getRange(row, 6).setValue(siswaData.status || CONFIG.STATUS.ACTIVE);

      return createResponse(true, "Data siswa berhasil diperbarui.");
    } else {
      // Tambah Baru
      const studentId = "STU-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      // Token QR unik dan anonim
      const tokenQr = "TK-" + Utilities.getUuid().substring(0, 8).toUpperCase();
      const now = new Date().toISOString();

      sheet.appendRow([
        studentId,
        tokenQr,
        siswaData.nis ? String(siswaData.nis).trim() : "",
        siswaData.nama.trim(),
        siswaData.kelas_id,
        CONFIG.STATUS.ACTIVE,
        now
      ]);

      return createResponse(true, "Siswa berhasil ditambahkan.");
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 3. CRUD KELAS
// ==========================================

function getKelasList(token) {
  try {
    assertAdmin(token);
    const data = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);
    return createResponse(true, "Data kelas berhasil diambil", data);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveKelas(token, kelasData) {
  try {
    assertAdmin(token);
    if (!kelasData || !kelasData.nama_kelas) {
      return createResponse(false, "Nama kelas wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.KELAS);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.KELAS);

    if (kelasData.kelas_id) {
      const idx = existing.findIndex(k => k.kelas_id === kelasData.kelas_id);
      if (idx === -1) return createResponse(false, "Kelas tidak ditemukan.");
      const row = idx + 2;
      sheet.getRange(row, 2).setValue(kelasData.nama_kelas.trim());
      sheet.getRange(row, 3).setValue(kelasData.tingkat || "");
      sheet.getRange(row, 4).setValue(kelasData.tahun_pelajaran || "");
      sheet.getRange(row, 5).setValue(kelasData.status || CONFIG.STATUS.ACTIVE);
      return createResponse(true, "Data kelas berhasil diperbarui.");
    } else {
      const kelasId = "KLS-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      sheet.appendRow([
        kelasId,
        kelasData.nama_kelas.trim(),
        kelasData.tingkat || "",
        kelasData.tahun_pelajaran || "",
        CONFIG.STATUS.ACTIVE
      ]);
      return createResponse(true, "Kelas berhasil ditambahkan.");
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 4. CRUD MAPEL
// ==========================================

function getMapelList(token) {
  try {
    assertAdmin(token);
    const data = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);
    return createResponse(true, "Data mapel berhasil diambil", data);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveMapel(token, mapelData) {
  try {
    assertAdmin(token);
    if (!mapelData || !mapelData.nama_mapel) {
      return createResponse(false, "Nama mata pelajaran wajib diisi.");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.MAPEL);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.MAPEL);

    if (mapelData.mapel_id) {
      const idx = existing.findIndex(m => m.mapel_id === mapelData.mapel_id);
      if (idx === -1) return createResponse(false, "Mapel tidak ditemukan.");
      const row = idx + 2;
      sheet.getRange(row, 2).setValue(mapelData.nama_mapel.trim());
      sheet.getRange(row, 3).setValue(mapelData.status || CONFIG.STATUS.ACTIVE);
      return createResponse(true, "Mata pelajaran berhasil diperbarui.");
    } else {
      const mapelId = "MPL-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      sheet.appendRow([
        mapelId,
        mapelData.nama_mapel.trim(),
        CONFIG.STATUS.ACTIVE
      ]);
      return createResponse(true, "Mata pelajaran berhasil ditambahkan.");
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}

// ==========================================
// 5. CRUD TAHUN PELAJARAN
// ==========================================

function getTahunList(token) {
  try {
    assertAdmin(token);
    const data = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);
    return createResponse(true, "Data tahun pelajaran berhasil diambil", data);
  } catch (e) {
    return createResponse(false, e.message);
  }
}

function saveTahun(token, tahunData) {
  try {
    assertAdmin(token);
    if (!tahunData || !tahunData.nama_tahun) {
      return createResponse(false, "Nama tahun pelajaran wajib diisi (contoh: 2025/2026).");
    }

    const sheet = getSheetSafe(CONFIG.SHEETS.TAHUN_PELAJARAN);
    const existing = getSheetDataAsObjects(CONFIG.SHEETS.TAHUN_PELAJARAN);

    if (tahunData.tahun_id) {
      const idx = existing.findIndex(t => t.tahun_id === tahunData.tahun_id);
      if (idx === -1) return createResponse(false, "Tahun pelajaran tidak ditemukan.");
      const row = idx + 2;
      sheet.getRange(row, 2).setValue(tahunData.nama_tahun.trim());
      sheet.getRange(row, 3).setValue(tahunData.status || CONFIG.STATUS.ACTIVE);
      return createResponse(true, "Tahun pelajaran berhasil diperbarui.");
    } else {
      const tahunId = "THN-" + Utilities.getUuid().substring(0, 6).toUpperCase();
      sheet.appendRow([
        tahunId,
        tahunData.nama_tahun.trim(),
        CONFIG.STATUS.ACTIVE
      ]);
      return createResponse(true, "Tahun pelajaran berhasil ditambahkan.");
    }
  } catch (e) {
    return createResponse(false, e.message);
  }
}
