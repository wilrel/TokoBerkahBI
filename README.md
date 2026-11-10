# Toko Berkah BI

Platform kasir dan *business intelligence* untuk toko retail / sembako: penjualan, stok, pembelian ke supplier, dan laporan laba rugi dalam satu aplikasi web.

## Fitur

- **Dashboard** — omzet, laba kotor, jumlah transaksi, dan rata-rata belanja per periode, dibandingkan dengan periode sebelumnya; grafik harian; produk terlaris; metode pembayaran; nilai stok dan stok menipis.
- **Laporan laba rugi** — pendapatan, HPP, laba kotor, dan selisih stok, dirinci per kategori dan per produk, bisa diekspor ke CSV.
- **POS kasir** — transaksi penjualan dengan metode bayar dan hitung kembalian; stok berkurang otomatis dan HPP dikunci saat transaksi.
- **Scan barcode / QR** — lewat kamera HP/laptop atau scanner USB, di Kasir, Produk, dan Pembelian.
- **Produk & stok** — master produk, penyesuaian stok, riwayat pergerakan stok.
- **Pembelian (restock)** — catat pembelian dari supplier; stok dan HPP ikut diperbarui.
- **Import data** — unggah produk dari CSV/Excel dengan pemetaan kolom dan validasi.
- **Akun & karyawan** — daftar sekaligus membuat toko, tambah karyawan dengan peran Owner, Admin, Manager, atau Kasir. Satu akun bisa punya beberapa toko.

## Teknologi

| Bagian | Stack |
|---|---|
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL (atau SQLite untuk lokal) |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Auth | JWT, bcrypt |

## Struktur

```
backend/     API FastAPI (routers/, models.py, schemas.py, alembic/, tests/)
frontend/    Aplikasi Next.js (src/app, src/components, src/lib)
docker-compose.yml   PostgreSQL untuk development
sample_import.csv    Contoh file untuk fitur import
```

## Menjalankan secara lokal

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Tanpa `DATABASE_URL`, backend memakai SQLite (`backend/tokoberkahjaya.db`). Buat tabel database dulu:

```bash
alembic upgrade head
```

Lalu isi data awal (akun `admin@toko.com` / `password` dan beberapa produk contoh):

```bash
python seed.py
python seed_products.py
```

Jalankan API di http://localhost:8000 (dokumentasi di `/docs`):

```bash
uvicorn main:app --reload
```

Untuk PostgreSQL, jalankan `docker compose up -d` dari root repo, set `DATABASE_URL` sesuai `backend/.env.example`, lalu `alembic upgrade head`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:3000, lalu masuk dengan akun dari `seed.py` (`admin@toko.com` / `password`) atau klik **Daftar gratis** untuk membuat toko baru. Frontend meneruskan `/api` ke backend di `http://localhost:8000` (atur dengan `BACKEND_URL`).

### Tes

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

## Akun dan karyawan

- **Pemilik toko** mendaftar di halaman Daftar (nama, nama toko, email, password) dan otomatis menjadi **Owner**.
- **Karyawan** ditambahkan di **Pengaturan → Anggota tim → Tambah karyawan**: isi nama, email, dan pilih peran. Password awal dibuatkan otomatis; salin info loginnya dan berikan ke karyawan.
- Dari daftar anggota, Owner/Admin bisa mengubah peran, mengganti password, atau mengeluarkan karyawan.

| Peran | Akses |
|---|---|
| Kasir | Kasir dan daftar produk (tanpa HPP/margin) |
| Manager | Kasir + produk, stok, pembelian, import, laporan |
| Admin | Manager + mengatur karyawan |
| Owner | Semua, termasuk mengatur Owner lain |

## Scan barcode

SKU produk adalah kode barcode-nya. Scan barcode di kemasan saat menambah produk, lalu barang bisa dimasukkan ke pesanan kasir atau ke daftar pembelian cukup dengan scan.

- **Scanner USB/Bluetooth**: langsung scan ke kolom pencarian Kasir; barang otomatis masuk pesanan.
- **Kamera**: tekan tombol **Scan**. Kamera hanya bisa dipakai lewat `https://` atau `localhost`. Saat membuka dari HP lewat alamat jaringan lokal (mis. `http://192.168.x.x:3000`), browser memblokir kamera; gunakan https (misalnya setelah deploy) atau scanner USB.
