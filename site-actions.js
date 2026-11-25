// Mendaftarkan operasi situs ini ke runtime agen.
// agent-manifest.json memuat modul ini lewat "actions.module". Hanya nama di
// "actions.agentTools" yang menjadi tool model, bernama website_<nama>.
//
// Setiap action membungkus fungsi yang sudah dipakai halaman sendiri, supaya
// asisten dan UI manual mengikuti satu aturan yang sama. Operasi mengembalikan
// {ok: false, reason} saat menolak input, sebelum mengubah apa pun, dan hanya
// melempar error untuk kegagalan tak terduga. Throw dilaporkan "unknown".
// Impor skrip halaman lewat URL yang sama dengan yang dimuat halaman (tanpa ?v=),
// supaya actions tidak mendapat salinan state halaman yang kedua.
import { App } from "./script.js";

/**
 * Mendeskripsikan operasi situs sebagai action yang bisa dipanggil agen.
 *
 * Runtime memvalidasi argumen terhadap inputSchema sebelum execute berjalan.
 */
class SiteActions {
  /**
   * Daftarkan semua site action ke runtime.
   *
   * :param actions: Fasade registry runtime dengan metode register(definition).
   */
  static registerActions(actions) {
    actions.register(SiteActions.getTarifAction());
  }

  /**
   * Deskripsikan read action yang menghitung ongkir dan slot antar.
   *
   * :return: Definisi action.
   */
  static getTarifAction() {
    return {
      name: "get_tarif",
      // Model membaca tiap deskripsi untuk memilih tool. Tulis di sini kapan
      // memanggilnya dan apa yang harus dipanggil sebelumnya, bukan di instruksi agen.
      description: "Baca tarif ongkir dan slot jam antar Antar Pasar yang sebenarnya: tanpa argumen mengembalikan semua zona tarif, semua slot jam, wilayah dan jam operasional; dengan jarakKm mengembalikan zona dan ongkir untuk jarak itu; dengan jam juga, mengembalikan status slot jam itu. Panggil sebelum menjawab tentang ongkir, jarak, atau jam antar, dan panggil lagi di setiap giliran yang membutuhkannya. Tidak mengubah apa-apa.",
      effect: "read",
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
      execute: SiteActions.getTarif,
    };
  }

  /**
   * Hitung tarif lewat fungsi situs sendiri.
   *
   * :param args: Argumen tervalidasi dengan jarakKm dan/atau jam (boleh kosong).
   * :return: Info tarif dan slot, atau {ok: false, reason} saat situs menolak.
   */
  static getTarif(args) {
    return App.page.getTarif(args);
  }
}

// Runtime memanggil ekspor registerActions modul ini.
export const registerActions = SiteActions.registerActions;
