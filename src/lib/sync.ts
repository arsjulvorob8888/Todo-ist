import { useSyncExternalStore } from "react";
import { pushPull, type SyncChange } from "@/lib/sync.functions";
import { usePlanner, withGuessedCategory, type Task } from "@/lib/store";

const LISTS = ["tasks", "spans", "goals", "contacts", "ideas", "books", "boards", "labels"] as const;
const SENT_KEY = "poryadok-sync-sent";
const CURSOR_KEY = "poryadok-sync-cursor";
const USER_KEY = "poryadok-sync-user";

type Profile = {
  mission: string;
  xp: number;
  scores: Record<string, number>;
  timeCats: string[];
  projects: string[];
  routine?: { id: string; category: string; start: string; end: string }[];
  routineDone?: Record<string, string[]>;
  catProject?: Record<string, string>;
};
type Sent = Record<string, string>;
type Status = "local" | "offline" | "sync" | "ok";

let status: Status = "local";
let lastError = "";
const listeners = new Set<() => void>();
let timer = 0;
let running = false;
let started = false;

function emit(next: Status, error = "") {
  status = next;
  lastError = error;
  listeners.forEach((listener) => listener());
}

export function useSyncStatus() {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => "local" as Status,
  );
  return { status: value, error: lastError };
}

function loadSent(): Sent {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}") as Sent;
  } catch {
    return {};
  }
}

function saveSent(sent: Sent) {
  localStorage.setItem(SENT_KEY, JSON.stringify(sent));
}

function snapshot(state: ReturnType<typeof usePlanner.getState>) {
  const map = new Map<string, { collection: string; id: string; payload: unknown }>();
  for (const collection of LISTS) {
    for (const item of state[collection] as { id: string }[]) {
      if (!item?.id) continue;
      map.set(`${collection}:${item.id}`, { collection, id: item.id, payload: item });
    }
  }
  map.set("meta:profile", {
    collection: "meta",
    id: "profile",
    payload: {
      mission: state.mission,
      xp: state.xp,
      scores: state.scores,
      timeCats: state.timeCats,
      projects: state.projects,
      routine: state.routine ?? [],
      routineDone: state.routineDone ?? {},
      catProject: state.catProject ?? {},
    },
  });
  return map;
}

function changesSince(sent: Sent, state: ReturnType<typeof usePlanner.getState>): SyncChange[] {
  const now = Date.now();
  const current = snapshot(state);
  const changes: SyncChange[] = [];
  for (const [key, row] of current) {
    const json = JSON.stringify(row.payload);
    if (sent[key] !== json) {
      changes.push({ collection: row.collection, id: row.id, updatedAt: now, deleted: false, payload: row.payload });
      sent[key] = json;
    }
  }
  for (const key of Object.keys(sent)) {
    if (!current.has(key) && sent[key] !== "deleted") {
      const [collection, id] = key.split(":");
      changes.push({ collection, id, updatedAt: now, deleted: true, payload: {} });
      sent[key] = "deleted";
    }
  }
  return changes;
}

function applyRecords(records: SyncChange[]) {
  if (!records.length) return;
  const sent = loadSent();
  usePlanner.setState((state) => {
    const next = { ...state };
    const lists = Object.fromEntries(LISTS.map((name) => [name, [...(state[name] as { id: string }[])]])) as Record<
      (typeof LISTS)[number],
      { id: string }[]
    >;
    for (const record of records) {
      const key = `${record.collection}:${record.id}`;
      if (record.collection === "meta" && record.id === "profile" && !record.deleted) {
        const payload = record.payload as {
          mission: string;
          xp: number;
          scores: Record<string, number>;
          timeCats: string[];
          projects: string[];
          routine?: { id: string; category: string; start: string; end: string }[];
          routineDone?: Record<string, string[]>;
          catProject?: Record<string, string>;
        };
        next.mission = payload.mission;
        next.xp = payload.xp;
        next.scores = payload.scores;
        next.timeCats = payload.timeCats;
        next.projects = payload.projects;
        if (payload.routine) next.routine = payload.routine;
        if (payload.routineDone) next.routineDone = payload.routineDone;
        if (payload.catProject) next.catProject = payload.catProject;
        sent[key] = JSON.stringify(payload);
        continue;
      }
      if (!LISTS.includes(record.collection as (typeof LISTS)[number])) continue;
      const collection = record.collection as (typeof LISTS)[number];
      const list = lists[collection];
      const index = list.findIndex((item) => item.id === record.id);
      if (record.deleted) {
        if (index >= 0) list.splice(index, 1);
        sent[key] = "deleted";
      } else {
        const raw = JSON.stringify(record.payload);
        let payload = record.payload as { id: string };
        if (collection === "tasks") {
          const cats = next.timeCats?.length ? next.timeCats : usePlanner.getState().timeCats;
          const stamped = withGuessedCategory(payload as Task, cats);
          if (stamped !== payload) {
            if (index >= 0) list[index] = stamped;
            else list.unshift(stamped);
            sent[key] = raw;
            continue;
          }
        }
        if (index >= 0) list[index] = payload;
        else list.unshift(payload);
        sent[key] = raw;
      }
    }
    saveSent(sent);
    return { ...next, ...lists } as Partial<ReturnType<typeof usePlanner.getState>>;
  });
}

