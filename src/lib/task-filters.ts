import { isKremlinSource } from "./kremlin-mark.ts";

export const OPEN_STATUS = "Все кроме выполнено";
export const TASK_STATUSES = [OPEN_STATUS, "Все", "В ожидании", "В процессе", "Выполнено"] as const;
export const TASK_PRIORITIES = ["Все", "Срочно", "Высокий", "Средний", "Низкий"] as const;
export const TASK_DUES = ["Все", "Просрочен", "Сегодня", "Завтра", "7 дней", "Без дедлайна"] as const;
export const TASK_SOURCES = ["Все", "Кремль", "Мои"] as const;

export type TaskSourceFilter = (typeof TASK_SOURCES)[number];

/** Same key for every task filter, including source. */
export const TASK_FILTERS_KEY = "poryadok-task-filters";

export type TaskFilterState = {
  status: string;
  priority: string;
  due: string;
  project: string;
  labelId: string;
  source: TaskSourceFilter;
};

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  status: OPEN_STATUS,
  priority: "Все",
  due: "Все",
  project: "Все",
  labelId: "Все",
  source: "Все",
};

function allowed(value: unknown, options: readonly string[], fallback: string): string {
  return typeof value === "string" && options.includes(value) ? value : fallback;
}

function freeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const clean = value.trim();
  if (!clean || clean.length > 80) return fallback;
  return value;
}

export function loadTaskFilters(storage: Pick<Storage, "getItem"> | null | undefined): TaskFilterState {
  if (!storage) return { ...DEFAULT_TASK_FILTERS };
  try {
    const raw = storage.getItem(TASK_FILTERS_KEY);
    if (!raw) return { ...DEFAULT_TASK_FILTERS };
    const parsed = JSON.parse(raw) as Partial<TaskFilterState>;
    return {
      status: allowed(parsed.status, TASK_STATUSES, DEFAULT_TASK_FILTERS.status),
      priority: allowed(parsed.priority, TASK_PRIORITIES, DEFAULT_TASK_FILTERS.priority),
      due: allowed(parsed.due, TASK_DUES, DEFAULT_TASK_FILTERS.due),
      project: freeText(parsed.project, DEFAULT_TASK_FILTERS.project),
      labelId: freeText(parsed.labelId, DEFAULT_TASK_FILTERS.labelId),
      source: allowed(parsed.source, TASK_SOURCES, DEFAULT_TASK_FILTERS.source) as TaskSourceFilter,
    };
  } catch {
    return { ...DEFAULT_TASK_FILTERS };
  }
}

export function saveTaskFilters(storage: Pick<Storage, "setItem"> | null | undefined, filters: TaskFilterState): void {
  if (!storage) return;
  try {
    storage.setItem(TASK_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* The in-memory choice still applies when storage is blocked. */
  }
}

export function matchesTaskSource(task: { source?: string; externalId?: string }, source: TaskSourceFilter): boolean {
  if (source === "Все") return true;
  const kremlin = isKremlinSource(task);
  return source === "Кремль" ? kremlin : !kremlin;
}
