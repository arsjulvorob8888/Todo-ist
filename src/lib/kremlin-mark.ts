import { createElement, type CSSProperties, type ReactNode } from "react";
import { actionUrlScheme, sanitizeActionHint, sanitizeActionUrl } from "./kremlin-action.ts";

/** Stored on every task, goal and project board that arrived from Кремль. */
export const KREMLIN_SOURCE = "kremlin" as const;

export const KREMLIN_RED = "#e11d2e";
export const KREMLIN_BADGE_BG = "#9f1239";

/** Kremlin rows are marked with `source`, and tasks also carry `externalId`. */
export function isKremlinSource(item: { source?: string; externalId?: string } | null | undefined): boolean {
  if (!item) return false;
  if (item.source === KREMLIN_SOURCE) return true;
  return typeof item.externalId === "string" && item.externalId.trim().length > 0;
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

/**
 * «Решить» for a Kremlin task that has a safe action URL.
 * https opens in a new tab. grokbot shows the address and hint as text,
 * because the browser may not handle that scheme.
 * Children and attributes are plain strings — nothing is parsed as HTML.
 */
export function KremlinAction({
  source,
  actionUrl,
  actionHint,
  className = "",
}: {
  source?: string;
  actionUrl?: string;
  actionHint?: string;
  className?: string;
}): ReactNode {
  if (!isKremlinSource({ source })) return null;
  const url = sanitizeActionUrl(actionUrl);
  const scheme = url ? actionUrlScheme(url) : null;
  if (!url || !scheme) return null;
  const hint = sanitizeActionHint(actionHint);
  const link: Record<string, string> = {
    href: url,
    "data-testid": "kremlin-action",
    className:
      "kremlin-action inline-flex min-h-10 shrink-0 items-center rounded-full px-3 py-2 text-sm font-semibold",
  };
  if (scheme === "https") {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  return createElement(
    "div",
    {
      className: `kremlin-action-block min-w-0 max-w-full ${className}`.trim(),
      "data-testid": "kremlin-action-block",
    },
    createElement("a", link, "Решить"),
    scheme === "grokbot"
      ? createElement(
          "p",
          {
            className: "kremlin-action-url mt-1 text-xs text-mist",
            "data-testid": "kremlin-action-url",
          },
          url,
        )
      : null,
    scheme === "grokbot" && hint
      ? createElement(
          "p",
          {
            className: "kremlin-action-hint mt-0.5 text-xs text-cream whitespace-pre-wrap",
            "data-testid": "kremlin-action-hint",
          },
          hint,
        )
      : null,
  );
}

/** Presentational card used by the UI and the render test. */
export function KremlinCard({
  source,
  title,
  actionUrl,
  actionHint,
  className = "",
}: {
  source?: string;
  title: string;
  actionUrl?: string;
  actionHint?: string;
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
    createElement(KremlinAction, { source, actionUrl, actionHint, className: "mt-2" }),
  );
}
