import { createHash, timingSafeEqual } from "node:crypto";
import { sanitizeActionHint, sanitizeActionUrl } from "./kremlin-action.ts";
import { KREMLIN_PROJECT, projectsIncludingKremlin } from "./kremlin-merge.ts";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_ITEMS = 500;
const PRIORITIES = ["Срочно", "Высокий", "Средний", "Низкий"] as const;
const STATUSES = ["В ожидании", "В процессе", "Выполнено"] as const;

export type KremlinPriority = (typeof PRIORITIES)[number];
export type KremlinStatus = (typeof STATUSES)[number];

export type IngestKpi = {
  name: string;
  target: number | null;
  current: number;
  unit: string;
};

export type IngestTask = {
  externalId: string;
  title: string;
  priority: KremlinPriority;
  status: KremlinStatus;
  deadline: string | null;
  description: string;
  /** Present only when the payload included a usable https or grokbot URL. */
  actionUrl?: string;
  /** Present only when the payload included plain text within the length cap. */
  actionHint?: string;
};

export type IngestGoal = {
  externalId: string;
  title: string;
  description?: string;
  /** Set when the payload included `deadline` (including an explicit null). */
  deadlineProvided: boolean;
  deadline: string | null;
  kpis: IngestKpi[];
};

export type KremlinPayload = {
  source: "kremlin";
  sentAt: string;
  sentAtMs: number;
  tasks: IngestTask[];
  goals: IngestGoal[];
};

export type StoredKpi = {
  id: string;
  name: string;
  target: number | null;
  current: number;
  unit: string;
};

export type StoredTask = {
  id: string;
  externalId?: string;
  source?: "kremlin";
  title: string;
  project: string;
  projectId?: string;
  priority: KremlinPriority;
  status: KremlinStatus;
  deadline: string;
  description: string;
  created: string;
  completed: string;
  pomodoros: number;
  labelIds?: string[];
  order?: number;
  category?: string;
  actionUrl?: string;
  actionHint?: string;
  updatedAt?: number;
};

export type StoredGoal = {
  id: string;
  externalId?: string;
  source?: "kremlin";
  title: string;
  content: string;
  deadline?: string;
  done?: boolean;
  percent?: number;
  kpis?: StoredKpi[];
  updatedAt?: number;
};

export type StoredBoard = {
  id: string;
  name: string;
  color: string;
  inbox: boolean;
  source?: "kremlin";
  updatedAt?: number;
};

const KREMLIN_COLOR = "#e11d2e";

export type SlotWrite = {
  collection: "tasks" | "goals" | "boards" | "meta";
  id: string;
  payload: unknown;
  updatedAt: number;
  deleted?: boolean;
};

export type IngestSlot = {
  tasks: StoredTask[];
  goals: StoredGoal[];
  boards: StoredBoard[];
  projects: string[];
  profile: Record<string, unknown> | null;
  profileUpdatedAt: number;
};

export type IngestDeps = {
  token: string | undefined;
  /** Account email. Blank or missing means ingestion is disabled. */
  ownerEmail: string | undefined;
  resolveOwnerId: (email: string) => Promise<string | null>;
  loadSlot: (userId: string) => Promise<IngestSlot>;
  saveSlot: (userId: string, writes: SlotWrite[]) => Promise<void>;
};

export type OwnerAccount = { id: string; email: string };

