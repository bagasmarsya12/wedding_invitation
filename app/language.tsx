"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { indonesian } from "../lib/invitation-copy";

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
  content: Record<string, string>;
};
const EMPTY: Record<string, string> = {};
const LanguageContext = createContext<LanguageContextValue>({
  language: "en" as Language,
  setLanguage: () => {},
  t: (text: string) => text,
  content: EMPTY,
});
const KEY = "bagas-iga:language:v1";

export function LanguageProvider({ children, content }: { children: ReactNode; content?: Record<string, string> }) {
  const [language, setLanguage] = useState<Language>("en");
  const overrides = content && Object.keys(content).length > 0 ? content : EMPTY;
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
    let value = text;
    // Longest matching override wins (overrides may equal the default literal).
    const stored = overrides[text.trim()];
    if (stored !== undefined) value = stored;
    if (language === "id") {
      const translated = indonesian[value.trim()] ?? indonesian[text.trim()];
      if (translated !== undefined) return value.replace(value.trim(), translated);
    }
    return value;
  }, [language, overrides]);
  const value = useMemo(() => ({ language, setLanguage: choose, t, content: overrides }), [language, choose, t, overrides]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
export function T({ children }: { children: string }) { const { t } = useLanguage(); return <>{t(children)}</>; }

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-switch" role="group" aria-label="Language / Bahasa">
    <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={language === "id"} onClick={() => setLanguage("id")}>ID</button>
  </div>;
}
