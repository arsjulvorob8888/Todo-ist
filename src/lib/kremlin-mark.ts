import { createElement, type CSSProperties, type ReactNode } from "react";

/** Stored on every task, goal and project board that arrived from Кремль. */
export const KREMLIN_SOURCE = "kremlin" as const;

export const KREMLIN_RED = "#e11d2e";
export const KREMLIN_BADGE_BG = "#9f1239";

export function isKremlinSource(item: { source?: string } | null | undefined): boolean {
  return item?.source === KREMLIN_SOURCE;
}

/** Extra classes for a Kremlin card. Empty for everything else, so other items stay as they are. */
export function kremlinCardClass(item: { source?: string } | null | undefined): string {
  return isKremlinSource(item) ? "kremlin-source" : "";
}

export function kremlinCardStyle(item: { source?: string } | null | undefined): CSSProperties | undefined {
  if (!isKremlinSource(item)) return undefined;
  return {
    borderLeftColor: KREMLIN_RED,
    backgroundColor: "rgba(225, 29, 46, 0.14)",
  };
}

export function kremlinProjectClass(name: string, boards: readonly { name: string; source?: string }[]): string {
  return boards.some((board) => board.name === name && board.source === KREMLIN_SOURCE) ? "kremlin-project" : "";
}

export function KremlinBadge(): ReactNode {
  return createElement(
    "span",
    {
      "data-testid": "kremlin-badge",
      className: "kremlin-badge inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide sm:text-[11px]",
    },
    "Кремль",
  );
}

/** Presentational card used by the UI and the render test. */
export function KremlinCard({
  source,
  title,
  className = "",
}: {
  source?: string;
  title: string;
  className?: string;
}): ReactNode {
  const item = { source };
  return createElement(
    "article",
    {
      "data-source": isKremlinSource(item) ? KREMLIN_SOURCE : "local",
      className: `border-l-4 ${kremlinCardClass(item)} ${className}`.trim(),
      style: kremlinCardStyle(item),
    },
    createElement("h3", { className: "min-w-0" }, title),
    isKremlinSource(item) ? KremlinBadge() : null,
  );
}
