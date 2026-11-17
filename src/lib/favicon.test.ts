import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { faviconResponse } from "./favicon.ts";

describe("favicon", () => {
  it("GET /favicon.ico returns 200 with the existing app icon", async () => {
    const svg = readFileSync(new URL("../../public/favicon.svg", import.meta.url), "utf8");
    const response = faviconResponse();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
    const body = await response.text();
    assert.equal(body, svg);
    assert.match(body, /<svg/);
    assert.match(body, /#e8a317/);

    const route = readFileSync(new URL("../routes/favicon[.]ico.ts", import.meta.url), "utf8");
    assert.match(route, /createFileRoute\("\/favicon\.ico"\)/);
    assert.match(route, /faviconResponse/);
  });
});
