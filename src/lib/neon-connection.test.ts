import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import {
  isTransientDbError,
  migrationDatabaseUrl,
  neonPoolConfig,
  parseDatabaseUrl,
} from "../../scripts/neon-connection.mjs";

const POOLED =
  "postgresql://poryadok:secret@ep-cool-pooler.eu-central-1.aws.neon.tech/poryadok?sslmode=require";
const DIRECT =
  "postgresql://poryadok:secret@ep-cool.eu-central-1.aws.neon.tech/poryadok?sslmode=require";

describe("neon pool", () => {
  it("accepts a pooled Neon URL with sslmode=require and a small pool", () => {
    const parsed = parseDatabaseUrl(POOLED);
    const config = neonPoolConfig(POOLED);
    assert.equal(parsed.pooled, true);
    assert.equal(parsed.database, "poryadok");
    assert.equal(config.host, "ep-cool-pooler.eu-central-1.aws.neon.tech");
    assert.equal(config.ssl && config.ssl.rejectUnauthorized, true);
    assert.ok(config.max <= 5);
    assert.ok(config.connectionTimeoutMillis >= 10_000);
    assert.ok(config.idleTimeoutMillis > 0);
    assert.equal(config.keepAlive, true);
    assert.equal("connectionString" in config, false);
  });

  it("uses the direct string for migrations when DATABASE_URL_UNPOOLED is set", () => {
    assert.equal(
      migrationDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT }),
      DIRECT,
    );
    assert.equal(migrationDatabaseUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: "  " }), POOLED);
    assert.equal(migrationDatabaseUrl({ DATABASE_URL: POOLED }), POOLED);
    assert.equal(parseDatabaseUrl(DIRECT).pooled, false);
  });

  it("treats a suspended compute and a dead socket as retryable", () => {
    assert.equal(isTransientDbError({ code: "57P01" }), true);
    assert.equal(isTransientDbError({ code: "ECONNRESET" }), true);
    assert.equal(isTransientDbError({ message: "Connection terminated unexpectedly" }), true);
    assert.equal(isTransientDbError({ code: "23505" }), false);
  });

  it("points Render at a dashboard Neon string and keeps migrations idempotent", () => {
    const yaml = readFileSync(new URL("../../render.yaml", import.meta.url), "utf8");
    assert.equal(yaml.includes("fromDatabase"), false);
    assert.equal(yaml.includes("databases:"), false);
    assert.equal(yaml.includes("poryadok-db"), false);
    assert.match(yaml, /- key: DATABASE_URL\n\s+sync: false/);
    assert.match(yaml, /- key: DATABASE_URL_UNPOOLED\n\s+sync: false/);

    const dir = new URL("../../migrations/", import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith(".sql"));
    assert.deepEqual(files.sort(), ["0001_auth.sql", "0002_sync.sql", "0003_backups.sql"]);
    for (const name of files) {
      const sql = readFileSync(new URL(name, dir), "utf8");
      assert.match(sql, /if not exists/i, name);
    }
    const migrate = readFileSync(new URL("../../scripts/migrate.mjs", import.meta.url), "utf8");
    assert.match(migrate, /migrationDatabaseUrl/);
    assert.match(migrate, /ON CONFLICT \(name\) DO NOTHING/);
  });
});
