// Antar Pasar — kurir pasar Cilacap, situs statis demo, tanpa backend dan
// tanpa pembayaran. Data tarif dan slot antar dimuat dari data/tarif.json.
// Tarif hanya contoh; tidak ada pengiriman sungguhan.
//
// Objek `App.page` adalah antarmuka yang dipakai agen (site actions). Semua
// metodenya mengembalikan { ok: true, ... } atau { ok: false, reason: "..." }
// dan TIDAK PERNAH melempar error untuk input yang buruk.

import tarifData from "./data/tarif.json" with { type: "json" };

var bands = tarifData.tarif || [];       // zona tarif: id, label, min_km, max_km, ongkir
var slots = tarifData.slot || [];        // slot jam antar: jam, status, alasan
var maksJarak = tarifData.maks_jarak_km || 15;

// ---------- util ----------

function rupiah(n) {
  return "Rp" + Number(n).toLocaleString("id-ID");
}

function findBand(jarakKm) {
  for (var i = 0; i < bands.length; i++) {
    if (jarakKm <= bands[i].max_km) return bands[i];
  }
  return null;
}

function findSlot(jam) {
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].jam === jam) return slots[i];
  }
  return null;
}

function bandBiasa(band) {
  return { id: band.id, label: band.label, min_km: band.min_km, max_km: band.max_km, ongkir: band.ongkir };
}

function slotBiasa(slot) {
  return { jam: slot.jam, status: slot.status, alasan: slot.alasan || null };
}

// ---------- antarmuka publik (dipakai agen sebagai site actions) ----------

function getState() {
  return {
    ok: true,
    antar: "Antar Pasar",
    wilayah: tarifData.wilayah || "",
    jamOperasional: tarifData.jam_operasional || "",
    tanggal: tarifData.tanggal || null,
    catatan: "Tarif contoh untuk demo.",
    maksJarakKm: maksJarak,
    tarif: bands.map(bandBiasa),
    slot: slots.map(slotBiasa)
  };
}

// args: { jarakKm?, jam? } — tanpa argumen mengembalikan semua info tarif dan slot.
// jarakKm: angka km dari pasar, 0–15. jam: "JJ:00" salah satu slot 07:00–18:00.
function getTarif(args) {
  try {
    args = args || {};
    var jarak = args.jarakKm;
    var jam = args.jam === undefined || args.jam === null ? null : String(args.jam);
    // Tanpa argumen: info lengkap, supaya agen bisa menjawab "berapa tarifnya?"
    // dan "slot jam berapa saja?" dari satu bacaan.
    if (jarak === undefined || jarak === null || jarak === "") {
      return {
        ok: true,
        antar: "Antar Pasar",
        wilayah: tarifData.wilayah || "",
        jamOperasional: tarifData.jam_operasional || "",
        catatan: "Tarif contoh untuk demo.",
        maksJarakKm: maksJarak,
        tarif: bands.map(bandBiasa),
        slot: slots.map(slotBiasa)
      };
    }
    var jarakKm = Number(jarak);
    if (!Number.isFinite(jarakKm) || jarakKm < 0) {
      return { ok: false, reason: "Jarak harus angka 0 atau lebih (km)." };
    }
    if (jarakKm > maksJarak) {
      return { ok: false, reason: "Jarak " + jarakKm + " km di luar jangkauan Antar Pasar (maksimal " + maksJarak + " km)." };
    }
    var band = findBand(jarakKm);
    if (!band) {
      return { ok: false, reason: "Tidak ada tarif untuk jarak " + jarakKm + " km." };
    }
    var hasil = {
      ok: true,
      jarakKm: jarakKm,
      band: bandBiasa(band),
      ongkir: band.ongkir,
      catatan: "Tarif contoh untuk demo."
    };
    if (jam !== null) {
      var slot = findSlot(jam);
      if (!slot) {
        return { ok: false, reason: "Jam harus salah satu slot 07:00–18:00." };
      }
      if (slot.status !== "tersedia") {
        return { ok: false, reason: "Slot jam " + jam + " penuh (" + (slot.alasan || "tidak tersedia") + "). Pilih jam lain." };
      }
      hasil.jam = jam;
      hasil.slot = slotBiasa(slot);
    }
    return hasil;
  } catch (e) {
    return { ok: false, reason: "Gagal menghitung tarif." };
  }
}

export const App = {
  page: {
    getState: getState,
    getTarif: getTarif,
    rupiah: rupiah
  }
};

// ---------- tampilan ----------

function el(tag, text, className) {
  var node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderTarif() {
  var body = document.querySelector("#tarif-body");
  body.replaceChildren();
  bands.forEach(function (band) {
    var row = el("tr");
    row.append(el("td", band.label));
    row.append(el("td", rupiah(band.ongkir)));
    body.append(row);
  });
  document.querySelector("#tarif-info").textContent =
    "Tarif tanggal " + (tarifData.tanggal || "-") + ". " + (tarifData.catatan || "");
}

function renderSlot() {
  var list = document.querySelector("#slot-daftar");
  list.replaceChildren();
  slots.forEach(function (slot) {
    var li = el("li", undefined, "slot" + (slot.status === "tersedia" ? "" : " penuh"));
    li.append(el("strong", slot.jam));
    li.append(el("span", slot.status === "tersedia" ? "Tersedia" : "Penuh" + (slot.alasan ? " — " + slot.alasan : "")));
    list.append(li);
  });
}

function showHasil(hasil) {
  var box = document.querySelector("#hasil");
  var teks = document.querySelector("#hasil-teks");
  if (!hasil.ok) {
    teks.textContent = hasil.reason;
    box.hidden = false;
    return;
  }
  var bagian = [];
  if (hasil.band) {
    bagian.push("Jarak " + hasil.jarakKm + " km masuk zona " + hasil.band.label + ". Ongkir " + rupiah(hasil.ongkir) + ".");
  }
  if (hasil.jam) {
    bagian.push("Slot jam " + hasil.jam + " tersedia.");
  }
  bagian.push("Tarif contoh untuk demo.");
  teks.textContent = bagian.join(" ");
  box.hidden = false;
}

// ---------- muat + pasang event ----------

function init() {
  document.querySelector("#jam-operasional").textContent =
    "Wilayah: " + (tarifData.wilayah || "-") + " · Jam antar " + (tarifData.jam_operasional || "-") + ".";
  renderTarif();
  renderSlot();
  var form = document.querySelector("#cek-form");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var hasil = getTarif({
      jarakKm: document.querySelector("#jarak").value,
      jam: document.querySelector("#jam").value || null
    });
    showHasil(hasil);
  });
}

if (typeof document !== "undefined") init();
