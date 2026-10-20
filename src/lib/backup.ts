import { usePlanner } from "@/lib/store";
import { saveBackup } from "@/lib/backup.functions";

export function backupFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `ToDO-AKA-данные-${year}-${month}-${day}.json`;
}

export const BACKUP_FILE = backupFileName();

const KEYS = [
  "mission",
  "xp",
  "sound",
  "projects",
  "boards",
  "labels",
  "timeCats",
  "catProject",
  "routine",
  "routineDone",
  "tasks",
  "spans",
  "goals",
  "contacts",
  "ideas",
  "books",
  "scores",
] as const;

type Snap = { id: string; savedAt: string; score: number; data: Record<string, unknown> };
type DirHandle = {
  name: string;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (
    name: string,
    options: { create: boolean },
  ) => Promise<{ createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }> }>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options: { mode: "readwrite"; id: string; startIn?: "documents" | "downloads" }) => Promise<DirHandle>;
  }
}

export function backupPayload() {
  const state = usePlanner.getState() as unknown as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  for (const key of KEYS) data[key] = state[key];
  return { app: "ToDO-AKA", version: 1, savedAt: new Date().toISOString(), data };
}

export function richness(data: Record<string, unknown>) {
  const list = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0);
  const mission = typeof data.mission === "string" ? data.mission : "";
  const customMission = mission && !mission.startsWith("Стать лучшей версией себя") ? 1 : 0;
  return (
    list("tasks") * 5 +
    list("spans") +
    list("goals") * 3 +
    list("contacts") +
    list("ideas") +
    list("books") +
    list("routine") +
    customMission +
    (Number(data.xp) > 0 ? 1 : 0)
  );
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("todo-aka-backup", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("snaps")) db.createObjectStore("snaps", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readSnaps() {
  const db = await openDb();
  const tx = db.transaction("snaps", "readonly");
  const request = tx.objectStore("snaps").getAll();
  const rows = await new Promise<Snap[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as Snap[]);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  return rows;
}

export async function rememberSnapshot() {
  const payload = backupPayload();
  const score = richness(payload.data);
  if (score <= 0) return;
  const db = await openDb();
  const rows = await readSnaps();
  const snap: Snap = { id: payload.savedAt, savedAt: payload.savedAt, score, data: payload.data };
  const tx = db.transaction("snaps", "readwrite");
  tx.objectStore("snaps").put(snap);
  const ranked = [...rows, snap].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  const richest = [...rows, snap].sort((a, b) => b.score - a.score || b.savedAt.localeCompare(a.savedAt))[0];
  for (const [index, row] of ranked.entries()) {
    if (index >= 20 && row.id !== richest?.id) tx.objectStore("snaps").delete(row.id);
  }
  await txDone(tx);
  await writeFolderFile(payload);
  const name = backupFileName(new Date(payload.savedAt));
  void saveBackup({ data: { name, savedAt: payload.savedAt, payload: JSON.stringify(payload) } }).catch(() => undefined);
}

export async function latestBackup() {
  const rows = await readSnaps().catch(() => []);
  return rows.sort((a, b) => b.score - a.score || b.savedAt.localeCompare(a.savedAt))[0] ?? null;
}

export async function restoreIfBlank() {
  const persist = usePlanner.persist;
  if (persist && !persist.hasHydrated()) {
    await new Promise<void>((resolve) => {
      const unsub = persist.onFinishHydration(() => {
        unsub();
        resolve();
      });
    });
  }
  const current = backupPayload().data;
  if (richness(current) > 0) return false;
  const best = await latestBackup();
  if (!best || best.score <= 0) return false;
  usePlanner.setState(best.data as Partial<ReturnType<typeof usePlanner.getState>>);
  return true;
}

export function downloadBackup() {
  const payload = backupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackupFile(file: File) {
  const parsed = JSON.parse(await file.text()) as { data?: Record<string, unknown> };
  const data = parsed.data ?? (parsed as unknown as Record<string, unknown>);
  if (!data || typeof data !== "object" || !("tasks" in data || "goals" in data || "spans" in data)) {
    throw new Error("Это не файл данных ToDO-AKA");
  }
  const next: Record<string, unknown> = {};
  for (const key of KEYS) if (key in data) next[key] = data[key];
  usePlanner.setState(next as Partial<ReturnType<typeof usePlanner.getState>>);
  await rememberSnapshot();
}

async function folderHandle() {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const request = tx.objectStore("meta").get("folder");
  const handle = await new Promise<DirHandle | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as DirHandle | undefined);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  return handle;
}

export async function backupFolderName() {
  const handle = await folderHandle().catch(() => undefined);
  return handle?.name ?? "";
}

export async function chooseBackupFolder() {
  if (!window.showDirectoryPicker) throw new Error("Этот браузер не даёт выбрать папку. Скачай файл — он ляжет в Загрузки.");
  const handle = await window.showDirectoryPicker({ mode: "readwrite", id: "todo-aka-data", startIn: "documents" });
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put(handle, "folder");
  await txDone(tx);
  await writeFolderFile(backupPayload());
  return handle.name;
}

async function writeFolderFile(payload: ReturnType<typeof backupPayload>) {
  const handle = await folderHandle().catch(() => undefined);
  if (!handle) return;
  const permission = handle.queryPermission ? await handle.queryPermission({ mode: "readwrite" }) : "granted";
  if (permission !== "granted") return;
  const file = await handle.getFileHandle(backupFileName(), { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();
}

let timer = 0;
let started = false;

export function startBackup() {
  if (started || typeof window === "undefined") return;
  started = true;
  void rememberSnapshot();
  usePlanner.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void rememberSnapshot(), 1500);
  });
}
