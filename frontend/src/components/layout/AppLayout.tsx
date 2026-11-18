import { Outlet } from "react-router-dom";
import { useI18n } from "../../i18n/I18nContext";
import { DemoBanner } from "./DemoBanner";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

/**
 * Application shell: skip link → header → demo notice → routed page → footer.
 * Scroll restoration is handled by the router; pages own their own padding.
 */
export function AppLayout() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-forest-900 focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        {t("Skip to main content")}
      </a>
      <SiteHeader />
      <DemoBanner />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
