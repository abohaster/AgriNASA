import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { ExternalLinkIcon, WheatIcon } from "../ui/Icons";

/**
 * Footer with provenance and a clear non-affiliation statement. NASA data is
 * public, but a student project must not imply it is an official NASA product.
 */
export function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="mt-20 border-t border-line bg-sage-50">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-[#0f2e23] text-[#fbfbf7] ring-1 ring-white/10">
              <WheatIcon size={18} />
            </span>
            <span className="text-sm font-semibold">AgriNASA</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {t(
              "Decision support for wheat, potato and tomato, built on NASA POWER environmental data and FAO-56 water-balance science. Deterministic models compute; AI explains.",
            )}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-muted/80">
            {t(
              "Independent educational project. Not affiliated with, endorsed by, or operated by NASA. NASA data is publicly available and used under its open data policy.",
            )}
          </p>
        </div>

        <div>
          <p className="eyebrow mb-3">{t("Platform")}</p>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <Link to="/fields" className="hover:text-ink">
                {t("Fields")}
              </Link>
            </li>
            <li>
              <Link to="/fields/new" className="hover:text-ink">
                {t("New field")}
              </Link>
            </li>
            <li>
              <Link to="/guide" className="hover:text-ink">
                {t("User guide")}
              </Link>
            </li>
            <li>
              <Link to="/#method" className="hover:text-ink">
                {t("Scientific method")}
              </Link>
            </li>
            <li>
              <Link to="/#ai" className="hover:text-ink">
                {t("How the assistant works")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-3">{t("Data & sources")}</p>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <a
                href="https://power.larc.nasa.gov/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                NASA POWER <ExternalLinkIcon size={12} />
              </a>
            </li>
            <li>
              <a
                href="https://www.fao.org/4/x0490e/x0490e00.htm"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                {t("FAO-56 irrigation paper")} <ExternalLinkIcon size={12} />
              </a>
            </li>
            <li>
              <a
                href="https://gibs.earthdata.nasa.gov/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                {t("NASA GIBS imagery")} <ExternalLinkIcon size={12} />
              </a>
            </li>
            <li>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 hover:text-ink"
              >
                OpenStreetMap <ExternalLinkIcon size={12} />
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-muted sm:flex-row sm:justify-between">
          <p>{t("AgriNASA · educational decision-support prototype")}</p>
          <p>{t("Estimates are not a substitute for field observation or professional agronomic advice.")}</p>
        </div>
      </div>
    </footer>
  );
}