/** Trimmed, lower-cased email. Empty becomes unset. */
export function normalizeOwnerEmail(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

/**
 * The owner's slot is the single `"user"` row whose email matches
 * `PORYADOK_OWNER_EMAIL`. Zero or several matches resolve to nobody,
 * so a write never falls through to another account.
 */
export function matchOwnerId(users: readonly OwnerAccount[], email: string): string | null {
  const wanted = normalizeOwnerEmail(email);
  if (!wanted) return null;
  const matches = users.filter((user) => normalizeOwnerEmail(user.email) === wanted);
  return matches.length === 1 ? matches[0]!.id : null;
}

export function emptySlot(): IngestSlot {
  return { tasks: [], goals: [], boards: [], projects: [], profile: null, profileUpdatedAt: 0 };
}

export function slotFromRecords(records: readonly SlotWrite[]): IngestSlot {
  const slot = emptySlot();
  for (const record of records) {
    if (record.deleted) continue;
    if (record.collection === "tasks") slot.tasks.push(record.payload as StoredTask);
    else if (record.collection === "goals") slot.goals.push(record.payload as StoredGoal);
    else if (record.collection === "boards") slot.boards.push(record.payload as StoredBoard);
    else if (record.collection === "meta" && record.id === "profile" && isRecord(record.payload)) {
      slot.profile = record.payload;
      slot.profileUpdatedAt = record.updatedAt;
      if (Array.isArray(record.payload.projects)) {
        slot.projects = record.payload.projects.filter((item): item is string => typeof item === "string");
      }
    }
  }
  return slot;
}

export function kremlinRecordId(kind: "task" | "goal", externalId: string): string {
  const prefix = kind === "task" ? "kremlin:" : "kgoal:";
  const raw = prefix + externalId;
  if ([...raw].length <= 80) return raw;
  const digest = createHash("sha256").update(`${kind}\0${externalId}`).digest("hex").slice(0, 32);
  return prefix + digest;
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? null;
}

/** Constant-time string compare. Length is checked without an early return before the compare. */
export function tokenMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  const length = Math.max(left.length, right.length, 1);
  const a = Buffer.alloc(length);
  const b = Buffer.alloc(length);
  left.copy(a);
  right.copy(b);
  return timingSafeEqual(a, b) && left.length === right.length;
}

export type AuthResult = "ok" | "unset" | "reject";

export function authorizeIngest(authorization: string | null, envToken: string | undefined): AuthResult {
  const expected = envToken?.trim() ?? "";
  if (!expected) return "unset";
  const provided = bearerToken(authorization);
  if (provided == null) return "reject";
  return tokenMatches(provided, expected) ? "ok" : "reject";
}

type ParseResult = { ok: true; value: KremlinPayload } | { ok: false; issues: string[] };

export function parseKremlinPayload(data: unknown): ParseResult {
  const issues: string[] = [];
  if (!isRecord(data)) return { ok: false, issues: ["body must be a JSON object"] };
  if (data.source !== "kremlin") issues.push("source must be 'kremlin'");
  if (typeof data.sentAt !== "string" || !isIsoTimestamp(data.sentAt)) issues.push("sentAt must be an ISO timestamp");
  if (!Array.isArray(data.tasks)) issues.push("tasks must be an array");
  if (!Array.isArray(data.goals)) issues.push("goals must be an array");
  if (issues.length) return { ok: false, issues };

  const tasksRaw = data.tasks as unknown[];
  const goalsRaw = data.goals as unknown[];
  if (tasksRaw.length + goalsRaw.length > MAX_ITEMS) {
    return { ok: false, issues: [`at most ${MAX_ITEMS} tasks and goals`] };
  }

  const tasks: IngestTask[] = [];
  const seenTasks = new Set<string>();
  tasksRaw.forEach((entry, index) => {
    const parsed = parseTask(entry, index);
    if (typeof parsed === "string") {
      issues.push(parsed);
      return;
    }
    if (seenTasks.has(parsed.externalId)) issues.push(`tasks[${index}].externalId is duplicated`);
    seenTasks.add(parsed.externalId);
    tasks.push(parsed);
  });

  const goals: IngestGoal[] = [];
  const seenGoals = new Set<string>();
  let kpiCount = 0;
  goalsRaw.forEach((entry, index) => {
    const parsed = parseGoal(entry, index);
    if (typeof parsed === "string") {
      issues.push(parsed);
      return;
    }
    if (seenGoals.has(parsed.externalId)) issues.push(`goals[${index}].externalId is duplicated`);
    seenGoals.add(parsed.externalId);
    kpiCount += parsed.kpis.length;
    goals.push(parsed);
  });
  if (kpiCount > MAX_ITEMS) issues.push(`at most ${MAX_ITEMS} kpis`);
  if (issues.length) return { ok: false, issues: issues.slice(0, 20) };

  return {
    ok: true,
    value: {
      source: "kremlin",
      sentAt: data.sentAt as string,
      sentAtMs: Date.parse(data.sentAt as string),
      tasks,
      goals,
    },
  };
}

