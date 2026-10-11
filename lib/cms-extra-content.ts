import type { ContentSection } from './content-defaults';

const rows = {
  "storyDownload": [
    [
      "title",
      "Judul download Story",
      "Keep it for Instagram Stories",
      "Kenangan ini boleh jadi Story."
    ],
    [
      "format",
      "Info format",
      "Portrait 1080 × 1920 · {{hashtag}}",
      "Potret 1080 × 1920 · {{hashtag}}"
    ],
    [
      "video",
      "CTA unduh video",
      "Download Story video",
      "Unduh video Story"
    ],
    [
      "videoAgain",
      "CTA unduh ulang video",
      "Download video again",
      "Unduh video lagi"
    ],
    [
      "front",
      "CTA unduh gambar depan",
      "Download front Story image",
      "Unduh gambar depan"
    ],
    [
      "back",
      "CTA unduh gambar belakang",
      "Download back Story image",
      "Unduh gambar belakang"
    ],
    [
      "frontAgain",
      "CTA unduh ulang depan",
      "Download front again",
      "Unduh depan lagi"
    ],
    [
      "backAgain",
      "CTA unduh ulang belakang",
      "Download back again",
      "Unduh belakang lagi"
    ],
    [
      "preparingVideo",
      "Status proses video",
      "Preparing video…",
      "Merangkai video…"
    ],
    [
      "preparingImage",
      "Status proses gambar",
      "Preparing image…",
      "Menyiapkan gambar…"
    ],
    [
      "wait",
      "Petunjuk proses",
      "Keep this page open for a moment.",
      "Tunggu sebentar di halaman ini. Kenangan sedang dirangkai."
    ],
    [
      "cancel",
      "CTA batal",
      "Cancel",
      "Batalkan"
    ],
    [
      "ready",
      "Status unduh otomatis",
      "Your file is ready. The download starts automatically.",
      "Kenanganmu siap. Unduhan dimulai otomatis."
    ],
    [
      "error",
      "Pesan gagal export",
      "The file could not be prepared. Try again; if video fails, save a Story image or use another browser.",
      "File belum bisa disiapkan. Coba lagi; jika video gagal, unduh gambar atau gunakan browser lain."
    ],
    [
      "progress",
      "Label aksesibilitas progres",
      "Story download progress",
      "Progres unduhan Story"
    ],
    [
      "videoPreview",
      "Label aksesibilitas video",
      "Keepsake video preview",
      "Pratinjau video kenangan"
    ],
    [
      "imagePreview",
      "CTA preview gambar",
      "Preview Story image",
      "Lihat gambar Story"
    ]
  ],
  "countdown": [
    [
      "days",
      "Hitung hari (gunakan {{days}})",
      "{{days}} days away.",
      "{{days}} hari lagi."
    ],
    [
      "today",
      "Saat hari-H",
      "today.",
      "hari ini."
    ],
    [
      "tomorrow",
      "Sehari sebelum",
      "tomorrow.",
      "besok."
    ],
    [
      "past",
      "Sesudah hari-H",
      "we’re married.",
      "kami sudah memilih selamanya."
    ]
  ]
};
export const EXTRA_CONTENT_SECTIONS: ContentSection[] = Object.entries(rows).map(([id,fields])=>({id,label:({storyDownload:'Keepsake — unduhan & Story',countdown:'Hitung mundur'} as Record<string,string>)[id],fields:fields.map(([key,label,value])=>({key,label,value}))}));
export const EXTRA_CONTENT_TRANSLATIONS=Object.fromEntries(Object.entries(rows).flatMap(([section,fields])=>fields.map(([key,,,value])=>[`id.${section}.${key}`,value])));
