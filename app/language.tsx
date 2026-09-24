"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { indonesian } from "../lib/invitation-copy";

type Language = "en" | "id";
const LanguageContext = createContext({ language: "en" as Language, setLanguage: (_: Language) => {}, t: (text: string) => text });
const KEY = "bagas-iga:language:v1";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
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
    if (language === "en") return text;
    const translated = indonesian[text.trim()];
    return translated === undefined ? text : text.replace(text.trim(), translated);
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage: choose, t }), [language, choose, t]);
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
