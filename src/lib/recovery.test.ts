import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Goal, Task } from "./store.ts";

const memory = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, configurable: true });
Object.defineProperty(globalThis, "window", { value: { localStorage: localStorageMock }, configurable: true });

const { usePlanner } = await import("./store.ts");
const {
  RECOVERY_FLAG,
  SIGN_IN_TASKS_MESSAGE,
  applyRecovery,
  goalsForSession,
  recoverIfEmpty,
  showSignInTasksPrompt,
  tasksForSession,
} = await import("./recovery.ts");

function blankTask(patch: Partial<Task> = {}): Task {
  return {
    id: "mine",
    title: "Своя задача",
    project: "Дом",
    priority: "Средний",
    status: "В ожидании",
    deadline: "",
    description: "",
    created: "2026-11-01T00:00:00.000Z",
    completed: "",
    pomodoros: 0,
    ...patch,
  };
}

async function hydrated() {
  if (usePlanner.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = usePlanner.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

describe("anonymous session does not receive starter tasks", { concurrency: false }, () => {
  it("leaves a blank anonymous store empty and does not consume the recovery flag", async () => {
    await hydrated();
    memory.delete(RECOVERY_FLAG);
    usePlanner.setState({ tasks: [], goals: [], spans: [], xp: 0 });
    recoverIfEmpty({ signedIn: false });

    assert.equal(memory.get(RECOVERY_FLAG) ?? null, null);
    assert.equal(usePlanner.getState().tasks.length, 0);
    assert.equal(
      usePlanner.getState().goals.some((goal) => goal.title === "Финансовая свобода"),
      false,
    );
    assert.equal(SIGN_IN_TASKS_MESSAGE, "Войдите, чтобы увидеть свои задачи");
    assert.equal(showSignInTasksPrompt({ authEnabled: true, pending: false, signedIn: false }, 0), true);
    assert.equal(showSignInTasksPrompt({ authEnabled: true, pending: true, signedIn: false }, 0), false);
    assert.equal(showSignInTasksPrompt({ authEnabled: true, pending: false, signedIn: true }, 0), false);
  });

  it("hides recovered tasks and the seeded finance goal until sign-in, without dropping a person's own rows", () => {
    const tasks = [
      blankTask({ id: "recovered-07:00-Доработать", title: "Доработать проект Todo-AKA" }),
      blankTask({ id: "user-1", title: "Позвонить маме" }),
    ];
    const goals: Goal[] = [
      { id: "mission-goal", title: "Финансовая свобода", content: "seed" },
      { id: "recovered-finance", title: "Финансовая свобода", content: "seed" },
      { id: "own-goal", title: "Финансовая свобода", content: "я сам написал" },
      { id: "other", title: "Здоровье", content: "" },
    ];

    assert.deepEqual(
      tasksForSession(tasks, { signedIn: false }).map((task) => task.id),
      ["user-1"],
    );
    assert.equal(tasksForSession(tasks, { signedIn: true }).length, 2);
    assert.deepEqual(
      goalsForSession(goals, { signedIn: false }).map((goal) => goal.id),
      ["own-goal", "other"],
    );
    assert.equal(goalsForSession(goals, { signedIn: true }).length, 4);
  });
});

describe("signed-in recovery still restores a blank device", { concurrency: false }, () => {
  it("merges the starter tasks and the finance goal once, and keeps tasks the person already has", async () => {
    await hydrated();
    memory.delete(RECOVERY_FLAG);
    const own = blankTask();
    usePlanner.setState({ tasks: [], goals: [], spans: [], labels: [], xp: 0 });
    recoverIfEmpty({ signedIn: true });

    const restored = usePlanner.getState();
    assert.equal(memory.get(RECOVERY_FLAG), "done");
    assert.ok(restored.tasks.some((task) => task.title === "Доработать проект Todo-AKA"));
    assert.ok(restored.goals.some((goal) => goal.title === "Финансовая свобода" && goal.id === "recovered-finance"));
    assert.ok(restored.xp >= 144);

    const count = restored.tasks.length;
    recoverIfEmpty({ signedIn: true });
    assert.equal(usePlanner.getState().tasks.length, count);

    const merged = applyRecovery({
      tasks: [own],
      goals: [],
      timeCats: [],
      spans: [],
      labels: [],
      xp: 10,
    });
    assert.equal(merged.tasks.filter((task) => task.id === "mine").length, 1);
    assert.ok(merged.tasks.length > 1);
    assert.equal(merged.xp, 144);
  });

  it("is only called from the shell once the session is known", () => {
    const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
    assert.match(shell, /recoverIfEmpty\(\{\s*signedIn\s*\}\)/);
    assert.equal(shell.includes("recoverIfEmpty()"), false);
  });
});
