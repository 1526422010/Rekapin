# Rekapin

Aplikasi pencatatan keuangan pribadi + bot Telegram, di-deploy di Vercel.

## Fitur

- **Bot Telegram**: catat transaksi via chat (`masuk 500000 gaji`, `keluar 20000 makan`), cek saldo `/saldo`, laporan Excel `/laporan`, daftar kategori `/kategori`
- **Web dashboard**: login, ringkasan saldo, tabel transaksi (filter/edit/hapus), download Excel
- **Laporan Excel**: 2 sheet (Ringkasan + Detail), format Rupiah

## Tech Stack

Next.js 14+ (App Router) · Prisma · Vercel Postgres · node-telegram-bot-api (webhook) · exceljs · NextAuth (credentials)

## Setup Lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, TELEGRAM_BOT_TOKEN, dll
npx prisma migrate dev
npm run dev
```

## Environment Variables

| Variable | Keterangan |
|---|---|
| `DATABASE_URL` | URL Postgres (Vercel Postgres / Supabase) |
| `TELEGRAM_BOT_TOKEN` | Token bot dari @BotFather |
| `WEBHOOK_URL` | URL publik aplikasi, contoh `https://rekapin.vercel.app` |
| `NEXTAUTH_SECRET` | Secret NextAuth (`openssl rand -base64 32`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Akun admin dashboard (dibuat otomatis) |

## Deploy ke Vercel

1. Push repo ke GitHub, import di Vercel
2. Set semua env variables di Vercel → Settings → Environment Variables
3. Deploy
4. Set webhook Telegram (sekali saja):

```
https://<app-url>/api/telegram/setup
```

Route ini set `setWebhook` + `setMyCommands` otomatis. Buka di browser → JSON `{"ok":true}` berarti berhasil.

## Cara Pakai Bot

- `/start` — tampilkan kode hubung, masukkan di dashboard → Pengaturan → Hubungkan Telegram
- `masuk 500000 gaji` atau `+500000 gaji` — catat pemasukan
- `keluar 20000 makan siang` atau `-20000 makan siang` — catat pengeluaran
- `/saldo` — saldo & ringkasan bulan berjalan
- `/laporan` — pilih bulan, terima file Excel
- `/kategori` — daftar kategori
- `/help` — bantuan

## Struktur

```
src/
  app/
    api/            # route handlers (transactions, categories, report, telegram, auth)
    dashboard/      # halaman utama (ringkasan + tabel)
    login/          # halaman login
    settings/       # hubungkan Telegram
  lib/
    bot.ts          # logika bot (commands, callback, parsing)
    bot-helpers.ts  # helper kirim pesan/status/excel
    parse.ts        # regex parser transaksi
    excel.ts        # generate laporan Excel
    prisma.ts       # Prisma client
    auth.ts         # NextAuth config
```
