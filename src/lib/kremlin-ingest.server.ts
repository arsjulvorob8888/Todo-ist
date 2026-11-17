import { getSql } from "@/lib/db";
import {
  handleKremlinIngest,
  matchOwnerId,
  normalizeOwnerEmail,
  slotFromRecords,
  type IngestDeps,
  type SlotWrite,
} from "@/lib/kremlin-ingest";

/**
 * Resolve the single account whose email matches `PORYADOK_OWNER_EMAIL`.
 * No match, or more than one, returns null. This never picks a shared,
 * anonymous, or first-user slot.
 */
export async function resolveOwnerUserId(email: string): Promise<string | null> {
  const normalized = normalizeOwnerEmail(email);
  if (!normalized) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string }>`
    select "id", "email" from "user" where lower(trim("email")) = ${normalized}
  `;
  return matchOwnerId(rows, normalized);
}

async function loadSlot(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    collection: string;
    record_id: string;
    payload: string;
    updated_at: number | string;
    deleted: boolean;
  }>`
    select collection, record_id, payload, updated_at, deleted
    from sync_records
    where user_id = ${userId}
      and collection in ('tasks', 'goals', 'boards', 'meta')
  `;
  const records: SlotWrite[] = [];
  for (const row of rows) {
    if (row.collection === "meta" && row.record_id !== "profile") continue;
    let payload: unknown = {};
    try {
      payload = JSON.parse(row.payload);
    } catch {
      payload = {};
    }
    const collection = row.collection;
    if (collection !== "tasks" && collection !== "goals" && collection !== "boards" && collection !== "meta") {
      continue;
    }
    records.push({
      collection,
      id: row.record_id,
      payload,
      updatedAt: Number(row.updated_at),
      deleted: Boolean(row.deleted),
    });
  }
  return slotFromRecords(records);
}

async function saveSlot(userId: string, writes: SlotWrite[]) {
  const sql = await getSql();
  for (const write of writes) {
    const payload = JSON.stringify(write.payload ?? {});
    const deleted = Boolean(write.deleted);
    await sql`
      insert into sync_records (user_id, collection, record_id, payload, updated_at, deleted)
      values (${userId}, ${write.collection}, ${write.id}, ${payload}, ${write.updatedAt}, ${deleted})
      on conflict (user_id, collection, record_id) do update
      set payload = excluded.payload,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted
      where sync_records.updated_at <= excluded.updated_at
    `;
  }
}

export function kremlinIngestDeps(
  token = process.env.PORYADOK_INGEST_TOKEN,
  ownerEmail = process.env.PORYADOK_OWNER_EMAIL,
): IngestDeps {
  const trimmedToken = token?.trim();
  const trimmedEmail = ownerEmail?.trim();
  return {
    token: trimmedToken ? trimmedToken : undefined,
    ownerEmail: trimmedEmail ? trimmedEmail : undefined,
    resolveOwnerId: resolveOwnerUserId,
    loadSlot,
    saveSlot,
  };
}

export function postKremlinIngest(request: Request): Promise<Response> {
  return handleKremlinIngest(request, kremlinIngestDeps());
}
