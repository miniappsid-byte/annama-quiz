# 🎓 AN-NAMA QUIZ - Live Quiz & Assessment Platform

> **Platform Asesmen Interaktif Berbasis SATU Kartu QR Siswa (4 Orientasi A/B/C/D)**  
> Dirancang khusus untuk **SMPI An-Nama' / Ma'had An-Nama'**.  
> Siswa **tidak perlu membawa HP**. Guru memindai kartu santri menggunakan kamera HP, dan hasil langsung tampil realtime di layar laptop/proyektor!

---

## 🌟 Fitur Utama
1. **Multi-Role Authentication**: Login khusus Admin (Kelola Master Data) & Guru (Kelola Kuis).
2. **Master Data & Kartu QR**: Generate token aman siswa & cetak lembar kartu A4 (A=Atas, B=Kanan, C=Bawah, D=Kiri).
3. **Live Quiz Laptop Panggung**: Timer melingkar, kode kuis unik (misal `ANM4827`), tampilan soal proyektor.
4. **Mobile Scanner HP Guru**: Pindai kartu cepat via WebRTC kamera native (`playsinline`) dengan audio chime & haptic vibration.
5. **Realtime Leaderboard & Podium**: Skor presisi + bonus kecepatan waktu, animasi peringkat naik, dan selebrasi *confetti + fanfare* untuk juara 1, 2, dan 3.
6. **Analisis Butir Soal (Item Difficulty)**: Klasifikasi soal Mudah, Sedang, Sulit, persentase benar, distribusi opsi pengecoh A/B/C/D.
7. **Ekspor CSV**: Unduh rekap nilai santri dan rekapitulasi kelas seluruh guru dalam format file Excel/CSV.
8. **PWA Standalone Ready**: Dapat diinstal di HP Android, iPhone, dan PC/Laptop.

---

## 🚀 Cara Menjalankan via GitHub Pages (PWA Resmi)
1. Push repository ini ke GitHub.
2. Buka menu **Settings** > **Pages** di repository GitHub Anda.
3. Pada bagian **Build and deployment**, pilih branch `main` dan folder `/pwa` (atau `/root`).
4. Buka URL GitHub Pages yang dihasilkan di browser HP, dan tombol **"Install App"** akan langsung aktif!

---

## 🛠️ Teknologi
- **Backend**: Google Apps Script (Serverless JavaScript Engine)
- **Database**: Google Sheets (Auto-healing relational structure)
- **Frontend**: HTML5, Bootstrap 5, Bootstrap Icons
- **Audio Engine**: Web Audio API (Procedural Synthesizer, 0 external mp3)
- **QR Engine**: QRCode.js, jsQR, BarcodeDetector API
- **Deployment**: `@google/clasp` CLI
