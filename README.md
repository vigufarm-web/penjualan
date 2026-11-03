# Penjualan Kebun

Tampilan khusus penjualan Pisang dan Padi untuk PT Vigu Farm Indonesia. Repositori berisi kode tampilan; data, kata sandi, dan token tidak disimpan di sini.

## Penggunaan

GitHub Pages menyajikan tampilan di https://vigufarm-web.github.io/penjualan/. Login, hak akses, dan data penjualan menggunakan layanan Laporan Kebun yang sudah ada. Akun mandor tidak diberi akses penjualan. Sesi disimpan sementara di memori browser dan pengguna masuk lagi setelah halaman dimuat ulang. Kata sandi, token, dan data transaksi tidak disimpan di repositori ini.

Ringkasan mendukung pilihan bulan, tanggal 1–15, 16–akhir, dan sebulan penuh. Pembayaran dalam ringkasan periode mengikuti tanggal surat jalan yang bersangkutan. Pemeriksaan nomor surat jalan ganda membantu menemukan kemungkinan duplikat; pengguna tetap perlu memeriksa rincian sebelum menyimpan.

Sambungan layanan diterapkan melalui [PR 69](https://github.com/vigufarm-web/laporankebun/pull/69), dan ringkasan periode melalui [PR 70](https://github.com/vigufarm-web/laporankebun/pull/70). Berkas `layanan-penjualan.patch` merupakan rancangan awal, bukan sumber konfigurasi produksi.
