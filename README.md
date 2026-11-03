# Penjualan Kebun

Tampilan khusus penjualan Pisang dan Padi untuk PT Vigu Farm Indonesia. Repositori berisi kode tampilan; data, kata sandi, dan token tidak disimpan di sini.

## Status

Masih dalam pengujian. Sambungan `/api/input-client/` pada layanan Laporan Kebun harus disiapkan dan diuji sebelum GitHub Pages digunakan untuk transaksi sebenarnya. Login menggunakan sesi sementara di memori browser; pengguna masuk lagi setelah halaman dimuat ulang.

Pembatasan penjualan harus diberlakukan oleh layanan, bukan hanya dengan menyembunyikan menu. Data lama tetap di sumber saat ini hingga proses penyambungan, cadangan, dan pemeriksaan selesai.

Rancangan perubahan layanan tersedia sebagai `layanan-penjualan.patch`, berbasis `vigufarm-web/laporankebun` revisi `17fb47ae01a4dc11ca0e51bfb518afd259b3596c`. Patch ini belum diterapkan pada layanan produksi.
