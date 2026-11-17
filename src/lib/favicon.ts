import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Last resort if the built server cannot see public/. Kept identical to favicon.svg. */
const FALLBACK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="ToDO-AKA">
  <rect width="32" height="32" rx="8" fill="#12110e"/>
  <path fill="#e8a317" fill-rule="evenodd" d="M16 6 6 26.5h4.2l1.9-4.6h7.8l1.9 4.6H26L16 6zm0 6.4 2.4 5.7h-4.8L16 12.4z"/>
</svg>
`;

function readIcon(): string {
  const candidates = [
    fileURLToPath(new URL("../../public/favicon.svg", import.meta.url)),
    join(process.cwd(), "public/favicon.svg"),
    join(process.cwd(), ".output/public/favicon.svg"),
  ];
  for (const path of candidates) {
    try {
      const text = readFileSync(path, "utf8");
      if (text.includes("<svg")) return text;
    } catch {
      /* Try the next place the app icon is copied. */
    }
  }
  return FALLBACK_ICON;
}

/** GET /favicon.ico — the existing app icon, not a generated placeholder. */
export function faviconResponse(): Response {
  return new Response(readIcon(), {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
