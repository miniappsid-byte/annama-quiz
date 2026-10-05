/**
 * AN-NAMA QUIZ - Config.js
 * Konfigurasi sistem dan inisialisasi database otomatis untuk V1.0 & V1.1
 */

const CONFIG = {
  PROP_KEY_SS_ID: "ANNAMA_SPREADSHEET_ID",
  DEFAULT_SS_NAME: "DB_AN_NAMA_QUIZ",
  
  SHEETS: {
    USERS: "USERS",
    GURU: "GURU",
    SISWA: "SISWA",
    KELAS: "KELAS",
    MAPEL: "MAPEL",
    TAHUN_PELAJARAN: "TAHUN_PELAJARAN",
    KUIS: "KUIS",
    SOAL: "SOAL",
    JAWABAN: "JAWABAN",
    HASIL: "HASIL"
  },

  ROLES: {
    ADMIN: "ADMIN",
    GURU: "GURU"
  },

  STATUS: {
    ACTIVE: "AKTIF",
    INACTIVE: "NONAKTIF"
  }
};

const TABLE_SCHEMAS = [
  {
    name: CONFIG.SHEETS.USERS,
    headers: ["user_id", "username", "password_hash", "nama", "role", "guru_id", "status", "created_at"]
  },
  {
    name: CONFIG.SHEETS.GURU,
    headers: ["guru_id", "nama", "email", "username", "status"]
  },
  {
    name: CONFIG.SHEETS.SISWA,
    headers: ["student_id", "token_qr", "nis", "nama", "kelas_id", "status", "created_at"]
  },
  {
    name: CONFIG.SHEETS.KELAS,
    headers: ["kelas_id", "nama_kelas", "tingkat", "tahun_pelajaran", "status"]
  },
  {
    name: CONFIG.SHEETS.MAPEL,
    headers: ["mapel_id", "nama_mapel", "status"]
  },
  {
    name: CONFIG.SHEETS.TAHUN_PELAJARAN,
    headers: ["tahun_id", "nama_tahun", "status"]
  },
  {
    name: CONFIG.SHEETS.KUIS,
    headers: ["quiz_id", "guru_id", "kelas_id", "mapel_id", "tahun_id", "judul", "deskripsi", "jumlah_soal", "durasi", "status", "started_at", "finished_at", "created_at"]
  },
  {
    name: CONFIG.SHEETS.SOAL,
    headers: ["question_id", "guru_id", "quiz_id", "nomor", "pertanyaan", "opsi_a", "opsi_b", "opsi_c", "opsi_d", "jawaban_benar", "poin", "status"]
  },
  {
    name: CONFIG.SHEETS.JAWABAN,
    headers: ["answer_id", "quiz_id", "question_id", "student_id", "jawaban", "benar", "waktu_soal", "waktu_scan", "durasi_jawab", "skor", "created_at"]
  },
  {
    name: CONFIG.SHEETS.HASIL,
    headers: ["result_id", "quiz_id", "student_id", "jumlah_benar", "jumlah_salah", "jumlah_soal", "total_skor", "rata_rata_waktu", "ranking", "finished_at"]
  }
];

/**
 * Mengambil objek Spreadsheet dan memastikan sheet target selalu ada (Auto-healing)
 */
function getDb() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(CONFIG.PROP_KEY_SS_ID);
  let ss = null;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log("⚠️ ID Spreadsheet tersimpan tidak dapat dibuka: " + e.message);
    }
  }

  // Cek jika container-bound
  if (!ss) {
    try {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs) {
        props.setProperty(CONFIG.PROP_KEY_SS_ID, activeSs.getId());
        ss = activeSs;
      }
    } catch (e) {}
  }

  // Jika belum ada, buat Spreadsheet baru di Drive
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.DEFAULT_SS_NAME);
    props.setProperty(CONFIG.PROP_KEY_SS_ID, ss.getId());
    Logger.log("🎉 Berhasil membuat Google Spreadsheet otomatis: " + ss.getUrl());
  }

  return ss;
}

/**
 * Mendapatkan tab Sheet dengan jaminan TIDAK NULL (Otomatis dibuat jika belum ada!)
 */
function getSheetSafe(sheetName) {
  const ss = getDb();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const schema = TABLE_SCHEMAS.find(s => s.name === sheetName);
    if (schema) {
      sheet.appendRow(schema.headers);
      sheet.getRange(1, 1, 1, schema.headers.length).setFontWeight("bold").setBackground("#e9ecef");
    }
  }

  return sheet;
}

/**
 * Setup seluruh tabel dan struktur master data V1.0 dan V1.1
 */
