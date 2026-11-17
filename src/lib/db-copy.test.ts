import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COPY_TABLES,
  planCopy,
  redact,
  upsertSql,
} from "../../scripts/db-copy-plan.mjs";

describe("db copy", () => {
  it("dry-run prints table counts and does not write", async () => {
    let writes = 0;
    let reads = 0;
    const lines = await planCopy({
      dryRun: true,
      count: async (table) => (table.key === "sync_records" ? 7 : 0),
      readRows: async () => {
        reads += 1;
        return [];
      },
      writeRow: async () => {
        writes += 1;
      },
    });
    assert.equal(reads, 0);
    assert.equal(writes, 0);
    assert.deepEqual(lines, [
      "user 0",
      "account 0",
      "session 0",
      "verification 0",
      "sync_records 7",
      "backups 0",
      "_migrations 0",
    ]);
    assert.equal(lines.join("\n").includes("postgresql://"), false);
  });

  it("upserts on the primary key so a second copy does not duplicate rows", async () => {
    const user = COPY_TABLES.find((table) => table.key === "user");
    const sync = COPY_TABLES.find((table) => table.key === "sync_records");
    assert.ok(user && sync);
    assert.match(upsertSql(user), /insert into "user"/);
    assert.match(upsertSql(user), /on conflict \("id"\) do update set/);
    assert.match(upsertSql(sync), /on conflict \("user_id", "collection", "record_id"\)/);
    assert.equal(COPY_TABLES.findIndex((table) => table.key === "user") < COPY_TABLES.findIndex((table) => table.key === "session"), true);
    assert.equal(COPY_TABLES.findIndex((table) => table.key === "user") < COPY_TABLES.findIndex((table) => table.key === "account"), true);

    const stored = new Map<string, Record<string, unknown>>();
    const rows = [
      { id: "u1", name: "старое" },
      { id: "u1", name: "новое" },
    ];
    await planCopy({
      dryRun: false,
      tables: [user],
      count: async () => 0,
      readRows: async () => rows,
      writeRow: async (table, row) => {
        const key = table.conflict.map((column) => String(row[column])).join("|");
        stored.set(`${table.key}:${key}`, row);
      },
    });
    assert.equal(stored.size, 1);
    assert.equal(stored.get("user:u1")?.name, "новое");
  });

  it("strips connection strings from errors", () => {
    const url = "postgresql://poryadok:secret@ep-cool-pooler.eu-central-1.aws.neon.tech/poryadok?sslmode=require";
    const text = redact(`connect failed ${url}`, [url]);
    assert.equal(text.includes("postgresql://"), false);
    assert.equal(text.includes("secret"), false);
    assert.match(text, /\[redacted\]/);
  });
});
