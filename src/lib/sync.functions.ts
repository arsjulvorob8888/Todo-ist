import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { KREMLIN_PROJECT, withKremlinProjectName } from "@/lib/kremlin-merge";

const COLLECTIONS = new Set(["tasks", "spans", "goals", "contacts", "ideas", "books", "boards", "labels", "habits", "personNotes", "meta"]);

const changeSchema = z.object({
  collection: z.string().max(40),
  id: z.string().max(80),
  updatedAt: z.number().int(),
  deleted: z.boolean(),
  payload: z.unknown(),
});

const bodySchema = z.object({
  since: z.number().int().nonnegative(),
  changes: z.array(changeSchema).max(2000),
});

export type SyncChange = z.infer<typeof changeSchema>;

async function payloadForChange(
  sql: Awaited<ReturnType<typeof getSql>>,
  userId: string,
  change: { collection: string; id: string; deleted: boolean; payload: unknown },
): Promise<unknown> {
  if (change.deleted || change.collection !== "meta" || change.id !== "profile") return change.payload ?? {};
  const rows = await sql<{ payload: string }>`
    select payload from sync_records
    where user_id = ${userId} and collection = 'boards' and deleted = false
  `;
  const keep = rows.some((row) => {
    try {
      const board = JSON.parse(row.payload) as { name?: string; source?: string };
      return board.source === "kremlin" || board.name === KREMLIN_PROJECT;
    } catch {
      return false;
    }
  });
  return withKremlinProjectName(change.payload ?? {}, keep);
}

export const pushPull = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(bodySchema)
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const userId = context.userId;
    for (const change of data.changes) {
      if (!COLLECTIONS.has(change.collection)) continue;
      const payload = JSON.stringify(await payloadForChange(sql, userId, change));
      await sql`
        insert into sync_records (user_id, collection, record_id, payload, updated_at, deleted)
        values (${userId}, ${change.collection}, ${change.id}, ${payload}, ${change.updatedAt}, ${change.deleted})
        on conflict (user_id, collection, record_id) do update
        set payload = case
              when excluded.deleted and excluded.payload = '{}' then sync_records.payload
              else excluded.payload
            end,
            updated_at = excluded.updated_at,
            deleted = excluded.deleted
        where sync_records.updated_at <= excluded.updated_at
      `;
    }
    const rows = await sql<{
      collection: string;
      record_id: string;
      payload: string;
      updated_at: number | string;
      deleted: boolean;
    }>`
      select collection, record_id, payload, updated_at, deleted
      from sync_records
      where user_id = ${userId} and updated_at > ${data.since}
      order by updated_at asc
      limit 2000
    `;
    return {
      now: Date.now(),
      records: rows.map((row) => ({
        collection: row.collection,
        id: row.record_id,
        updatedAt: Number(row.updated_at),
        deleted: Boolean(row.deleted),
        payload: JSON.parse(row.payload),
      })),
    };
  });
