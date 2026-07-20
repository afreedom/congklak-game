# Congklak 3D

Permainan congklak interaktif berbasis browser dengan papan 3D. Mainkan dua pemain di perangkat yang sama atau tantang AI, lengkap dengan animasi menabur biji, tembak, giliran ekstra, efek suara hasil, dan perayaan pertandingan.

## Fitur

- Papan congklak 3D yang dapat diputar dan diperbesar
- Mode pemain vs AI dan pemain vs pemain
- Animasi langkah demi langkah untuk setiap giliran
- Efek suara berbeda untuk hasil menang, kalah, dan seri
- Nama pemain dan mode permainan tersimpan di browser
- Perhitungan aturan, skor akhir, dan pemenang secara otomatis
- Unit test untuk logika permainan

## Menjalankan proyek

Prasyarat: [Node.js](https://nodejs.org/) versi 18 atau lebih baru.

~~~bash
npm run serve
~~~

Buka <http://localhost:5173/web/index.html> di browser. Three.js dimuat dari CDN, sehingga koneksi internet diperlukan saat membuka aplikasi.

Untuk menggunakan port lain:

~~~bash
PORT=8080 npm run serve
~~~

## Kontrol

- Klik lubang kecil di sisi pemain aktif untuk menjalankan langkah.
- Seret papan untuk memutar kamera.
- Gunakan roda gulir untuk memperbesar atau memperkecil tampilan.
- Pilih **Main Baru** untuk mengulang permainan.
- Pilih **Pengaturan Pemain** untuk mengganti nama atau mode permainan.

## Pengujian

~~~bash
npm test
~~~

## Struktur proyek

~~~text
src/congklak.js       Logika dan aturan permainan
test/                 Unit test logika permainan
web/app.js            Pengelolaan UI dan alur permainan
web/scene3d.js        Papan, kamera, dan animasi Three.js
web/index.html        Halaman utama aplikasi
scripts/serve.js      Server statis lokal tanpa dependency
~~~

## Lisensi

MIT
