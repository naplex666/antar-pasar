# Antar Pasar — situs kurir pasar (agentified)

Situs peer untuk [Pasar Pagi](../pasar-pagi-agentified/README.md): kurir/ojek pasar
yang mengantar belanjaan. Bahasa Indonesia, mobile-first, tanpa library eksternal,
tanpa pembayaran, tanpa login, tanpa backend.

## Isi situs

- **Tarif ongkir per jarak** (data contoh untuk demo): dekat 0–3 km Rp8.000,
  sedang 3–7 km Rp12.000, jauh 7–15 km Rp18.000. Di atas 15 km di luar jangkauan.
- **Slot jam antar** 07:00–18:00, tiap 1 jam. Slot 12:00 penuh (istirahat kurir).
- **Form cek ongkir manual**: pilih jarak + jam → tampil tarif + status slot.
- Wilayah: Cilacap kota dan sekitarnya.

## Agen (network `antar_pasar`)

- Front agent `koordinator_antar` + spesialis `spesialis_tarif`.
- Satu action read `get_tarif` (argumen opsional `jarakKm` 0–15 dan `jam` `JJ:00`).
  Tanpa argumen mengembalikan semua zona tarif dan semua slot jam. Tidak ada
  action write dan tidak ada action irreversible — situs ini hanya memberi info.
- Bridge (`bridge/bridge-actions.js`) membagikan **hanya** `get_tarif` ke situs
  partner (`callerOrigins ["*"]`, karena tarif dan jam adalah fakta publik).
- LLM default: hosted Otari `alibaba/qwen3.8-flash`, dengan BYOK OpenRouter/Otari
  di panel pengaturan. Kunci pengguna hanya dikirim ke router pilihannya.

## Menjalankan

```sh
# Bangun network dari HOCON dan periksa manifest + links
node ../agentic-web/skills/agentify-website/scripts/build_network.mjs --check

# Tes (runtime asli + model scripted, tanpa LLM)
node --test tests/agentified.test.mjs

# Sajikan lokal
node ../agentic-web/skills/agentify-website/scripts/serve_site.mjs --port 8081 --open-as localhost
```

## Deploy

Repo publik `naplex666/antar-pasar`, GitHub Pages:
https://naplex666.github.io/antar-pasar/

Situs ini adalah peer dari Pasar Pagi
(https://naplex666.github.io/pasar-pagi/): agen Pasar Pagi memanggil network
`antar_pasar` untuk cek ongkir + slot antar, sesudah pengunjung menyetujui
kartu consent.
