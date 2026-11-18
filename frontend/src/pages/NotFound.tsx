import { Link } from "react-router-dom";
import { ArrowRightIcon } from "../components/ui/Icons";
import { useI18n } from "../i18n/I18nContext";

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="container-narrow flex flex-col items-center py-24 text-center">
      <p className="eyebrow">{t("404 · No such field")}</p>
      <h1 className="mt-3 text-3xl tracking-[-0.02em] sm:text-4xl">
        {t("This page is outside the field boundary.")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        {t("The page you requested does not exist. Head back to your fields to continue.")}
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/fields" className="btn-primary">
          {t("Go to fields")}
          <ArrowRightIcon size={15} />
        </Link>
        <Link to="/" className="btn-secondary">
          {t("Home")}
        </Link>
      </div>
    </div>
  );
}
