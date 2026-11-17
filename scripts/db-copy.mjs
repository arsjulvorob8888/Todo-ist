#!/usr/bin/env node
/**
 * One-time copy SOURCE_DATABASE_URL → TARGET_DATABASE_URL.
 *
 * Upserts on each table's primary key, so running it twice does not duplicate rows.
 * `--dry-run` prints row counts per table and writes nothing.
 * Connection strings are never printed.
 */
import { countSql, planCopy, redact, rowValues, selectSql, upsertSql } from "./db-copy-plan.mjs";
import { connectWithRetry, createNeonPool } from "./neon-connection.mjs";

const dryRun = process.argv.includes("--dry-run");
const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim() ?? "";
const targetUrl = process.env.TARGET_DATABASE_URL?.trim() ?? "";

if (!sourceUrl || (!dryRun && !targetUrl)) {
  console.error(
    "Задайте SOURCE_DATABASE_URL. Для записи ещё нужен TARGET_DATABASE_URL. --dry-run только считает строки и ничего не пишет.",
  );
  process.exit(1);
}

/** @param {import("pg").PoolClient} client @param {string} text @param {unknown[]} [params] */
async function query(client, text, params = []) {
  try {
    return await client.query(text, params);
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    if (code !== "42P01") throw err;
    return { rows: [{ n: 0 }] };
  }
}

async function main() {
  const source = await createNeonPool(sourceUrl, { max: 1, applicationName: "poryadok-copy-source" });
  const target = dryRun
    ? null
    : await createNeonPool(targetUrl, { max: 1, applicationName: "poryadok-copy-target" });
  const sourceClient = await connectWithRetry(source);
  const targetClient = target ? await connectWithRetry(target) : null;
  try {
    const lines = await planCopy({
      dryRun,
      count: async (table) => {
        const result = await query(sourceClient, countSql(table));
        return Number(result.rows[0]?.n ?? 0);
      },
      readRows: async (table) => {
        try {
          const result = await sourceClient.query(selectSql(table));
          return result.rows;
        } catch (err) {
          if (/** @type {{ code?: string }} */ (err).code === "42P01") return [];
          throw err;
        }
      },
      writeRow: async (table, row) => {
        if (!targetClient) return;
        await targetClient.query(upsertSql(table), rowValues(table, row));
      },
    });
    for (const line of lines) console.log(line);
  } finally {
    sourceClient.release();
    targetClient?.release();
    await source.end();
    await target?.end();
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(redact(message, [sourceUrl, targetUrl]));
  process.exit(1);
});
