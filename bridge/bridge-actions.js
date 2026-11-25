// Action yang dibagikan situs ini ke situs agen lain, lewat action bridge.
// Build menyebut file ini di bridge/agent-manifest.json. Saat asisten situs lain
// memanggil network situs ini, bridge memuat file ini di frame tersembunyi di
// origin situs ini, yang tidak punya halaman. Hanya nama di
// "actions.agentTools" manifest yang sampai ke agen partner.
//
// Bridge ini hanya membagikan read get_tarif: tarif dan slot yang sudah publik.
// Tidak ada pemesanan, dan tidak ada data pengunjung.

/**
 * Membagikan read situs ini ke situs partner yang memanggil network-nya.
 *
 * Agen partner memanggilnya dari halaman partner. Tiap read berjalan di sini,
 * di frame tersembunyi di origin situs ini, dengan kode situs sendiri. Tidak
 * ada yang bisa melihat halaman atau apa yang dilakukan satu pengunjung di
 * sana.
 */
class BridgeActions {
  /**
   * Situs yang boleh memanggil read ini, sebagai origin persis beserta port.
   * "*" membagikan read ke semua situs di web: dipakai hanya untuk fakta yang
   * sudah ditampilkan halaman publik, seperti tarif dan jam antar.
   */
  static CALLERS = ["*"];

  /**
   * Data situs, untuk fakta yang hanya ada di HTML halaman.
   */
  static PAGE = new URL("../index.html", import.meta.url).href;

  /**
   * Daftarkan read yang dibagikan.
   *
   * :param actions: Fasade registry runtime dengan metode register(definition).
   */
  static registerActions(actions) {
    actions.register(BridgeActions.getTarifAction());
  }

  /**
   * Deskripsikan read tarif dan slot yang dibagikan.
   *
   * :return: Definisi action.
   */
  static getTarifAction() {
    return {
      // Action halaman sendiri punya nama dan input yang sama, supaya instruksi
      // network cocok untuk keduanya.
      name: "get_tarif",
      description: "Baca tarif ongkir dan slot jam antar Antar Pasar: tanpa argumen mengembalikan semua zona tarif, semua slot jam, wilayah dan jam operasional; dengan jarakKm mengembalikan zona dan ongkir untuk jarak itu; dengan jam juga, mengembalikan status slot jam itu. Tidak mengubah apa-apa. Panggil sebelum menjawab tentang ongkir, jarak, atau jam antar.",
      effect: "read",
      availability: "bridge",
      callerOrigins: BridgeActions.CALLERS,
      inputSchema: {
        type: "object",
        properties: {
          jarakKm: {
            type: "number",
            minimum: 0,
            maximum: 15,
            description: "Jarak dari pasar dalam km. Kosongkan untuk semua zona tarif. Di atas 15 km di luar jangkauan.",
          },
          jam: {
            type: "string",
            description: "Jam antar yang ditanyakan, format JJ:00, salah satu slot 07:00–18:00. Kosongkan bila tidak menanyakan jam tertentu.",
          },
        },
        additionalProperties: false,
      },
      execute: BridgeActions.getTarif,
    };
  }

  /**
   * Baca data tarif dan fakta yang hanya ada di HTML halaman, lalu hitung
   * jawaban yang sama dengan yang diberikan halaman sendiri.
   *
   * :param args: Argumen dengan jarakKm dan/atau jam (boleh kosong).
   * :return: Promise berisi info tarif dan slot.
   */
  static async getTarif(args) {
    const dataResponse = await fetch(new URL("../data/tarif.json", import.meta.url));
    if (!dataResponse.ok) {
      throw new Error(`Data tarif menjawab ${dataResponse.status}.`);
    }
    const data = await dataResponse.json();
    const page = await BridgeActions.readPage(BridgeActions.PAGE);
    const bands = data.tarif || [];
    const slots = data.slot || [];
    const maksJarak = data.maks_jarak_km || 15;
    const jarak = args ? args.jarakKm : undefined;
    const jam = args && args.jam ? String(args.jam) : null;
    const info = {
      ok: true,
      antar: "Antar Pasar",
      wilayah: data.wilayah || "",
      jamOperasional: page.querySelector("#jam-operasional")?.textContent.trim() || data.jam_operasional || "",
      catatan: "Tarif contoh untuk demo.",
      maksJarakKm: maksJarak,
      tarif: bands.map(function (band) {
        return { id: band.id, label: band.label, min_km: band.min_km, max_km: band.max_km, ongkir: band.ongkir };
      }),
      slot: slots.map(function (slot) {
        return { jam: slot.jam, status: slot.status, alasan: slot.alasan || null };
      }),
    };
    if (jarak === undefined || jarak === null || jarak === "") {
      return info;
    }
    const jarakKm = Number(jarak);
    if (!Number.isFinite(jarakKm) || jarakKm < 0) {
      return { ok: false, reason: "Jarak harus angka 0 atau lebih (km)." };
    }
    if (jarakKm > maksJarak) {
      return { ok: false, reason: "Jarak " + jarakKm + " km di luar jangkauan Antar Pasar (maksimal " + maksJarak + " km)." };
    }
    const band = bands.find(function (b) { return jarakKm <= b.max_km; });
    if (!band) {
      return { ok: false, reason: "Tidak ada tarif untuk jarak " + jarakKm + " km." };
    }
    const hasil = {
      ok: true,
      jarakKm: jarakKm,
      band: { id: band.id, label: band.label, min_km: band.min_km, max_km: band.max_km, ongkir: band.ongkir },
      ongkir: band.ongkir,
      catatan: "Tarif contoh untuk demo.",
    };
    if (jam !== null) {
      const slot = slots.find(function (s) { return s.jam === jam; });
      if (!slot) {
        return { ok: false, reason: "Jam harus salah satu slot 07:00–18:00." };
      }
      if (slot.status !== "tersedia") {
        return { ok: false, reason: "Slot jam " + jam + " penuh (" + (slot.alasan || "tidak tersedia") + "). Pilih jam lain." };
      }
      hasil.jam = jam;
      hasil.slot = { jam: slot.jam, status: slot.status, alasan: slot.alasan || null };
    }
    return hasil;
  }

  /**
   * Ambil satu halaman situs dan parse, supaya faktanya bisa dibaca seperti di halaman.
   *
   * :param url: Alamat halaman.
   * :return: Promise berisi dokumen hasil parse, dengan link yang mengacu ke alamat halaman.
   * :raises Error: Saat tidak ada DOMParser, atau halaman tidak bisa dibaca.
   */
  static async readPage(url) {
    // Cek dulu: Node punya fetch tapi tidak punya DOMParser, jadi tes tidak
    // pernah mengirim request sungguhan.
    if (typeof DOMParser === "undefined") {
      throw new Error("Reading the site's page needs a browser.");
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`The site's page answered ${response.status}.`);
    }
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    // Halaman hasil parse mengacu link ke alamat frame ini. Elemen base membuat
    // link mengacu ke alamat halaman sendiri, seperti di halaman.
    const base = page.createElement("base");
    base.href = url;
    page.head.prepend(base);
    return page;
  }
}

// Bridge memanggil ekspor registerActions modul ini.
export const registerActions = BridgeActions.registerActions;
