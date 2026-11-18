import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useDataMode } from "../context/DataModeContext";
import { useTheme } from "../context/ThemeContext";
import { useI18n } from "../i18n/I18nContext";
import { LanguagesIcon, MoonIcon, SparkIcon, SunIcon, WheatIcon } from "../components/ui/Icons";
import { useRayyanT } from "./strings";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded px-2.5 py-1.5 text-sm transition-colors",
    isActive ? "bg-forest-50 font-semibold text-forest-800" : "text-muted hover:text-ink",
  ].join(" ");
}

/**
 * Header for the Fale7 screens. Deliberately self-contained: the same page
 * components render inside the AgriNASA shell after the navigation patch is
 * approved, so they must not depend on it.
 */
export function RayyanShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useRayyanT();
  const { lang, toggleLang } = useI18n();
  const { isDark, toggleTheme } = useTheme();
  const { isDemo, toggleDemo } = useDataMode();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/92 backdrop-blur">
        <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <Link to="/rayyan" className="flex items-center gap-2.5" aria-label="Fale7">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-[#0f2e23] text-[#fbfbf7] ring-1 ring-white/10">
              <SparkIcon size={19} />
              <span
                className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-survey-500 ring-2 ring-paper"
                aria-hidden="true"
              />
            </span>
            <span className="leading-tight">
              <span className="block text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                {subtitle}
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Fale7">
            <NavLink to="/rayyan" end className={navClass}>
              {t("nav.assistant")}
            </NavLink>
            <NavLink to="/rayyan/settings" className={navClass}>
              {t("nav.settings")}
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={isDemo}
              onClick={toggleDemo}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-card px-2.5 text-xs font-medium text-muted hover:border-forest-300"
            >
              <span
                className={`relative h-4 w-7 rounded-full transition-colors ${isDemo ? "bg-clay-500" : "bg-sage-300"}`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${isDemo ? "start-3.5" : "start-0.5"}`}
                />
              </span>
              {lang === "ar" ? "عرض" : "Demo"}
            </button>
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-card px-2.5 text-xs font-medium text-muted transition-colors hover:border-forest-300 hover:text-ink"
            >
              <LanguagesIcon size={14} />
              {lang === "ar" ? "EN" : "العربية"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-card text-muted transition-colors hover:border-forest-300 hover:text-ink"
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="container-page py-8">{children}</main>

      <footer className="border-t border-line bg-card">
        <div className="container-page flex flex-wrap items-center gap-2 py-4 text-2xs text-muted">
          <WheatIcon size={14} />
          <span>AgriNASA · Fale7</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("brand.subtitle")}</span>
        </div>
      </footer>
    </div>
  );
}
