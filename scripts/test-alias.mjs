import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = join(srcRoot, specifier.slice(2));
      const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`].find((path) => existsSync(path));
      if (hit) return nextResolve(pathToFileURL(hit).href, context);
    }
    return nextResolve(specifier, context);
  },
});
