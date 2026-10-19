import { existsSync } from "node:fs";

const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
if (onRender && !existsSync(".output/server/index.mjs")) {
  console.error(
    "[build] Render needs .output/server/index.mjs, but this build used another Nitro preset.",
  );
  process.exit(1);
}
console.log("[build] server entry ok");
