# Toko Berkah BI

Platform kasir dan *business intelligence* untuk toko retail / sembako: penjualan, stok, pembelian ke supplier, dan laporan laba rugi dalam satu aplikasi web.

## Fitur

- **Dashboard** — omzet, laba kotor, jumlah transaksi, dan rata-rata belanja per periode, dibandingkan dengan periode sebelumnya; grafik harian; produk terlaris; metode pembayaran; nilai stok dan stok menipis.
- **Laporan laba rugi** — pendapatan, HPP, laba kotor, dan selisih stok, dirinci per kategori dan per produk, bisa diekspor ke CSV.
- **POS kasir** — transaksi penjualan; stok berkurang otomatis dan HPP dikunci saat transaksi.
- **Produk & stok** — master produk, penyesuaian stok, riwayat pergerakan stok.
- **Pembelian (restock)** — catat pembelian dari supplier; stok dan HPP ikut diperbarui.
- **Import data** — unggah produk dari CSV/Excel dengan pemetaan kolom dan validasi.
- **Multi-toko & peran** — satu akun bisa punya beberapa toko (workspace) dengan peran Owner, Admin, Manager, dan Kasir. Kasir tidak bisa melihat laporan laba.

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

Tanpa `DATABASE_URL`, backend memakai SQLite (`backend/tokoberkahjaya.db`). Isi data awal (akun `admin@toko.com` / `password` dan beberapa produk contoh):

```bash
python seed.py && python seed_products.py
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

Buka http://localhost:3000. Frontend otomatis login sebagai `admin@toko.com` ke API di `http://localhost:8000/api`.

### Tes

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```
