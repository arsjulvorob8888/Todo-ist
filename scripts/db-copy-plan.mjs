// @ts-check
/**
 * One-time copy plan: Render Postgres → Neon.
 * Rows are upserted on the primary key, so a second run does not duplicate them.
 */

/** @typedef {{ key: string, from: string, columns: string[], conflict: string[] }} CopyTable */

/** @type {CopyTable[]} */
export const COPY_TABLES = [
  {
    key: "user",
    from: '"user"',
    columns: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt"],
    conflict: ["id"],
  },
  {
    key: "account",
    from: '"account"',
    columns: [
      "id",
      "accountId",
      "providerId",
      "userId",
      "accessToken",
      "refreshToken",
      "idToken",
      "accessTokenExpiresAt",
      "refreshTokenExpiresAt",
      "scope",
      "password",
      "createdAt",
      "updatedAt",
    ],
    conflict: ["id"],
  },
  {
    key: "session",
    from: '"session"',
    columns: ["id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId"],
    conflict: ["id"],
  },
  {
    key: "verification",
    from: '"verification"',
    columns: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
    conflict: ["id"],
  },
  {
    key: "sync_records",
    from: "sync_records",
    columns: ["user_id", "collection", "record_id", "payload", "updated_at", "deleted"],
    conflict: ["user_id", "collection", "record_id"],
  },
  {
    key: "backups",
    from: "backups",
    columns: ["user_id", "name", "saved_at", "path", "payload"],
    conflict: ["user_id", "name"],
  },
  {
    key: "_migrations",
    from: "_migrations",
    columns: ["name", "applied_at"],
    conflict: ["name"],
  },
];

/** @param {string} name */
export function quoteIdent(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** @param {CopyTable} table */
export function countSql(table) {
  return `select count(*)::int as n from ${table.from}`;
}

/** @param {CopyTable} table */
export function selectSql(table) {
  const cols = table.columns.map(quoteIdent).join(", ");
  return `select ${cols} from ${table.from}`;
}

/** @param {CopyTable} table */
export function upsertSql(table) {
  const cols = table.columns.map(quoteIdent).join(", ");
  const values = table.columns.map((_, index) => `$${index + 1}`).join(", ");
  const conflict = table.conflict.map(quoteIdent).join(", ");
  const updates = table.columns
    .filter((column) => !table.conflict.includes(column))
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`);
  const action = updates.length ? `do update set ${updates.join(", ")}` : "do nothing";
  return `insert into ${table.from} (${cols}) values (${values}) on conflict (${conflict}) ${action}`;
}

/** @param {CopyTable} table @param {Record<string, unknown>} row */
export function rowValues(table, row) {
  return table.columns.map((column) => row[column]);
}

/**
 * @param {string} text
 * @param {Array<string | undefined>} secrets
 */
export function redact(text, secrets = []) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]");
}

/**
 * @param {string} key
 * @param {number} count
 */
export function formatCount(key, count) {
  return `${key} ${count}`;
}

/**
 * @param {{
 *   dryRun: boolean,
 *   tables?: CopyTable[],
 *   count: (table: CopyTable) => Promise<number>,
 *   readRows?: (table: CopyTable) => Promise<Array<Record<string, unknown>>>,
 *   writeRow?: (table: CopyTable, row: Record<string, unknown>) => Promise<void>,
 * }} options
 */
export async function planCopy(options) {
  const tables = options.tables ?? COPY_TABLES;
  /** @type {string[]} */
  const lines = [];
  for (const table of tables) {
    if (options.dryRun) {
      lines.push(formatCount(table.key, await options.count(table)));
      continue;
    }
    if (!options.readRows || !options.writeRow) {
      throw new Error("copy needs readRows and writeRow");
    }
    const rows = await options.readRows(table);
    let written = 0;
    for (const row of rows) {
      await options.writeRow(table, row);
      written += 1;
    }
    lines.push(formatCount(table.key, written));
  }
  return lines;
}
