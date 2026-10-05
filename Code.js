/**
 * AN-NAMA QUIZ - Code.js
 * Controller Utama & Web App Router
 */

function doGet(e) {
  // Jika database belum diinisialisasi, jalankan otomatis saat web pertama kali dibuka!
  try {
    const props = PropertiesService.getScriptProperties();
    const existingId = props.getProperty(CONFIG.PROP_KEY_SS_ID);
    if (!existingId) {
      setupDatabaseV1();
    }
  } catch (err) {
    Logger.log("Auto-setup check error: " + err.message);
  }

  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("AN-NAMA QUIZ - Live Quiz & Assessment Platform")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper untuk include file HTML parsial ke dalam index.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