function replaceAll(records: SyncChange[]) {
  const sent: Sent = {};
  const lists = Object.fromEntries(LISTS.map((name) => [name, [] as { id: string }[]])) as Record<
    (typeof LISTS)[number],
    { id: string }[]
  >;
  let profile: Profile | null = null;
  for (const record of records) {
    const key = `${record.collection}:${record.id}`;
    if (record.deleted) {
      sent[key] = "deleted";
      continue;
    }
    if (record.collection === "meta" && record.id === "profile") {
      profile = record.payload as Profile;
      sent[key] = JSON.stringify(record.payload);
      continue;
    }
    if (!LISTS.includes(record.collection as (typeof LISTS)[number])) continue;
    const collection = record.collection as (typeof LISTS)[number];
    lists[collection].push(record.payload as { id: string });
    sent[key] = JSON.stringify(record.payload);
  }
  const cats = profile?.timeCats ?? usePlanner.getState().timeCats;
  lists.tasks = lists.tasks.map((item) => {
    const stamped = withGuessedCategory(item as Task, cats);
    if (stamped !== item) sent[`tasks:${item.id}`] = JSON.stringify(item);
    return stamped;
  });
  saveSent(sent);
  usePlanner.setState({
    ...lists,
    ...(profile
      ? {
          mission: profile.mission,
          xp: profile.xp,
          scores: profile.scores ?? {},
          timeCats: profile.timeCats ?? usePlanner.getState().timeCats,
          projects: profile.projects ?? usePlanner.getState().projects,
          routine: profile.routine ?? usePlanner.getState().routine,
          routineDone: profile.routineDone ?? usePlanner.getState().routineDone,
          catProject: profile.catProject ?? usePlanner.getState().catProject,
        }
      : {}),
  } as Partial<ReturnType<typeof usePlanner.getState>>);
}

async function currentUserId() {
  const { authClient, authEnabled } = await import("@/lib/auth/client");
  if (!authEnabled) return null;
  const session = await authClient.getSession();
  return session.data?.user?.id ?? null;
}

function rememberCursor(records: SyncChange[], since: number) {
  const newest = records.reduce((max, row) => Math.max(max, row.updatedAt), since);
  localStorage.setItem(CURSOR_KEY, String(newest || Date.now()));
}

export async function syncNow() {
  if (typeof window === "undefined" || running) return;
  if (!navigator.onLine) {
    emit("offline");
    return;
  }
  running = true;
  emit("sync");
  try {
    const userId = await currentUserId();
    if (!userId) {
      emit("local");
      return;
    }
    if (localStorage.getItem(USER_KEY) !== userId) {
      localStorage.removeItem(SENT_KEY);
      localStorage.removeItem(CURSOR_KEY);
      localStorage.setItem(USER_KEY, userId);
    }
    const first = localStorage.getItem(CURSOR_KEY) == null;
    if (first) {
      const pulled = await pushPull({ data: { since: 0, changes: [] } });
      if (pulled.records.length) {
        replaceAll(pulled.records as SyncChange[]);
        rememberCursor(pulled.records as SyncChange[], 0);
        emit("ok");
        return;
      }
    }
    const sent = loadSent();
    const changes = changesSince(sent, usePlanner.getState());
    const since = Number(localStorage.getItem(CURSOR_KEY) || 0);
    const result = await pushPull({ data: { since, changes } });
    saveSent(sent);
    applyRecords(result.records as SyncChange[]);
    rememberCursor(result.records as SyncChange[], since);
    emit("ok");
  } catch {
    emit(navigator.onLine ? "local" : "offline", "нет связи с сервером");
  } finally {
    running = false;
  }
}

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  usePlanner.subscribe(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void syncNow(), 1200);
  });
  window.addEventListener("online", () => void syncNow());
  window.addEventListener("offline", () => emit("offline"));
  window.addEventListener("focus", () => void syncNow());
  if (!navigator.onLine) emit("offline");
  void syncNow();
}
