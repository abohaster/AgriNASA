import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AR_MESSAGES } from "./messages.ar";
import { autoTranslate } from "./patterns.ar";

export type Lang = "en" | "ar";

type Vars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Translate an English source string; unknown strings fall back to English. */
  t: (text: string, vars?: Vars) => string;
  /** Translate then render an already-localised string (backend text) as-is. */
  tm: (text: string) => string;
}

const STORAGE_KEY = "agrinasa:language";
const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "ar" || stored === "en") return stored;
  return window.navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Site-wide English/Arabic switch.
 *
 * English strings are the translation keys. Any string without an Arabic entry
 * — including backend-generated analysis text — is shown in English rather than
 * machine-translated, so computed values and caveats are never distorted.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  // Applied during render so date/number helpers that read `document.lang`
  // format in the new language in the same pass; an effect would run too late.
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(
    () => setLangState((current) => (current === "ar" ? "en" : "ar")),
    [],
  );

  const localize = useCallback(
    (text: string) => {
      if (lang !== "ar") return text;
      const exact = AR_MESSAGES[text];
      if (exact) return exact;
      return autoTranslate(text);
    },
    [lang],
  );

  const t = useCallback(
    (text: string, vars?: Vars) => interpolate(localize(text), vars),
    [localize],
  );

  const tm = useCallback((text: string) => localize(text), [localize]);

  const value = useMemo(
    () => ({ lang, dir, isRtl: lang === "ar", setLang, toggleLang, t, tm }),
    [lang, dir, setLang, toggleLang, t, tm],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
