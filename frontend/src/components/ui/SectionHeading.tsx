import type { ReactNode } from "react";

/**
 * Consistent page/section header. `eyebrow` is the small mono label above the
 * title (e.g. "FIELD ANALYTICS"), `actions` sits on the right on wide screens.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  as: Tag = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <Tag className="text-2xl tracking-[-0.025em] sm:text-3xl">{title}</Tag>
        {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
