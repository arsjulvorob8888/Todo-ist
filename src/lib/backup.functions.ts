import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
}

export function backupFolderFor(userId: string) {
  return join(process.cwd(), "data", "backups", safeId(userId));
}

const bodySchema = z.object({
  name: z.string().regex(/^ToDO-AKA-данные-\d{4}-\d{2}-\d{2}\.json$/),
  savedAt: z.string().max(40),
  payload: z.string().max(8_000_000),
});

export const backupLocation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const folder = backupFolderFor(context.userId);
    return { folder, userId: context.userId };
  });

export const saveBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(bodySchema)
  .handler(async ({ data, context }) => {
    const folder = backupFolderFor(context.userId);
    const path = join(folder, data.name);
    await mkdir(folder, { recursive: true });
    await writeFile(path, data.payload);
    const sql = await getSql();
    await sql`
      insert into backups (user_id, name, saved_at, path, payload)
      values (${context.userId}, ${data.name}, ${data.savedAt}, ${path}, ${data.payload})
      on conflict (user_id, name) do update
      set saved_at = excluded.saved_at,
          path = excluded.path,
          payload = excluded.payload
    `;
    return { folder, path };
  });