export type ApplyResult = {
  slot: IngestSlot;
  writes: SlotWrite[];
  created: number;
  updated: number;
  unchanged: number;
};

/**
 * Upsert Kremlin tasks and goals into a planner slot.
 * Rows absent from the payload are left in place. A stored row with a newer
 * updatedAt is left in place as well. An omitted or rejected action field
 * does not clear one already stored on the task.
 */
export function applyKremlinIngest(slot: IngestSlot, payload: KremlinPayload): ApplyResult {
  const tasks = slot.tasks.map((task) => ({ ...task }));
  const goals = slot.goals.map((goal) => ({ ...goal }));
  const boards = slot.boards.map((board) => ({ ...board }));
  const writes: SlotWrite[] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  let board = boards.find((item) => item.name === KREMLIN_PROJECT);
  if (!board) {
    board = {
      id: "kremlin-project",
      name: KREMLIN_PROJECT,
      color: KREMLIN_COLOR,
      inbox: false,
      source: "kremlin",
      updatedAt: payload.sentAtMs,
    };
    boards.push(board);
    writes.push({ collection: "boards", id: board.id, payload: board, updatedAt: payload.sentAtMs });
  } else if (board.source !== "kremlin") {
    const stamped: StoredBoard = { ...board, source: "kremlin", color: KREMLIN_COLOR, updatedAt: payload.sentAtMs };
    const boardIndex = boards.findIndex((item) => item.id === board!.id);
    boards[boardIndex] = stamped;
    board = stamped;
    writes.push({ collection: "boards", id: stamped.id, payload: stamped, updatedAt: payload.sentAtMs });
  }

  for (const incoming of payload.tasks) {
    const id = kremlinRecordId("task", incoming.externalId);
    const index = tasks.findIndex((task) => task.externalId === incoming.externalId || task.id === id);
    const existing = index >= 0 ? tasks[index] : undefined;
    if (existing && stamp(existing) > payload.sentAtMs) {
      unchanged += 1;
      continue;
    }
    const deadline = incoming.deadline ?? "";
    const next: StoredTask = {
      id: existing?.id ?? id,
      externalId: incoming.externalId,
      source: "kremlin",
      title: incoming.title,
      project: KREMLIN_PROJECT,
      projectId: board.id,
      priority: incoming.priority,
      status: incoming.status,
      deadline,
      description: incoming.description,
      created: existing?.created ?? payload.sentAt,
      completed: completedAt(existing, incoming.status, payload.sentAt),
      pomodoros: existing?.pomodoros ?? 0,
      labelIds: existing?.labelIds ?? [],
      ...(existing?.order != null ? { order: existing.order } : {}),
      ...(existing?.category ? { category: existing.category } : {}),
      ...keptAction(incoming, existing),
      updatedAt: payload.sentAtMs,
    };
    if (!existing) {
      tasks.push(next);
      writes.push({ collection: "tasks", id: next.id, payload: next, updatedAt: payload.sentAtMs });
      created += 1;
      continue;
    }
    if (sameTask(existing, next)) {
      unchanged += 1;
      continue;
    }
    tasks[index] = next;
    writes.push({ collection: "tasks", id: next.id, payload: next, updatedAt: payload.sentAtMs });
    updated += 1;
  }

  for (const incoming of payload.goals) {
    const id = kremlinRecordId("goal", incoming.externalId);
    const index = goals.findIndex((goal) => goal.externalId === incoming.externalId || goal.id === id);
    const existing = index >= 0 ? goals[index] : undefined;
    if (existing && stamp(existing) > payload.sentAtMs) {
      unchanged += 1;
      continue;
    }
    const kpis = incoming.kpis.map((kpi, kpiIndex) => ({
      id: `kremlin-kpi:${kremlinRecordId("goal", incoming.externalId)}:${kpiIndex}`,
      name: kpi.name,
      target: kpi.target,
      current: kpi.current,
      unit: kpi.unit,
    }));
    const deadline = incoming.deadlineProvided ? (incoming.deadline ?? "") : (existing?.deadline ?? "");
    const content = incoming.description !== undefined ? incoming.description : (existing?.content ?? "");
    const next: StoredGoal = {
      id: existing?.id ?? id,
      externalId: incoming.externalId,
      source: "kremlin",
      title: incoming.title,
      content,
      deadline,
      done: existing?.done ?? false,
      percent: goalPercent(kpis, existing?.percent ?? 0),
      kpis,
      updatedAt: payload.sentAtMs,
    };
    if (!existing) {
      goals.push(next);
      writes.push({ collection: "goals", id: next.id, payload: next, updatedAt: payload.sentAtMs });
      created += 1;
      continue;
    }
    if (sameGoal(existing, next, incoming)) {
      unchanged += 1;
      continue;
    }
    goals[index] = next;
    writes.push({ collection: "goals", id: next.id, payload: next, updatedAt: payload.sentAtMs });
    updated += 1;
  }

  let projects = [...slot.projects];
  const profile = slot.profile ? { ...slot.profile } : null;
  if (profile && !projects.includes(KREMLIN_PROJECT)) {
    projects = projectsIncludingKremlin(projects, true);
    const updatedAt = Math.max(slot.profileUpdatedAt, payload.sentAtMs);
    const nextProfile = { ...profile, projects };
    writes.push({ collection: "meta", id: "profile", payload: nextProfile, updatedAt });
    return {
      slot: { tasks, goals, boards, projects, profile: nextProfile, profileUpdatedAt: updatedAt },
      writes,
      created,
      updated,
      unchanged,
    };
  }

  if (!profile && !projects.includes(KREMLIN_PROJECT)) projects = projectsIncludingKremlin(projects, true);

  return {
    slot: {
      tasks,
      goals,
      boards,
      projects,
      profile: slot.profile,
      profileUpdatedAt: slot.profileUpdatedAt,
    },
    writes,
    created,
    updated,
    unchanged,
  };
}

