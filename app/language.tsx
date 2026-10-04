"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { indonesian } from "../lib/invitation-copy";
import { copyKey } from '@/lib/copy-registry';
import { defaultWebsiteBlocks, WEBSITE_DEFAULTS, type WebsiteBlocks, type WebsiteConfig } from '@/lib/website-content';

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
};
const EMPTY: Record<string, string> = {};
const LanguageContext = createContext<LanguageContextValue>({
  language: "en" as Language,
  setLanguage: () => {},
  t: (text: string) => text,
  tField: () => "",
  content: EMPTY,
  website: WEBSITE_DEFAULTS,
  blocks: defaultWebsiteBlocks(),
});
const KEY = "bagas-iga:language:v1";

export function LanguageProvider({ children, content, overrides: suppliedOverrides, website=WEBSITE_DEFAULTS, blocks=defaultWebsiteBlocks() }: { children: ReactNode; content?: Record<string, string>; overrides?: Record<string, string>; website?:WebsiteConfig; blocks?:WebsiteBlocks }) {
  const [language, setLanguage] = useState<Language>("en");
  const overrides = suppliedOverrides && Object.keys(suppliedOverrides).length > 0 ? suppliedOverrides : EMPTY;
  const fields = content ?? EMPTY;
  useEffect(() => {
    // Read after hydration so the server and first client render agree.
    queueMicrotask(() => {
      try { if (localStorage.getItem(KEY) === "id") setLanguage("id"); } catch { /* Storage is optional. */ }
    });
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    // Measure translated text only after React has committed it.
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("wedding-language-change")));
    return () => cancelAnimationFrame(frame);
  }, [language]);
  const choose = useCallback((value: Language) => {
    setLanguage(value);
    try { localStorage.setItem(KEY, value); } catch { /* Private browsing still works. */ }
  }, []);
  const t = useCallback((text: string) => {
    const original=text.trim(), key=copyKey(original);
    const translated=language==='id';
    const value=overrides[`${translated?'id:':''}copy:${original}`] ?? overrides[translated ? `id:${original}` : original] ?? fields[translated ? `id.${key}` : key] ?? (translated ? indonesian[original] : undefined) ?? original;
    return text.replace(original,value);
  }, [language, overrides, fields]);
  // Fields are already resolved by key. Avoid matching another field's identical default text.
  const tField = useCallback((key: string) => {
    return fields[language==='id' ? `id.${key}` : key] ?? fields[key] ?? '';
  }, [language, fields]);
  const value = useMemo(() => ({ language, setLanguage: choose, t, tField, content: fields,website,blocks }), [language, choose, t, tField, fields,website,blocks]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
export function T({ children, field }: { children?: string; field?: string }) { const { t, tField } = useLanguage(); return <>{field ? tField(field) : t(children ?? "")}</>; }

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" role="group" aria-label="Language / Bahasa">
    <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={language === "id"} onClick={() => setLanguage("id")}>ID</button>
  </div>;
}
