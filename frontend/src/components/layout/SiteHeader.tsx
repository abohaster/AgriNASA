import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useDataMode } from "../../context/DataModeContext";
import { useTheme } from "../../context/ThemeContext";
import { useAsync } from "../../hooks/useAsync";
import { readLastFieldId, rememberFieldId } from "../../hooks/useField";
import { useI18n } from "../../i18n/I18nContext";
import {
  CloseIcon,
  LanguagesIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  WheatIcon,
} from "../ui/Icons";

function BrandMark() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-[#0f2e23] text-[#fbfbf7] ring-1 ring-white/10">
      <WheatIcon size={21} />
      <span
        className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-survey-500 ring-2 ring-paper"
        aria-hidden="true"
      />
    </span>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded px-2.5 py-1.5 text-sm transition-colors",
    isActive ? "bg-forest-50 font-semibold text-forest-800" : "text-muted hover:text-ink",
  ].join(" ");
}

const PRIMARY_LINKS = [
  { to: "/explore", label: "Map" },
  { to: "/fields", label: "My Fields" },
  { to: "/crop", label: "Crop Intelligence" },
  { to: "/farmer", label: "For Farmers" },
  { to: "/data-sources", label: "Data Sources" },
  { to: "/rayyan", label: "Fale7" },
] as const;

const themeButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-card text-muted transition-colors hover:border-forest-300 hover:text-ink";

