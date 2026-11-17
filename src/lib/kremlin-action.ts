/** Optional action link on a Kremlin task. Invalid values are dropped, never stored. */

export const MAX_ACTION_URL = 500;
export const MAX_ACTION_HINT = 200;

/**
 * `https://` or `grokbot://`, then a host-like character, then no whitespace,
 * quotes, angle brackets, backticks, or backslashes. Anything else is dropped.
 */
const ACTION_URL = /^(https|grokbot):\/\/[^\s/"'<>`\\][^\s"'<>`\\]*$/i;

const HINT_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function sanitizeActionUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ACTION_URL) return undefined;
  if (!ACTION_URL.test(trimmed)) return undefined;
  return trimmed;
}

/** Plain text only. Markup is not interpreted; an over-long or non-text value is dropped. */
export function sanitizeActionHint(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ACTION_HINT) return undefined;
  if (HINT_CONTROL.test(trimmed)) return undefined;
  return trimmed;
}

export function actionUrlScheme(url: string): "https" | "grokbot" | null {
  const safe = sanitizeActionUrl(url);
  if (!safe) return null;
  return safe.toLowerCase().startsWith("https://") ? "https" : "grokbot";
}
