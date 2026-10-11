/** Keep the couple's public name consistent, including older CMS wording. */
export function normalizeCoupleWording(text: string): string {
  return text.replace(/\b(?:Bagas\s*(?:×|x|&|dan|and)\s*Iga|Iga\s*(?:×|x|&|dan|and)\s*Bagas)\b/gi, 'Iga & Bagas');
}