function setupDatabaseAll() {
  const ss = getDb();

  TABLE_SCHEMAS.forEach(table => {
    let sheet = ss.getSheetByName(table.name);
    if (!sheet) {
      sheet = ss.insertSheet(table.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(table.headers);
      sheet.getRange(1, 1, 1, table.headers.length).setFontWeight("bold").setBackground("#e9ecef");
    }
  });

  // Hapus Sheet1 default jika ada
  const defaultSheet = ss.getSheetByName("Sheet1") || ss.getSheetByName("Sheet 1");
  if (defaultSheet && TABLE_SCHEMAS.every(t => t.name !== defaultSheet.getName())) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // Isi data demo USERS jika kosong
  const usersSheet = getSheetSafe(CONFIG.SHEETS.USERS);
  if (usersSheet.getLastRow() === 1) {
    const now = new Date().toISOString();
    usersSheet.appendRow([
      "USR-ADMIN01",
      "admin",
      hashPassword("admin123"),
      "Administrator Utama",
      CONFIG.ROLES.ADMIN,
      "",
      CONFIG.STATUS.ACTIVE,
      now
    ]);
    usersSheet.appendRow([
      "USR-GURU01",
      "guru1",
      hashPassword("guru123"),
      "Ust. Fatih, S.Pd.",
      CONFIG.ROLES.GURU,
      "GUR-001",
      CONFIG.STATUS.ACTIVE,
      now
    ]);
  }

  // Isi data demo GURU jika kosong
  const guruSheet = getSheetSafe(CONFIG.SHEETS.GURU);
  if (guruSheet.getLastRow() === 1) {
    guruSheet.appendRow(["GUR-001", "Ust. Fatih, S.Pd.", "fatih@annama.sch.id", "guru1", CONFIG.STATUS.ACTIVE]);
    guruSheet.appendRow(["GUR-002", "Ustdzh. Maryam, S.Pd.I.", "maryam@annama.sch.id", "guru2", CONFIG.STATUS.ACTIVE]);
  }

  // Isi data demo TAHUN_PELAJARAN jika kosong
  const tahunSheet = getSheetSafe(CONFIG.SHEETS.TAHUN_PELAJARAN);
  if (tahunSheet.getLastRow() === 1) {
    tahunSheet.appendRow(["THN-2026", "2025/2026", CONFIG.STATUS.ACTIVE]);
  }

  // Isi data demo KELAS jika kosong
  const kelasSheet = getSheetSafe(CONFIG.SHEETS.KELAS);
  if (kelasSheet.getLastRow() === 1) {
    kelasSheet.appendRow(["KLS-7A", "7A - Abu Bakar", "7", "2025/2026", CONFIG.STATUS.ACTIVE]);
    kelasSheet.appendRow(["KLS-8A", "8A - Umar bin Khattab", "8", "2025/2026", CONFIG.STATUS.ACTIVE]);
  }

  // Isi data demo MAPEL jika kosong
  const mapelSheet = getSheetSafe(CONFIG.SHEETS.MAPEL);
  if (mapelSheet.getLastRow() === 1) {
    mapelSheet.appendRow(["MPL-MTK", "Matematika", CONFIG.STATUS.ACTIVE]);
    mapelSheet.appendRow(["MPL-PAI", "Pendidikan Agama Islam", CONFIG.STATUS.ACTIVE]);
    mapelSheet.appendRow(["MPL-IPA", "Ilmu Pengetahuan Alam", CONFIG.STATUS.ACTIVE]);
  }

  // Isi data demo SISWA jika kosong
  const siswaSheet = getSheetSafe(CONFIG.SHEETS.SISWA);
  if (siswaSheet.getLastRow() === 1) {
    const now = new Date().toISOString();
    siswaSheet.appendRow(["STU-A101", "TK-8F4K92", "2026001", "Ahmad Fauzi", "KLS-8A", CONFIG.STATUS.ACTIVE, now]);
    siswaSheet.appendRow(["STU-A102", "TK-9J3M15", "2026002", "Fatih Abdullah", "KLS-8A", CONFIG.STATUS.ACTIVE, now]);
    siswaSheet.appendRow(["STU-A103", "TK-2L7Q48", "2026003", "Yusuf Al-Bantani", "KLS-8A", CONFIG.STATUS.ACTIVE, now]);
  }

  Logger.log("✅ Inisialisasi Database Sukses! URL: " + ss.getUrl());
  return ss.getUrl();
}

function setupDatabaseV1() {
  return setupDatabaseAll();
}
