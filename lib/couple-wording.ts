/** Keep the couple's public name consistent, including older CMS wording. */
export function normalizeCoupleWording(text: string, field?: string): string {
  if (field === 'gift.bookingMessage' || field === 'id.gift.bookingMessage') return text;
  return text.replace(/\b(?:Bagas\s*(?:×|x|&|dan|and)\s*Iga|Iga\s*(?:×|x|&|dan|and)\s*Bagas)\b/gi, 'Iga & Bagas');
}