export async function handleKremlinIngest(request: Request, deps: IngestDeps): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const auth = authorizeIngest(request.headers.get("authorization"), deps.token);
  if (auth === "unset") return json({ ok: false, error: "ingest_disabled" }, 503);
  const ownerEmail = deps.ownerEmail?.trim() ?? "";
  if (!ownerEmail) return json({ ok: false, error: "owner_unconfigured" }, 503);
  if (auth === "reject") return json({ ok: false, error: "unauthorized" }, 401);

  const raw = await readLimitedBody(request, MAX_BODY_BYTES);
  if (raw === "too_large") return json({ ok: false, error: "invalid" }, 400);

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = parseKremlinPayload(data);
  if (!parsed.ok) return json({ ok: false, error: "invalid", issues: parsed.issues }, 400);

  try {
    const ownerId = await deps.resolveOwnerId(ownerEmail);
    if (!ownerId) return json({ ok: false, error: "owner_missing" }, 409);
    const slot = await deps.loadSlot(ownerId);
    const applied = applyKremlinIngest(slot, parsed.value);
    if (applied.writes.length) await deps.saveSlot(ownerId, applied.writes);
    return json(
      { ok: true, created: applied.created, updated: applied.updated, unchanged: applied.unchanged },
      200,
    );
  } catch {
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function readLimitedBody(request: Request, maxBytes: number): Promise<string | "too_large"> {
  const declared = request.headers.get("content-length");
  if (declared && Number.isFinite(Number(declared)) && Number(declared) > maxBytes) return "too_large";
  if (!request.body) {
    const text = await request.text();
    return byteLength(text) > maxBytes ? "too_large" : text;
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; issue: string };
type Result<T> = Ok<T> | Err;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
function err(issue: string): Err {
  return { ok: false, issue };
}

function parseTask(entry: unknown, index: string | number): IngestTask | string {
  if (!isRecord(entry)) return `tasks[${index}] must be an object`;
  const externalId = requiredId(entry.externalId, `tasks[${index}].externalId`);
  if (!externalId.ok) return externalId.issue;
  const title = requiredTitle(entry.title, `tasks[${index}].title`);
  if (!title.ok) return title.issue;
  const priority = oneOf(entry.priority, PRIORITIES, `tasks[${index}].priority`);
  if (!priority.ok) return priority.issue;
  const status = oneOf(entry.status, STATUSES, `tasks[${index}].status`);
  if (!status.ok) return status.issue;
  const deadline = requiredDeadline(entry.deadline, `tasks[${index}].deadline`);
  if (!deadline.ok) return deadline.issue;
  const description = requiredString(entry.description, `tasks[${index}].description`, 20_000);
  if (!description.ok) return description.issue;
  return {
    externalId: externalId.value,
    title: title.value,
    priority: priority.value,
    status: status.value,
    deadline: deadline.value,
    description: description.value,
    ...readAction(entry),
  };
}

function parseGoal(entry: unknown, index: number): IngestGoal | string {
  if (!isRecord(entry)) return `goals[${index}] must be an object`;
  const externalId = requiredId(entry.externalId, `goals[${index}].externalId`);
  if (!externalId.ok) return externalId.issue;
  const title = requiredTitle(entry.title, `goals[${index}].title`);
  if (!title.ok) return title.issue;
  let description: string | undefined;
  if (entry.description !== undefined) {
    const parsed = requiredString(entry.description, `goals[${index}].description`, 20_000);
    if (!parsed.ok) return parsed.issue;
    description = parsed.value;
  }
  let deadlineProvided = false;
  let deadline: string | null = null;
  if (entry.deadline !== undefined) {
    deadlineProvided = true;
    const parsed = requiredDeadline(entry.deadline, `goals[${index}].deadline`);
    if (!parsed.ok) return parsed.issue;
    deadline = parsed.value;
  }
  if (!Array.isArray(entry.kpis)) return `goals[${index}].kpis must be an array`;
  if (entry.kpis.length > MAX_ITEMS) return `goals[${index}].kpis is too long`;
  const kpis: IngestKpi[] = [];
  for (let kpiIndex = 0; kpiIndex < entry.kpis.length; kpiIndex += 1) {
    const parsed = parseKpi(entry.kpis[kpiIndex], index, kpiIndex);
    if (typeof parsed === "string") return parsed;
    kpis.push(parsed);
  }
  return {
    externalId: externalId.value,
    title: title.value,
    ...(description !== undefined ? { description } : {}),
    deadlineProvided,
    deadline,
    kpis,
  };
}

function parseKpi(entry: unknown, goalIndex: number, kpiIndex: number): IngestKpi | string {
  const label = `goals[${goalIndex}].kpis[${kpiIndex}]`;
  if (!isRecord(entry)) return `${label} must be an object`;
  const name = requiredTitle(entry.name, `${label}.name`);
  if (!name.ok) return name.issue;
  if (entry.target !== null && !isFiniteNumber(entry.target)) return `${label}.target must be a number or null`;
  if (!isFiniteNumber(entry.current)) return `${label}.current must be a number`;
  const unit = requiredString(entry.unit, `${label}.unit`, 40);
  if (!unit.ok) return unit.issue;
  return { name: name.value, target: entry.target as number | null, current: entry.current as number, unit: unit.value };
}

function requiredId(value: unknown, label: string): Result<string> {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    return err(`${label} must be a non-empty string`);
  }
  return ok(value.trim());
}

function requiredTitle(value: unknown, label: string): Result<string> {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) {
    return err(`${label} must be a non-empty string`);
  }
  return ok(value.trim());
}

