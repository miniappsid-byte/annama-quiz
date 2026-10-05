/**
 * AN-NAMA QUIZ - Auth.js
 * Autentikasi Pengguna, Hashing, Token Sesi & Verifikasi Role
 */

/**
 * Melakukan proses login
 * @param {Object} credentials { username, password }
 */
function handleLogin(credentials) {
  try {
    if (!credentials || !credentials.username || !credentials.password) {
      return createResponse(false, "Username dan password wajib diisi!");
    }

    const usernameInput = String(credentials.username).trim().toLowerCase();
    const passwordHashed = hashPassword(credentials.password);

    const users = getSheetDataAsObjects(CONFIG.SHEETS.USERS);
    const user = users.find(u => String(u.username).trim().toLowerCase() === usernameInput);

    if (!user) {
      return createResponse(false, "Username tidak ditemukan!");
    }

    if (user.status !== CONFIG.STATUS.ACTIVE) {
      return createResponse(false, "Akun Anda sedang nonaktif. Hubungi Admin.");
    }

    if (user.password_hash !== passwordHashed) {
      return createResponse(false, "Password salah!");
    }

    // Buat token sesi sederhana berbasis CacheService
    const sessionToken = "SES-" + Utilities.getUuid();
    const sessionData = {
      userId: user.user_id,
      username: user.username,
      nama: user.nama,
      role: user.role,
      guruId: user.guru_id || "",
      token: sessionToken
    };

    // Simpan ke CacheService selama 6 jam (21600 detik)
    const cache = CacheService.getUserCache();
    cache.put(sessionToken, JSON.stringify(sessionData), 21600);

    return createResponse(true, "Login berhasil!", sessionData);

  } catch (error) {
    return createResponse(false, "Terjadi kesalahan server: " + error.message);
  }
}

/**
 * Validasi token sesi aktif
 * @param {string} token
 */
function validateSession(token) {
  if (!token) return createResponse(false, "Token tidak tersedia.");

  const cache = CacheService.getUserCache();
  const cachedData = cache.get(token);

  if (!cachedData) {
    return createResponse(false, "Sesi telah berakhir atau tidak valid.");
  }

  return createResponse(true, "Sesi valid.", JSON.parse(cachedData));
}

/**
 * Logout pengguna (hapus token dari cache)
 */
function handleLogout(token) {
  if (token) {
    const cache = CacheService.getUserCache();
    cache.remove(token);
  }
  return createResponse(true, "Logout berhasil.");
}
