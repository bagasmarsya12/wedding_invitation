"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FormattedText } from "./formatted-text";
import { indonesian } from "../lib/invitation-copy";
import { normalizeCoupleWording } from '@/lib/couple-wording';
import { copyKey } from '@/lib/copy-registry';
import { defaultWebsiteBlocks, WEBSITE_DEFAULTS, type WebsiteBlocks, type WebsiteConfig } from '@/lib/website-content';
import { ARRIVAL_DEFAULTS, type ArrivalContent } from '@/lib/arrival-content';

type Language = "en" | "id";

/**
 * CMS overrides arrive from the server (settings table → flat key/value map,
 * keys like "hero.env greet"). A key with a stored value replaces the literal;
 * everything else keeps the authored fallback. Indonesian translation still
 * applies on top for interface copy that has an entry in the dictionary.
 */
type LanguageContextValue = {
  language: Language;
  setLanguage: (_: Language) => void;
  t: (text: string) => string;
  tField: (key: string) => string;
  content: Record<string, string>;
  website: WebsiteConfig;
  blocks: WebsiteBlocks;
  arrival: ArrivalContent;
};
const EMPTY: Record<string, string> = {};
const LanguageContext = createContext<LanguageContextValue>({
  language: "id" as Language,
  setLanguage: () => {},
  t: (text: string) => text,
  tField: () => "",
  content: EMPTY,
  website: WEBSITE_DEFAULTS,
  blocks: defaultWebsiteBlocks(),
  arrival: ARRIVAL_DEFAULTS,
});
const KEY = "bagas-iga:language:v1";

export function LanguageProvider({ children, content, overrides: suppliedOverrides, website=WEBSITE_DEFAULTS, blocks=defaultWebsiteBlocks(), arrival=ARRIVAL_DEFAULTS,initialLanguage='id',persistLanguage=true }: { children: ReactNode; content?: Record<string, string>; overrides?: Record<string, string>; website?:WebsiteConfig; blocks?:WebsiteBlocks; arrival?:ArrivalContent;initialLanguage?:Language;persistLanguage?:boolean }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const overrides = suppliedOverrides && Object.keys(suppliedOverrides).length > 0 ? suppliedOverrides : EMPTY;
  const fields = content ?? EMPTY;
  useEffect(() => {
    if(!persistLanguage)return;
    // Read after hydration so the server and first client render agree.
    queueMicrotask(() => {
      try { const stored=localStorage.getItem(KEY); if (stored === "id" || stored === "en") setLanguage(stored); } catch { /* Storage is optional. */ }
    });
  }, [persistLanguage]);
  useEffect(() => {
    document.documentElement.lang = language;
    // Measure translated text only after React has committed it.
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("wedding-language-change")));
    return () => cancelAnimationFrame(frame);
  }, [language]);
  const choose = useCallback((value: Language) => {
    setLanguage(value);
    if(persistLanguage)try { localStorage.setItem(KEY, value); } catch { /* Private browsing still works. */ }
  }, [persistLanguage]);
  const t = useCallback((text: string) => {
    const original=text.trim(), key=copyKey(original);
    const translated=language==='id';
    const value=overrides[`${translated?'id:':''}copy:${original}`] ?? overrides[translated ? `id:${original}` : original] ?? fields[translated ? `id.${key}` : key] ?? (translated ? indonesian[original] : undefined) ?? original;
    return normalizeCoupleWording(text.replace(original,value));
  }, [language, overrides, fields]);
  // Fields are already resolved by key. Avoid matching another field's identical default text.
  const tField = useCallback((key: string) => {
    return normalizeCoupleWording(fields[language==='id' ? `id.${key}` : key] ?? fields[key] ?? '');
  }, [language, fields]);
  const value = useMemo(() => ({ language, setLanguage: choose, t, tField, content: fields,website,blocks,arrival }), [language, choose, t, tField, fields,website,blocks,arrival]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
export function T({ children, field, rich = false }: { children?: string; field?: string; rich?: boolean }) { const { t, tField } = useLanguage(); const value=field?tField(field):t(children??""); return rich?<FormattedText value={value}/>:<>{value}</>; }

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" role="group" aria-label="Language / Bahasa">
    <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={language === "id"} onClick={() => setLanguage("id")}>ID</button>
  </div>;
}
