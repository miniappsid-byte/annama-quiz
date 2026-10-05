/**
 * AN-NAMA QUIZ - Utils.js
 * Fungsi pembantu (Hashing, Format, Respon, Helper DB)
 */

/**
 * Hash password menggunakan SHA-256 bawaan Google Apps Script
 */
function hashPassword(password) {
  if (!password) return "";
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, 
    String(password), 
    Utilities.Charset.UTF_8
  );
  let hashStr = "";
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hashStr += byteHex;
  }
  return hashStr;
}

/**
 * Format respon standar untuk frontend
 */
function createResponse(success, message, data) {
  return {
    success: success,
    message: message,
    data: data || null,
    timestamp: new Date().getTime()
  };
}

/**
 * Mengambil semua baris sheet dalam bentuk array of objects dengan proteksi safe sheet
 */
function getSheetDataAsObjects(sheetName) {
  const sheet = getSheetSafe(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = values.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}
