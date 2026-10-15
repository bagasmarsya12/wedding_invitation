import { CONTENT_DEFAULTS } from './content-defaults';
export const STAKK_FIELDS = ['eyebrow', 'title', 'description', 'cta', 'hint'] as const;
/** Only this public copy may cross the invitation -> camera origin boundary. */
export function publicStakkContent(values: Record<string, string>) {
  return { version: 1, languages: Object.fromEntries(['id', 'en'].map(language => [language,
    Object.fromEntries(STAKK_FIELDS.map(field => {
      const key = `${language === 'id' ? 'id.' : ''}stakk.${field}`;
      return [field, values[key]?.trim() || CONTENT_DEFAULTS[key]];
    })),
  ])) };
}
const allowedOrigins = new Set([
  'https://stakk.iganyabagas.com',
  'https://stakk-iganyabagas.bagasmarsya13.chatgpt.site',
  'https://iganyabagas.com',
  'https://bagas-iga-wedding-011126.bagasmarsya13.chatgpt.site',
]);
export function stakkCorsHeaders(origin: string | null) {
  if (origin && !allowedOrigins.has(origin)) return null;
  return { 'Cache-Control': 'no-store', 'Vary': 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
