import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DEFAULT_TASK_FILTERS,
  OPEN_STATUS,
  TASK_FILTERS_KEY,
  loadTaskFilters,
  matchesTaskSource,
  saveTaskFilters,
} from "./task-filters.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("task source filter", () => {
  const tasks = [
    { id: "kremlin-source", title: "Отчёт", source: "kremlin" as const },
    { id: "kremlin-external", title: "Сводка", externalId: "task-9" },
    { id: "both", title: "Оба", source: "kremlin" as const, externalId: "task-1" },
    { id: "mine", title: "Купить хлеб" },
    { id: "blank-external", title: "Пустой id", externalId: "  " },
  ];

  it("keeps every task on Все, Kremlin rows on Кремль, and the rest on Мои", () => {
    assert.deepEqual(
      tasks.filter((task) => matchesTaskSource(task, "Все")).map((task) => task.id),
      ["kremlin-source", "kremlin-external", "both", "mine", "blank-external"],
    );
    assert.deepEqual(
      tasks.filter((task) => matchesTaskSource(task, "Кремль")).map((task) => task.id),
      ["kremlin-source", "kremlin-external", "both"],
    );
    assert.deepEqual(
      tasks.filter((task) => matchesTaskSource(task, "Мои")).map((task) => task.id),
      ["mine", "blank-external"],
    );
  });

  it("stores the source choice in the same payload as the other task filters", () => {
    const storage = memoryStorage();
    saveTaskFilters(storage, {
      ...DEFAULT_TASK_FILTERS,
      status: "В процессе",
      priority: "Высокий",
      due: "Сегодня",
      project: "inbox",
      labelId: "call",
      source: "Кремль",
    });
    const loaded = loadTaskFilters(storage);
    assert.equal(loaded.source, "Кремль");
    assert.equal(loaded.status, "В процессе");
    assert.equal(loaded.priority, "Высокий");
    assert.equal(loaded.due, "Сегодня");
    assert.equal(loaded.project, "inbox");
    assert.equal(loaded.labelId, "call");
    assert.match(storage.getItem(TASK_FILTERS_KEY) ?? "", /"source":"Кремль"/);

    storage.setItem(TASK_FILTERS_KEY, JSON.stringify({ source: "чужой", status: "нет такого" }));
    const fallback = loadTaskFilters(storage);
    assert.equal(fallback.source, "Все");
    assert.equal(fallback.status, OPEN_STATUS);
  });

  it("is wired into the tasks page as a saved Источник filter with the Kremlin badge", () => {
    const source = readFileSync(new URL("../components/tasks-view.tsx", import.meta.url), "utf8");
    assert.match(source, /Источник/);
    assert.match(source, /data-testid="task-source-filter"/);
    assert.match(source, /matchesTaskSource/);
    assert.match(source, /saveTaskFilters/);
    assert.match(source, /loadTaskFilters/);
    assert.match(source, /KremlinBadge/);
    assert.match(source, /Войдите, чтобы увидеть свои задачи|SIGN_IN_TASKS_MESSAGE/);
  });

  it("keeps the source filter and the sign-in line above the phone navigation", () => {
    const tasks = readFileSync(new URL("../components/tasks-view.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const grid = tasks.slice(tasks.indexOf('data-testid="task-filter-grid"') - 80, tasks.indexOf('data-testid="task-filter-grid"'));
    assert.match(grid, /grid-cols-2/);
    assert.equal(grid.includes("sm:grid-cols-2"), false);
    const messageAt = tasks.indexOf('data-testid="tasks-empty"');
    const sourceAt = tasks.indexOf('data-testid="task-source-filter"');
    assert.ok(messageAt > 0 && sourceAt > messageAt);
    assert.match(shell, /app-scroll-pad/);
    assert.match(shell, /mobile-nav/);
    assert.match(css, /padding-bottom:\s*calc\(4rem\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
    assert.match(css, /\.mobile-nav\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  });
});
