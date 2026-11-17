import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KremlinAction, KremlinBadge, KremlinCard, isKremlinSource, kremlinCardClass } from "./kremlin-mark.ts";

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

  it("renders Решить as text and attributes, with the grokbot address and hint beneath", () => {
    const https = renderToStaticMarkup(
      createElement(KremlinAction, {
        source: "kremlin",
        actionUrl: "https://example.com/solve?a=1&b=2",
        actionHint: "<img src=x onerror=alert(1)>",
      }),
    );
    assert.match(https, /data-testid="kremlin-action"/);
    assert.match(https, /href="https:\/\/example.com\/solve\?a=1&amp;b=2"/);
    assert.match(https, /target="_blank"/);
    assert.match(https, /rel="noopener noreferrer"/);
    assert.match(https, />Решить</);
    assert.equal(https.includes("kremlin-action-url"), false);
    assert.equal(https.includes("kremlin-action-hint"), false);
    assert.equal(https.includes("<img"), false);
    assert.equal(https.includes("<script"), false);

    const bot = renderToStaticMarkup(
      createElement(KremlinAction, {
        source: "kremlin",
        actionUrl: "grokbot://task/42",
        actionHint: '<img src=x onerror="alert(1)">',
      }),
    );
    assert.match(bot, /href="grokbot:\/\/task\/42"/);
    assert.equal(bot.includes("target="), false);
    assert.equal(bot.includes("rel="), false);
    assert.match(bot, /data-testid="kremlin-action-url"/);
    assert.match(bot, />grokbot:\/\/task\/42</);
    assert.match(bot, /data-testid="kremlin-action-hint"/);
    assert.match(bot, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.equal(bot.includes("<img"), false);
    assert.equal(bot.includes("<script"), false);

    const card = renderToStaticMarkup(
      createElement(KremlinCard, {
        source: "kremlin",
        title: "Проверить отчёт",
        actionUrl: "https://example.com/solve",
      }),
    );
    assert.match(card, /data-testid="kremlin-badge"/);
    assert.match(card, /data-testid="kremlin-action"/);
    assert.match(card, /Проверить отчёт/);

    const plain = renderToStaticMarkup(
      createElement(KremlinAction, { source: undefined, actionUrl: "https://example.com/solve" }),
    );
    const missing = renderToStaticMarkup(createElement(KremlinAction, { source: "kremlin" }));
    const hostile = renderToStaticMarkup(
      createElement(KremlinAction, {
        source: "kremlin",
        actionUrl: 'javascript:alert(1)"><script>alert(1)</script>',
        actionHint: "<script>alert(1)</script>",
      }),
    );
    assert.equal(plain, "");
    assert.equal(missing, "");
    assert.equal(hostile, "");
  });

  it("is wired into task, goal and project views", () => {
    for (const file of ["tasks-view.tsx", "goals-view.tsx", "today.tsx", "more-view.tsx"]) {
      const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
      assert.match(source, /KremlinBadge/);
      assert.match(source, /kremlin-source|kremlinCardClass|kremlin-project|kremlinProjectClass/);
    }
    for (const file of ["tasks-view.tsx", "today.tsx"]) {
      const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
      assert.match(source, /KremlinAction/);
    }
    const tasks = readFileSync(new URL("../components/tasks-view.tsx", import.meta.url), "utf8");
    assert.equal(tasks.match(/<KremlinAction /g)?.length, 2);
  });
});
