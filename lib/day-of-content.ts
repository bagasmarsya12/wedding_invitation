export const DAY_OF_COPY = [
  ['title', 'Judul tampilan hari H', 'Today We’re Getting Married.', 'Hari ini Kami Menikah.'],
  ['intro', 'Pengantar hari H', 'Your pass, the way here, and a little help if you need it. See you soon.', 'Kartu masuk, petunjuk arah, dan bantuan jika diperlukan. Sampai sebentar lagi.'],
  ['fullInvitation', 'Tombol undangan lengkap', 'View the full invitation', 'Lihat undangan lengkap'],
  ['personalLinkHint', 'Petunjuk QR pada halaman umum', 'Your check-in QR is on your personal invitation link.', 'QR check-in tersedia lewat tautan undangan personalmu.'],
] as const;

export const DAY_OF_KEYS = DAY_OF_COPY.map(([key]) => `dayOf.${key}`);
export const DAY_OF_TRANSLATIONS = Object.fromEntries(DAY_OF_COPY.map(([key, , , value]) => [`id.dayOf.${key}`, value]));
