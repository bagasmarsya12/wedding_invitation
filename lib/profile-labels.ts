// Separate keys keep the Indonesian perspective specific to each profile.
export const PROFILE_LABEL_FIELDS = [
  { key: 'person_label', label: 'Label — Di Balik Nama', value: 'The Person', id: 'Di Balik Nama' },
  { key: 'b_known_label', label: 'Label Bagas — Hal Spesial Menurut Iga', value: 'The Peculiarities', id: 'Hal Spesial Menurut Iga' },
  { key: 'i_known_label', label: 'Label Iga — Hal Spesial Menurut Bagas', value: 'The Peculiarities', id: 'Hal Spesial Menurut Bagas' },
  { key: 'b_eyes_label', label: 'Label Bagas — Di Mata Iga', value: 'Through Her Eyes', id: 'Di Mata Iga' },
  { key: 'i_eyes_label', label: 'Label Iga — Di Mata Bagas', value: 'Through His Eyes', id: 'Di Mata Bagas' },
];
export const PROFILE_LABEL_TRANSLATIONS = Object.fromEntries(
  PROFILE_LABEL_FIELDS.map(field => [`id.profil.${field.key}`, field.id]),
);
export const PROFILE_LABEL_KEYS = PROFILE_LABEL_FIELDS.map(field => `profil.${field.key}`);
const labelDefaults = Object.fromEntries(PROFILE_LABEL_FIELDS.flatMap(field => [
  [`profil.${field.key}`, field.value], [`id.profil.${field.key}`, field.id],
]));
// Previous revisions used these controls for the labels; the profile body keys stay intact.
export const RETIRED_PROFILE_LABEL_KEYS = [
  'profil.quote label', 'profil.quote label2',
  'copy.c46f8f49', 'copy.fc32c35b', 'copy.ee2afecb', 'copy.f3fa749e',
];
export function upgradeProfileLabelCopy(copy: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries({ ...labelDefaults, ...copy }).filter(([key]) =>
    !RETIRED_PROFILE_LABEL_KEYS.includes(key.replace(/^id\./, '')),
  ));
}
