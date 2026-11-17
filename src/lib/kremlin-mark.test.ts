import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KremlinBadge, KremlinCard, isKremlinSource, kremlinCardClass } from "./kremlin-mark.ts";

describe("kremlin mark", () => {
  it("renders the badge and kremlin class only for a kremlin-sourced item", () => {
    const kremlin = renderToStaticMarkup(
      createElement(KremlinCard, { source: "kremlin", title: "Проверить отчёт" }),
    );
    const plain = renderToStaticMarkup(createElement(KremlinCard, { source: undefined, title: "Купить хлеб" }));
    const badge = renderToStaticMarkup(createElement(KremlinBadge));

    assert.equal(isKremlinSource({ source: "kremlin" }), true);
    assert.equal(isKremlinSource({ source: undefined }), false);
    assert.match(kremlinCardClass({ source: "kremlin" }), /kremlin-source/);
    assert.equal(kremlinCardClass({}), "");
    assert.match(kremlin, /data-testid="kremlin-badge"/);
    assert.match(kremlin, /kremlin-source/);
    assert.match(kremlin, /Кремль/);
    assert.match(kremlin, /Проверить отчёт/);
    assert.equal(plain.includes("kremlin-badge"), false);
    assert.equal(plain.includes("kremlin-source"), false);
    assert.equal(plain.includes(">Кремль<"), false);
    assert.match(plain, /Купить хлеб/);
    assert.match(badge, /kremlin-badge/);
  });

  it("is wired into task, goal and project views", () => {
    for (const file of ["tasks-view.tsx", "goals-view.tsx", "today.tsx", "more-view.tsx"]) {
      const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
      assert.match(source, /KremlinBadge/);
      assert.match(source, /kremlin-source|kremlinCardClass|kremlin-project|kremlinProjectClass/);
    }
  });
});