/**
 * Global navigation.
 *
 * Desktop shows primary links, a field switcher (only after a field exists),
 * the language and theme toggles and the demo switch. Mobile collapses the same
 * controls into a panel. The demo switch is intentionally visible on every page:
 * data provenance is a core feature, not a hidden developer setting.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemo, toggleDemo } = useDataMode();
  const { isDark, toggleTheme } = useTheme();
  const { lang, t, toggleLang } = useI18n();
  const { data: fields } = useAsync((signal) => api.listFields(signal), []);
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(readLastFieldId);

  useEffect(() => {
    setOpen(false);
    setSelectedFieldId(readLastFieldId());
  }, [location.pathname]);

  function handleFieldChange(value: string) {
    const fieldId = Number.parseInt(value, 10);
    if (!Number.isFinite(fieldId)) return;
    rememberFieldId(fieldId);
    setSelectedFieldId(fieldId);
    navigate(`/dashboard/${fieldId}`);
  }

  const hasFields = (fields?.length ?? 0) > 0;
  const dashboardHref = selectedFieldId
    ? `/dashboard/${selectedFieldId}`
    : hasFields
      ? `/dashboard/${fields?.[0].id}`
      : "/fields";
  const analyticsHref = selectedFieldId
    ? `/analytics/${selectedFieldId}`
    : hasFields
      ? `/analytics/${fields?.[0].id}`
      : "/fields";
  const themeLabel = isDark ? t("Switch to light mode") : t("Switch to dark mode");
  const languageLabel = lang === "ar" ? t("Switch to English") : t("Switch to Arabic");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/92 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5" aria-label={t("AgriNASA home")}>
          <BrandMark />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">AgriNASA</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {t("Crop intelligence")}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label={t("Primary navigation")}>
          <NavLink
            to={dashboardHref}
            className={({ isActive }) =>
              navClass({ isActive: isActive && location.pathname.startsWith("/dashboard") })
            }
          >
            {t("Dashboard")}
          </NavLink>
          <NavLink
            to={analyticsHref}
            className={({ isActive }) =>
              navClass({ isActive: isActive && location.pathname.startsWith("/analytics") })
            }
          >
            {t("Historical Data")}
          </NavLink>
          {PRIMARY_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={navClass}>
              {t(link.label)}
            </NavLink>
          ))}

          {hasFields && (
            <label className="ms-2">
              <span className="sr-only">{t("Active field")}</span>
              <select
                value={selectedFieldId ?? ""}
                onChange={(event) => handleFieldChange(event.target.value)}
                className="h-8 max-w-[150px] rounded-md border border-line bg-card px-2 text-xs text-ink focus:border-forest-500"
              >
                <option value="" disabled>
                  {t("Select field…")}
                </option>
                {fields?.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className={themeButtonClass}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-card px-2.5 text-xs font-medium text-muted transition-colors hover:border-forest-300 hover:text-ink"
            aria-label={languageLabel}
            title={languageLabel}
          >
            <LanguagesIcon size={14} />
            {lang === "ar" ? "EN" : "العربية"}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={isDemo}
            onClick={toggleDemo}
            className="group inline-flex items-center gap-2 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-muted hover:border-forest-300"
            title={t("Replay a cached NASA POWER snapshot and label it clearly")}
          >
            <span
              className={`relative h-4 w-7 rounded-full transition-colors ${isDemo ? "bg-clay-500" : "bg-sage-300"}`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${isDemo ? "start-3.5" : "start-0.5"}`}
              />
            </span>
            {t("Demo data")}
          </button>
          <Link to="/fields/new" className="btn-primary btn-sm">
            <PlusIcon size={14} />
            {t("New field")}
          </Link>
        </div>

        <button
          type="button"
          className="btn-secondary btn-sm xl:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? t("Close menu") : t("Open menu")}
        >
          {open ? <CloseIcon size={18} /> : <MenuIcon size={18} />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-paper xl:hidden">
          <div className="container-page flex flex-col gap-1 py-4">
            <NavLink to={dashboardHref} className={navClass} onClick={() => setOpen(false)}>
              {t("Dashboard")}
            </NavLink>
            <NavLink to={analyticsHref} className={navClass} onClick={() => setOpen(false)}>
              {t("Historical Data")}
            </NavLink>
            {PRIMARY_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                {t(link.label)}
              </NavLink>
            ))}
            <NavLink
              to="/farmer-guide"
              className={({ isActive }) =>
                [
                  "rounded px-2.5 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-forest-50 font-semibold text-forest-800"
                    : "text-forest-700 hover:text-forest-900",
                ].join(" ")
              }
              onClick={() => setOpen(false)}
            >
              {t("Simple farmer guide")}
            </NavLink>
            <NavLink to="/location" className={navClass} onClick={() => setOpen(false)}>
              {t("Location analysis")}
            </NavLink>
            <a
              href="/#data"
              className="rounded px-2.5 py-1.5 text-sm text-muted"
              onClick={() => setOpen(false)}
            >
              {t("Data & method")}
            </a>
            <NavLink to="/guide" className={navClass} onClick={() => setOpen(false)}>
              {t("Guide")}
            </NavLink>
            {hasFields && (
              <label className="mt-2">
                <span className="field-label">{t("Active field")}</span>
                <select
                  value={selectedFieldId ?? ""}
                  onChange={(event) => {
                    setOpen(false);
                    handleFieldChange(event.target.value);
                  }}
                  className="input"
                >
                  <option value="" disabled>
                    {t("Select field…")}
                  </option>
                  {fields?.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <button
                type="button"
                role="switch"
                aria-checked={isDemo}
                onClick={toggleDemo}
                className="btn-secondary btn-sm"
              >
                <span className={`h-2 w-2 rounded-full ${isDemo ? "bg-clay-500" : "bg-sage-400"}`} />
                {isDemo ? t("Demo data on") : t("Demo data off")}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="btn-secondary btn-sm"
                aria-label={themeLabel}
                title={themeLabel}
              >
                {isDark ? <SunIcon size={15} /> : <MoonIcon size={15} />}
                {isDark ? t("Light mode") : t("Dark mode")}
              </button>
              <button
                type="button"
                onClick={toggleLang}
                className="btn-secondary btn-sm"
                aria-label={languageLabel}
                title={languageLabel}
              >
                <LanguagesIcon size={15} />
                {lang === "ar" ? "English" : "العربية"}
              </button>
              <Link to="/fields/new" className="btn-primary btn-sm ms-auto" onClick={() => setOpen(false)}>
                <PlusIcon size={14} />
                {t("New field")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
