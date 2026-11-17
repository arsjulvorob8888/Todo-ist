/** Merge helpers for Kremlin items and the on-device `poryadok-v1` snapshot. */

export const KREMLIN_PROJECT = "Кремль";

export type Mergeable = {
  id: string;
  externalId?: string;
  updatedAt?: number;
};

export function stampOf(item: { updatedAt?: number } | undefined): number {
  const value = item?.updatedAt;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The incoming copy wins only when its stamp is strictly newer.
 * A tie, or a client item with no stamp, keeps the client's own row.
 */
export function incomingWins(
  local: { updatedAt?: number } | undefined,
  incomingUpdatedAt: number | undefined,
): boolean {
  if (!local) return true;
  const incomingAt =
    typeof incomingUpdatedAt === "number" && Number.isFinite(incomingUpdatedAt) ? incomingUpdatedAt : 0;
  return incomingAt > stampOf(local);
}

export function findIdentityIndex<T extends Mergeable>(items: readonly T[], incoming: Mergeable): number {
  const byId = items.findIndex((item) => item.id === incoming.id);
  if (byId >= 0) return byId;
  if (typeof incoming.externalId === "string" && incoming.externalId) {
    const byExternal = items.findIndex((item) => item.externalId === incoming.externalId);
    if (byExternal >= 0) return byExternal;
  }
  return -1;
}

export function findSyncIndex(
  collection: string,
  items: readonly { id: string; externalId?: string; name?: string }[],
  incoming: { id: string; externalId?: string; name?: string },
): number {
  const byIdentity = findIdentityIndex(items as Mergeable[], incoming);
  if (byIdentity >= 0) return byIdentity;
  if (collection === "boards" && incoming.name === KREMLIN_PROJECT) {
    return items.findIndex((item) => item.name === KREMLIN_PROJECT);
  }
  return -1;
}

/** Items only on one side stay. A shared id or externalId keeps the newer stamp. */
export function mergeByIdentity<T extends Mergeable>(
  clientItems: readonly T[],
  incomingItems: readonly Mergeable[],
): T[] {
  const result: T[] = clientItems.map((item) => ({ ...item }) as T);
  for (const incoming of incomingItems) {
    const index = findIdentityIndex(result, incoming);
    if (index < 0) {
      result.push({ ...incoming } as T);
      continue;
    }
    const local = result[index]!;
    if (incomingWins(local, incoming.updatedAt)) result[index] = { ...local, ...incoming } as T;
  }
  return result;
}

export function projectsIncludingKremlin(projects: readonly string[], include: boolean): string[] {
  if (!include || projects.includes(KREMLIN_PROJECT)) return [...projects];
  return [...projects, KREMLIN_PROJECT].sort((a, b) => a.localeCompare(b, "ru"));
}

export function withKremlinProjectName(payload: unknown, keep: boolean): unknown {
  if (!keep || !payload || typeof payload !== "object") return payload;
  const record = payload as { projects?: unknown };
  const projects = Array.isArray(record.projects)
    ? record.projects.filter((item): item is string => typeof item === "string")
    : [];
  return { ...record, projects: projectsIncludingKremlin(projects, true) };
}

type BoardLike = Mergeable & { name: string };
type TaskLike = Mergeable & { project?: string; projectId?: string };

/**
 * One board named «Кремль». Prefer the board the owner already had locally
 * so existing tasks keep their project id.
 */
export function collapseKremlinBoards<B extends BoardLike, T extends TaskLike>(
  boards: readonly B[],
  tasks: readonly T[],
): { boards: B[]; tasks: T[] } {
  const named = boards.filter((board) => board.name === KREMLIN_PROJECT);
  if (named.length <= 1) return { boards: [...boards], tasks: [...tasks] };
  const winner =
    named.find((board) => board.id !== "kremlin-project") ??
    named.find((board) => tasks.some((task) => task.projectId === board.id)) ??
    named[0]!;
  const drop = new Set(named.filter((board) => board.id !== winner.id).map((board) => board.id));
  return {
    boards: boards.filter((board) => !drop.has(board.id)),
    tasks: tasks.map((task) =>
      task.project === KREMLIN_PROJECT || drop.has(task.projectId ?? "")
        ? { ...task, project: KREMLIN_PROJECT, projectId: winner.id }
        : task,
    ),
  };
}

export type PoryadokLists = {
  tasks: TaskLike[];
  goals: Mergeable[];
  boards: BoardLike[];
  projects: string[];
};

/**
 * Merge a server snapshot into the client's `poryadok-v1` lists.
 * Client-only items stay. Kremlin rows match on id or externalId.
 */
export function mergePoryadokState<T extends PoryadokLists>(client: T, incoming: PoryadokLists): T {
  const tasks = mergeByIdentity(client.tasks, incoming.tasks);
  const goals = mergeByIdentity(client.goals, incoming.goals);
  const boards = mergeByIdentity(client.boards, incoming.boards);
  const collapsed = collapseKremlinBoards(boards, tasks);
  const includeKremlin =
    collapsed.boards.some((board) => board.name === KREMLIN_PROJECT) ||
    collapsed.tasks.some((task) => task.project === KREMLIN_PROJECT) ||
    incoming.projects.includes(KREMLIN_PROJECT);
  return {
    ...client,
    tasks: collapsed.tasks as T["tasks"],
    goals: goals as T["goals"],
    boards: collapsed.boards as T["boards"],
    projects: projectsIncludingKremlin(client.projects, includeKremlin),
  };
}