function requiredString(value: unknown, label: string, max: number): Result<string> {
  if (typeof value !== "string" || value.length > max) return err(`${label} must be a string`);
  return ok(value);
}

function requiredDeadline(value: unknown, label: string): Result<string | null> {
  if (value === null) return ok(null);
  if (typeof value !== "string") return err(`${label} must be an ISO date or null`);
  const normalized = normalizeDeadline(value);
  if (!normalized) return err(`${label} must be an ISO date or null`);
  return ok(normalized);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): Result<T> {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    return err(`${label} must be one of ${allowed.join(", ")}`);
  }
  return ok(value as T);
}

function normalizeDeadline(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (value.length > 10 && Number.isNaN(Date.parse(value))) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stamp(item: { updatedAt?: number }): number {
  return typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : 0;
}

function readAction(entry: Record<string, unknown>): Pick<IngestTask, "actionUrl" | "actionHint"> {
  const actionUrl = sanitizeActionUrl(entry.actionUrl);
  const actionHint = sanitizeActionHint(entry.actionHint);
  return {
    ...(actionUrl ? { actionUrl } : {}),
    ...(actionHint ? { actionHint } : {}),
  };
}

function keptAction(incoming: IngestTask, existing: StoredTask | undefined): Pick<StoredTask, "actionUrl" | "actionHint"> {
  const actionUrl = incoming.actionUrl ?? sanitizeActionUrl(existing?.actionUrl);
  const actionHint = incoming.actionHint ?? sanitizeActionHint(existing?.actionHint);
  return {
    ...(actionUrl ? { actionUrl } : {}),
    ...(actionHint ? { actionHint } : {}),
  };
}

function completedAt(existing: StoredTask | undefined, status: KremlinStatus, sentAt: string): string {
  if (status !== "Выполнено") return "";
  if (existing?.status === "Выполнено" && existing.completed) return existing.completed;
  return sentAt;
}

function sameTask(existing: StoredTask, next: StoredTask): boolean {
  return (
    existing.title === next.title &&
    existing.priority === next.priority &&
    existing.status === next.status &&
    (existing.deadline || "") === next.deadline &&
    existing.description === next.description &&
    existing.project === next.project &&
    existing.projectId === next.projectId &&
    (existing.completed || "") === next.completed &&
    (existing.actionUrl || "") === (next.actionUrl || "") &&
    (existing.actionHint || "") === (next.actionHint || "")
  );
}

function sameGoal(existing: StoredGoal, next: StoredGoal, incoming: IngestGoal): boolean {
  if (existing.title !== next.title) return false;
  if (incoming.description !== undefined && (existing.content || "") !== next.content) return false;
  if (incoming.deadlineProvided && (existing.deadline || "") !== (next.deadline || "")) return false;
  return sameKpis(existing.kpis ?? [], next.kpis ?? []);
}

function sameKpis(left: StoredKpi[], right: StoredKpi[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((kpi, index) => {
    const other = right[index];
    return (
      other != null &&
      kpi.name === other.name &&
      kpi.target === other.target &&
      kpi.current === other.current &&
      kpi.unit === other.unit
    );
  });
}

function goalPercent(kpis: StoredKpi[], fallback: number): number {
  if (!kpis.length) return Math.round(Math.min(100, Math.max(0, fallback)));
  const total = kpis.reduce((sum, kpi) => sum + kpiShare(kpi), 0);
  return Math.round(total / kpis.length);
}

function kpiShare(kpi: StoredKpi): number {
  if (!kpi.target) return kpi.current > 0 ? 100 : 0;
  return Math.round(Math.min(100, Math.max(0, (kpi.current / kpi.target) * 100)));
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
