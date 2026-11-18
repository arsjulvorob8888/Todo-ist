// @ts-check
import pg from "pg";

/**
 * Neon connection settings shared by the app pool, Better Auth, and migrations.
 *
 * The app uses the pooled host (`-pooler`, PgBouncer). Migrations prefer the
 * optional direct string `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL`.
 */

/** @param {string | undefined} value */
export function nonempty(value) {
  const text = value?.trim();
  return text ? text : undefined;
}

/**
 * Direct string for migrations when it is set, otherwise the app string.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function migrationDatabaseUrl(env = process.env) {
  return nonempty(env.DATABASE_URL_UNPOOLED) ?? nonempty(env.DATABASE_URL) ?? "";
}

/**
 * @param {string} connectionString
 */
export function parseDatabaseUrl(connectionString) {
  const url = new URL(connectionString);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    sslmode: url.searchParams.get("sslmode") ?? "",
    pooled: url.hostname.includes("-pooler"),
  };
}

/**
 * @param {string} sslmode
 * @returns {false | { rejectUnauthorized: boolean } | undefined}
 */
export function sslOption(sslmode) {
  if (!sslmode) return undefined;
  if (sslmode === "disable") return false;
  if (sslmode === "no-verify" || sslmode === "prefer") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

/**
 * Small pool. A long connect timeout covers Neon waking from scale-to-zero.
 * Idle clients are dropped so the next query opens a fresh connection instead
 * of reusing a socket the suspended compute already closed.
 * @param {string} connectionString
 * @param {{ max?: number, applicationName?: string }} [overrides]
 */
export function neonPoolConfig(connectionString, overrides = {}) {
  const parsed = parseDatabaseUrl(connectionString);
  const sslmode = parsed.sslmode || "require";
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: sslOption(sslmode),
    max: overrides.max ?? 4,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    application_name: overrides.applicationName ?? "poryadok",
  };
}

const TRANSIENT_CODES = new Set([
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "53300",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNABORTED",
]);

/**
 * True when the compute was suspended or the socket died. One retry opens a
 * new connection, which wakes a scale-to-zero endpoint.
 * @param {{ code?: string, errno?: string, message?: string } | null | undefined} err
 */
export function isTransientDbError(err) {
  if (!err) return false;
  if (err.code && TRANSIENT_CODES.has(err.code)) return true;
  if (err.errno && TRANSIENT_CODES.has(err.errno)) return true;
  return /connection terminated|server closed the connection|timeout expired|cannot connect/i.test(
    err.message ?? "",
  );
}

/**
 * @param {string} connectionString
 * @param {{ max?: number, applicationName?: string }} [overrides]
 */
export function createNeonPool(connectionString, overrides) {
  const pool = new pg.Pool(neonPoolConfig(connectionString, overrides));
  pool.on("error", (err) => {
    const code = /** @type {{ code?: string }} */ (err).code || "error";
    console.error(`[db] postgres client dropped (${code})`);
  });
  const original = /** @type {(...args: unknown[]) => Promise<{ rows: unknown[] }>} */ (pool.query.bind(pool));
  pool.query = /** @type {typeof pool.query} */ (
    (/** @type {unknown[]} */ ...args) => {
      const pending = original(...args);
      return pending.catch((err) => {
        if (!isTransientDbError(/** @type {{ code?: string, message?: string }} */ (err))) throw err;
        return original(...args);
      });
    }
  );
  return pool;
}

/**
 * @param {import("pg").Pool} pool
 */
export async function connectWithRetry(pool) {
  try {
    return await pool.connect();
  } catch (err) {
    if (!isTransientDbError(/** @type {{ code?: string }} */ (err))) throw err;
    return pool.connect();
  }
}
