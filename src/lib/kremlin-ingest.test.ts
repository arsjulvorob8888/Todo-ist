import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergePoryadokState } from "./kremlin-merge.ts";
import {
  applyKremlinIngest,
  authorizeIngest,
  emptySlot,
  handleKremlinIngest,
  matchOwnerId,
  parseKremlinPayload,
  slotFromRecords,
  tokenMatches,
  type IngestDeps,
  type IngestSlot,
  type SlotWrite,
  type StoredTask,
} from "./kremlin-ingest.ts";

const TOKEN = "test-ingest-token";
const OWNER_EMAIL = "owner@example.com";
const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";

function task(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "task-1",
    title: "Проверить отчёт",
    priority: "Высокий",
    status: "В ожидании",
    deadline: "2026-12-01",
    description: "Сверить цифры",
    ...overrides,
  };
}

function goal(overrides: Record<string, unknown> = {}) {
  return {
    externalId: "goal-1",
    title: "Закрыть квартал",
    description: "Без дыр в отчёте",
    deadline: "2026-12-31",
    kpis: [{ name: "Выручка", target: 100, current: 40, unit: "млн" }],
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    source: "kremlin",
    sentAt: "2026-11-17T10:00:00.000Z",
    tasks: [task()],
    goals: [goal()],
    ...overrides,
  };
}

function request(body: unknown, token: string | null = TOKEN, extra?: { bytes?: number }) {
  const raw = extra?.bytes ? "x".repeat(extra.bytes) : JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  if (token != null) headers.set("authorization", `Bearer ${token}`);
  if (extra?.bytes) headers.set("content-length", String(extra.bytes));
  return new Request("https://poryadok-1xfe.onrender.com/api/integrations/kremlin", {
    method: "POST",
    headers,
    body: raw,
  });
}

function memoryDeps(options: { token?: string | undefined; ownerEmail?: string | undefined; users?: Record<string, string> } = {}) {
  const records = new Map<string, SlotWrite>();
  const token = "token" in options ? options.token : TOKEN;
  const ownerEmail = "ownerEmail" in options ? options.ownerEmail : `  ${OWNER_EMAIL.toUpperCase()}  `;
  const users = options.users ?? { "Owner@Example.com": OWNER_ID };
  const deps: IngestDeps = {
    token,
    ownerEmail,
    resolveOwnerId: async (email) =>
      matchOwnerId(
        Object.entries(users).map(([emailAddress, id]) => ({ id, email: emailAddress })),
        email,
      ),
    loadSlot: async (userId) =>
      slotFromRecords(
        [...records.entries()].filter(([key]) => key.startsWith(`${userId}:`)).map(([, write]) => write),
      ),
    saveSlot: async (userId, writes) => {
      for (const write of writes) records.set(`${userId}:${write.collection}:${write.id}`, write);
    },
  };
  return { deps, records };
}

function localTask(overrides: Partial<StoredTask> = {}): StoredTask {
  return {
    id: "local-1",
    title: "Своя задача",
    project: "Дом",
    projectId: "home",
    priority: "Низкий",
    status: "В процессе",
    deadline: "",
    description: "не из Кремля",
    created: "2026-01-01T00:00:00.000Z",
    completed: "",
    pomodoros: 3,
    updatedAt: 50,
    ...overrides,
  };
}

describe("authorizeIngest", () => {
  it("returns 503 when the env token is unset and does not compare a provided secret", async () => {
    const store = memoryDeps({ token: undefined });
    const response = await handleKremlinIngest(request(payload(), "anything"), store.deps);
    assert.equal(response.status, 503);
    assert.equal(store.records.size, 0);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, false);
  });

  it("returns 503 for a blank env token", () => {
    assert.equal(authorizeIngest("Bearer secret", "   "), "unset");
  });

  it("returns 401 when the header is missing or the token does not match", async () => {
    const missing = await handleKremlinIngest(request(payload(), null), memoryDeps().deps);
    assert.equal(missing.status, 401);
    const wrong = await handleKremlinIngest(request(payload(), "nope"), memoryDeps().deps);
    assert.equal(wrong.status, 401);
    const differentLength = await handleKremlinIngest(request(payload(), "x"), memoryDeps().deps);
    assert.equal(differentLength.status, 401);
    assert.equal(tokenMatches("short", TOKEN), false);
    assert.equal(tokenMatches(TOKEN, TOKEN), true);
  });

  it("returns 200 for the matching bearer token", async () => {
    const store = memoryDeps();
    const response = await handleKremlinIngest(request(payload()), store.deps);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; created: number; updated: number; unchanged: number };
    assert.deepEqual(body, { ok: true, created: 2, updated: 0, unchanged: 0 });
  });
});

describe("validation", () => {
  it("returns 400 for invalid JSON, bad fields, duplicates, and an oversized body", async () => {
    const store = memoryDeps();
    const invalidJson = await handleKremlinIngest(
      new Request("https://poryadok.example/api/integrations/kremlin", {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: "{",
      }),
      store.deps,
    );
    assert.equal(invalidJson.status, 400);

    const badPriority = parseKremlinPayload(payload({ tasks: [task({ priority: "urgent" })] }));
    assert.equal(badPriority.ok, false);

    const badStatus = parseKremlinPayload(payload({ tasks: [task({ status: "done" })] }));
    assert.equal(badStatus.ok, false);

    const badDeadline = parseKremlinPayload(payload({ tasks: [task({ deadline: "tomorrow" })] }));
    assert.equal(badDeadline.ok, false);

    const missingDescription = parseKremlinPayload(payload({ tasks: [task({ description: 1 })] }));
    assert.equal(missingDescription.ok, false);

    const duplicate = parseKremlinPayload(payload({ tasks: [task(), task()] }));
    assert.equal(duplicate.ok, false);

    const badGoalDeadline = parseKremlinPayload(payload({ goals: [goal({ deadline: "nope" })] }));
    assert.equal(badGoalDeadline.ok, false);

    const tooMany = parseKremlinPayload(payload({ tasks: Array.from({ length: 501 }, (_, i) => task({ externalId: `t-${i}` })), goals: [] }));
    assert.equal(tooMany.ok, false);

    const huge = await handleKremlinIngest(request(payload(), TOKEN, { bytes: 256 * 1024 + 1 }), store.deps);
    assert.equal(huge.status, 400);
    assert.equal(store.records.size, 0);
  });

  it("keeps a usable actionUrl and actionHint and drops anything else", () => {
    const https = "https://example.com/" + "a".repeat(500 - "https://example.com/".length);
    assert.equal(https.length, 500);
    const hint = "я".repeat(200);
    const accepted = parseKremlinPayload(
      payload({
        tasks: [
          task({
            actionUrl: `  ${https}  `,
            actionHint: `  ${hint}  `,
          }),
        ],
      }),
    );
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.equal(accepted.value.tasks[0]?.actionUrl, https);
      assert.equal(accepted.value.tasks[0]?.actionHint, hint);
    }

    const upper = parseKremlinPayload(
      payload({ tasks: [task({ actionUrl: "HTTPS://Example.COM/Report" })] }),
    );
    assert.equal(upper.ok, true);
    if (upper.ok) assert.equal(upper.value.tasks[0]?.actionUrl, "HTTPS://Example.COM/Report");

    const bot = parseKremlinPayload(
      payload({ tasks: [task({ actionUrl: "grokbot://task/42", actionHint: "<b>не html</b>" })] }),
    );
    assert.equal(bot.ok, true);
    if (bot.ok) {
      assert.equal(bot.value.tasks[0]?.actionUrl, "grokbot://task/42");
      assert.equal(bot.value.tasks[0]?.actionHint, "<b>не html</b>");
    }

    const dropped = [
      "http://example.com/report",
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://",
      "https:///",
      "https:example.com",
      "https://example.com/a b",
      'https://example.com/"><script>',
      "grokbot://",
      https + "b",
      12,
      { href: "https://example.com" },
    ];
    for (const actionUrl of dropped) {
      const parsed = parseKremlinPayload(payload({ tasks: [task({ actionUrl, title: "Жива" })] }));
      assert.equal(parsed.ok, true, `payload stayed valid for ${String(actionUrl)}`);
      if (parsed.ok) {
        assert.equal(parsed.value.tasks[0]?.actionUrl, undefined);
        assert.equal(parsed.value.tasks[0]?.title, "Жива");
      }
    }

    const longHint = parseKremlinPayload(payload({ tasks: [task({ actionHint: `${hint}!` })] }));
    assert.equal(longHint.ok, true);
    if (longHint.ok) assert.equal(longHint.value.tasks[0]?.actionHint, undefined);

    const badHint = parseKremlinPayload(
      payload({ tasks: [task({ actionHint: { text: "нет" } })] }),
    );
    assert.equal(badHint.ok, true);
    if (badHint.ok) assert.equal(badHint.value.tasks[0]?.actionHint, undefined);
  });

  it("accepts a goal with no deadline and a null deadline", () => {
    const omitted = parseKremlinPayload(payload({ goals: [goal({ deadline: undefined })] }));
    assert.equal(omitted.ok, true);
    if (omitted.ok) assert.equal(omitted.value.goals[0]?.deadlineProvided, false);
    const cleared = parseKremlinPayload(payload({ goals: [goal({ deadline: null })] }));
    assert.equal(cleared.ok, true);
    if (cleared.ok) {
      assert.equal(cleared.value.goals[0]?.deadlineProvided, true);
      assert.equal(cleared.value.goals[0]?.deadline, null);
    }
  });
});

describe("upsert", () => {
  it("creates the Кремль project once and does not duplicate items on a second post", async () => {
    const store = memoryDeps();
    const first = await handleKremlinIngest(request(payload()), store.deps);
    assert.equal(first.status, 200);
    const second = await handleKremlinIngest(request(payload()), store.deps);
    const body = (await second.json()) as { created: number; updated: number; unchanged: number };
    assert.deepEqual(body, { ok: true, created: 0, updated: 0, unchanged: 2 });

    const slot = store.deps.loadSlot(OWNER_ID);
    const loaded = await slot;
    assert.equal(loaded.tasks.length, 1);
    assert.equal(loaded.goals.length, 1);
    assert.equal(loaded.boards.filter((board) => board.name === "Кремль").length, 1);
    assert.equal(loaded.tasks[0]?.project, "Кремль");
    assert.equal(loaded.tasks[0]?.projectId, "kremlin-project");
    assert.equal(loaded.tasks[0]?.source, "kremlin");
    assert.equal(loaded.goals[0]?.source, "kremlin");
    assert.equal(loaded.boards.find((board) => board.name === "Кремль")?.source, "kremlin");
  });

  it("reuses an existing Кремль project and updates fields in place", () => {
    const slot: IngestSlot = {
      ...emptySlot(),
      boards: [{ id: "board-existing", name: "Кремль", color: "#111111", inbox: false }],
      projects: ["Дом", "Кремль"],
      tasks: [],
    };
    const created = applyKremlinIngest(slot, mustParse(payload({ goals: [] })));
    assert.equal(created.created, 1);
    assert.equal(created.slot.boards.filter((board) => board.name === "Кремль").length, 1);
    assert.equal(created.slot.tasks[0]?.projectId, "board-existing");
    assert.equal(created.slot.boards.find((board) => board.name === "Кремль")?.source, "kremlin");

    const changed = applyKremlinIngest(
      created.slot,
      mustParse(
        payload({
          sentAt: "2026-11-17T12:00:00.000Z",
          tasks: [task({ title: "Новый заголовок", status: "Выполнено", deadline: null, priority: "Срочно" })],
          goals: [],
        }),
      ),
    );
    assert.equal(changed.updated, 1);
    assert.equal(changed.slot.tasks.length, 1);
    assert.equal(changed.slot.tasks[0]?.title, "Новый заголовок");
    assert.equal(changed.slot.tasks[0]?.status, "Выполнено");
    assert.equal(changed.slot.tasks[0]?.deadline, "");
    assert.equal(changed.slot.tasks[0]?.priority, "Срочно");
    assert.equal(changed.slot.tasks[0]?.id, created.slot.tasks[0]?.id);
  });

  it("leaves rows that are not in the payload untouched", () => {
    const slot: IngestSlot = {
      ...emptySlot(),
      tasks: [localTask()],
      goals: [{ id: "local-goal", title: "Своя цель", content: "оставить", updatedAt: 10 }],
      projects: ["Дом"],
    };
    const applied = applyKremlinIngest(slot, mustParse(payload()));
    assert.equal(applied.slot.tasks.length, 2);
    assert.equal(applied.slot.goals.length, 2);
    assert.equal(applied.slot.tasks.find((item) => item.id === "local-1")?.title, "Своя задача");
    assert.equal(applied.slot.goals.find((item) => item.id === "local-goal")?.content, "оставить");
    assert.equal(applied.slot.tasks.find((item) => item.id === "local-1")?.pomodoros, 3);
  });

  it("does not clobber a newer owner edit", () => {
    const seeded = applyKremlinIngest(emptySlot(), mustParse(payload({ goals: [] })));
    const edited: IngestSlot = {
      ...seeded.slot,
      tasks: seeded.slot.tasks.map((item) => ({
        ...item,
        title: "Правка владельца",
        pomodoros: 4,
        updatedAt: Date.parse("2026-11-17T18:00:00.000Z"),
      })),
    };
    const applied = applyKremlinIngest(
      edited,
      mustParse(payload({ sentAt: "2026-11-17T11:00:00.000Z", tasks: [task({ title: "Старое" })], goals: [] })),
    );
    assert.equal(applied.unchanged, 1);
    assert.equal(applied.writes.some((write) => write.collection === "tasks"), false);
    assert.equal(applied.slot.tasks[0]?.title, "Правка владельца");
    assert.equal(applied.slot.tasks[0]?.pomodoros, 4);
  });
});

describe("goals", () => {
  it("stores kpis and an optional deadline, and updates them without dropping the goal", () => {
    const created = applyKremlinIngest(emptySlot(), mustParse(payload({ tasks: [] })));
    const stored = created.slot.goals[0];
    assert.equal(stored?.deadline, "2026-12-31");
    assert.equal(stored?.kpis?.length, 1);
    assert.equal(stored?.kpis?.[0]?.name, "Выручка");
    assert.equal(stored?.kpis?.[0]?.target, 100);
    assert.equal(stored?.kpis?.[0]?.current, 40);
    assert.equal(stored?.kpis?.[0]?.unit, "млн");
    assert.equal(stored?.content, "Без дыр в отчёте");

    const updated = applyKremlinIngest(
      created.slot,
      mustParse(
        payload({
          sentAt: "2026-11-18T10:00:00.000Z",
          tasks: [],
          goals: [
            goal({
              description: undefined,
              deadline: null,
              kpis: [{ name: "Выручка", target: null, current: 80, unit: "млн" }],
            }),
          ],
        }),
      ),
    );
    assert.equal(updated.updated, 1);
    assert.equal(updated.slot.goals.length, 1);
    assert.equal(updated.slot.goals[0]?.content, "Без дыр в отчёте");
    assert.equal(updated.slot.goals[0]?.deadline, "");
    assert.equal(updated.slot.goals[0]?.kpis?.[0]?.target, null);
    assert.equal(updated.slot.goals[0]?.kpis?.[0]?.current, 80);

    const keptDeadline = applyKremlinIngest(
      {
        ...updated.slot,
        goals: updated.slot.goals.map((item) => ({ ...item, deadline: "2027-01-15" })),
      },
      mustParse(
        payload({
          sentAt: "2026-11-19T10:00:00.000Z",
          tasks: [],
          goals: [goal({ deadline: undefined, description: "уточнение", kpis: [{ name: "Выручка", target: null, current: 80, unit: "млн" }] })],
        }),
      ),
    );
    assert.equal(keptDeadline.slot.goals[0]?.deadline, "2027-01-15");
    assert.equal(keptDeadline.slot.goals[0]?.content, "уточнение");
  });
});

describe("action fields", () => {
  it("stores them, replaces them when the payload is newer, and does not delete them when a later payload omits them", () => {
    const sibling: StoredTask = {
      ...localTask({
        id: "kremlin:task-keep",
        externalId: "task-keep",
        title: "Оставить",
        project: "Кремль",
        source: "kremlin",
        actionUrl: "https://keep.example/a",
        actionHint: "не трогать",
      }),
    };
    const created = applyKremlinIngest(
      { ...emptySlot(), tasks: [localTask(), sibling] },
      mustParse(
        payload({
          goals: [],
          tasks: [
            task({ actionUrl: "https://example.com/solve", actionHint: "Сверить в браузере" }),
          ],
        }),
      ),
    );
    assert.equal(created.created, 1);
    const stored = created.slot.tasks.find((item) => item.externalId === "task-1");
    assert.equal(stored?.actionUrl, "https://example.com/solve");
    assert.equal(stored?.actionHint, "Сверить в браузере");
    assert.equal(created.slot.tasks.find((item) => item.id === "local-1")?.title, "Своя задача");
    assert.equal(
      created.slot.tasks.find((item) => item.externalId === "task-keep")?.actionUrl,
      "https://keep.example/a",
    );

    const replaced = applyKremlinIngest(
      created.slot,
      mustParse(
        payload({
          sentAt: "2026-11-17T12:00:00.000Z",
          goals: [],
          tasks: [task({ actionUrl: "grokbot://task/9", actionHint: "В боте" })],
        }),
      ),
    );
    assert.equal(replaced.updated, 1);
    assert.equal(
      replaced.slot.tasks.find((item) => item.externalId === "task-1")?.actionUrl,
      "grokbot://task/9",
    );
    assert.equal(
      replaced.slot.tasks.find((item) => item.externalId === "task-1")?.actionHint,
      "В боте",
    );
    assert.equal(
      replaced.slot.tasks.find((item) => item.externalId === "task-keep")?.actionHint,
      "не трогать",
    );

    const kept = applyKremlinIngest(
      replaced.slot,
      mustParse(
        payload({
          sentAt: "2026-11-17T13:00:00.000Z",
          goals: [],
          tasks: [task({ title: "Новый заголовок" })],
        }),
      ),
    );
    assert.equal(kept.slot.tasks.filter((item) => item.externalId === "task-1").length, 1);
    const afterOmit = kept.slot.tasks.find((item) => item.externalId === "task-1");
    assert.equal(afterOmit?.title, "Новый заголовок");
    assert.equal(afterOmit?.actionUrl, "grokbot://task/9");
    assert.equal(afterOmit?.actionHint, "В боте");
    assert.equal(kept.slot.tasks.find((item) => item.id === "local-1")?.title, "Своя задача");

    const stale = applyKremlinIngest(
      kept.slot,
      mustParse(
        payload({
          sentAt: "2026-11-17T11:00:00.000Z",
          goals: [],
          tasks: [
            task({
              actionUrl: "https://stale.example/x",
              title: "Старое",
              actionHint: "старая подсказка",
            }),
          ],
        }),
      ),
    );
    assert.equal(stale.unchanged, 1);
    assert.equal(
      stale.writes.some((write) => write.collection === "tasks" && write.id === afterOmit?.id),
      false,
    );
    assert.equal(
      stale.slot.tasks.find((item) => item.externalId === "task-1")?.title,
      "Новый заголовок",
    );
    assert.equal(
      stale.slot.tasks.find((item) => item.externalId === "task-1")?.actionUrl,
      "grokbot://task/9",
    );
  });

  it("drops an invalid actionUrl instead of replacing a stored one", () => {
    const created = applyKremlinIngest(
      emptySlot(),
      mustParse(
        payload({
          goals: [],
          tasks: [task({ actionUrl: "https://example.com/solve", actionHint: "ок" })],
        }),
      ),
    );
    const next = applyKremlinIngest(
      created.slot,
      mustParse(
        payload({
          sentAt: "2026-11-17T12:00:00.000Z",
          goals: [],
          tasks: [task({ actionUrl: "javascript:alert(1)", actionHint: "я".repeat(201) })],
        }),
      ),
    );
    assert.equal(next.unchanged, 1);
    assert.equal(next.slot.tasks[0]?.actionUrl, "https://example.com/solve");
    assert.equal(next.slot.tasks[0]?.actionHint, "ок");
    assert.equal(next.slot.tasks.length, 1);
  });

  it("writes the action fields through the ingest handler", async () => {
    const store = memoryDeps();
    const response = await handleKremlinIngest(
      request(
        payload({
          goals: [],
          tasks: [task({ actionUrl: "https://example.com/solve", actionHint: "Сверить" })],
        }),
      ),
      store.deps,
    );
    assert.equal(response.status, 200);
    const loaded = await store.deps.loadSlot(OWNER_ID);
    assert.equal(loaded.tasks[0]?.actionUrl, "https://example.com/solve");
    assert.equal(loaded.tasks[0]?.actionHint, "Сверить");
    assert.equal(loaded.tasks[0]?.source, "kremlin");
  });
});

describe("client merge", () => {
  it("merges Kremlin rows into poryadok-v1 by id and externalId without dropping client items", () => {
    const client = {
      tasks: [localTask(), { ...localTask({ id: "kremlin:task-1", externalId: "task-1", title: "Черновик на телефоне", project: "Кремль", updatedAt: 10 }) }],
      goals: [{ id: "local-goal", title: "Своя цель", updatedAt: 10 }],
      boards: [{ id: "home", name: "Дом", updatedAt: 1 }],
      projects: ["Дом"],
    };
    const ingested = applyKremlinIngest(emptySlot(), mustParse(payload()));
    const merged = mergePoryadokState(client, {
      tasks: ingested.slot.tasks,
      goals: ingested.slot.goals,
      boards: ingested.slot.boards,
      projects: ingested.slot.projects,
    });

    const tasks = merged.tasks as { id: string; title?: string; externalId?: string }[];
    const goals = merged.goals as { id: string; title?: string; externalId?: string }[];
    assert.equal(tasks.find((item) => item.id === "local-1")?.title, "Своя задача");
    assert.equal(goals.find((item) => item.id === "local-goal")?.title, "Своя цель");
    assert.ok(tasks.find((item) => item.externalId === "task-1"));
    assert.equal(tasks.filter((item) => item.externalId === "task-1").length, 1);
    assert.equal(tasks.find((item) => item.externalId === "task-1")?.title, "Проверить отчёт");
    assert.ok(goals.find((item) => item.externalId === "goal-1"));
    assert.ok(merged.projects.includes("Дом"));
    assert.ok(merged.projects.includes("Кремль"));
    assert.equal(merged.boards.filter((board) => board.name === "Кремль").length, 1);
    assert.equal(merged.tasks.length, 2);
    assert.equal(merged.goals.length, 2);
  });

  it("keeps the newer stamp when both sides have the same externalId", () => {
    const serverTask = {
      id: "kremlin:task-1",
      externalId: "task-1",
      title: "С сервера",
      project: "Кремль",
      updatedAt: 100,
    };
    const newerClient = mergePoryadokState(
      {
        tasks: [{ id: "phone-copy", externalId: "task-1", title: "С телефона", project: "Кремль", updatedAt: 200 }],
        goals: [],
        boards: [],
        projects: ["Дом"],
      },
      { tasks: [serverTask], goals: [], boards: [], projects: ["Кремль"] },
    );
    assert.equal(newerClient.tasks.length, 1);
    assert.equal(newerClient.tasks[0]?.title, "С телефона");

    const newerServer = mergePoryadokState(
      {
        tasks: [{ id: "phone-copy", externalId: "task-1", title: "С телефона", project: "Кремль", updatedAt: 50 }],
        goals: [],
        boards: [],
        projects: ["Дом"],
      },
      { tasks: [serverTask], goals: [], boards: [], projects: ["Кремль"] },
    );
    assert.equal(newerServer.tasks.length, 1);
    assert.equal(newerServer.tasks[0]?.title, "С сервера");
    assert.ok(newerServer.projects.includes("Дом"));
  });

  it("carries actionUrl with the newer stamp and does not drop the other side's tasks", () => {
    const phone = {
      id: "phone-copy",
      externalId: "task-1",
      title: "С телефона",
      project: "Кремль",
      actionUrl: "https://phone.example/a",
      actionHint: "телефон",
      updatedAt: 50,
    };
    const server = {
      id: "kremlin:task-1",
      externalId: "task-1",
      title: "С сервера",
      project: "Кремль",
      actionUrl: "grokbot://task/9",
      actionHint: "бот",
      updatedAt: 100,
    };
    const onlyLocal = {
      id: "local-1",
      externalId: undefined,
      title: "Своя задача",
      project: "Дом",
      actionUrl: "https://local.example/x",
      actionHint: undefined,
      updatedAt: 10,
    };
    const newerServer = mergePoryadokState(
      { tasks: [phone, onlyLocal], goals: [], boards: [], projects: ["Дом"] },
      { tasks: [server], goals: [], boards: [], projects: ["Кремль"] },
    );
    assert.equal(newerServer.tasks.length, 2);
    const merged = newerServer.tasks.find((item) => item.externalId === "task-1");
    assert.equal(merged?.title, "С сервера");
    assert.equal(merged?.actionUrl, "grokbot://task/9");
    assert.equal(merged?.actionHint, "бот");
    assert.equal(
      newerServer.tasks.find((item) => item.id === "local-1")?.actionUrl,
      "https://local.example/x",
    );

    const newerPhone = mergePoryadokState(
      { tasks: [{ ...phone, updatedAt: 200 }], goals: [], boards: [], projects: ["Дом"] },
      { tasks: [server], goals: [], boards: [], projects: ["Кремль"] },
    );
    assert.equal(newerPhone.tasks.length, 1);
    assert.equal(newerPhone.tasks[0]?.title, "С телефона");
    assert.equal(newerPhone.tasks[0]?.actionUrl, "https://phone.example/a");
    assert.equal(newerPhone.tasks[0]?.actionHint, "телефон");
  });
});

describe("owner slot", () => {
  it("returns 503 and writes nothing when PORYADOK_OWNER_EMAIL is unset", async () => {
    const store = memoryDeps({ ownerEmail: "   ", users: { "other@example.com": OTHER_ID, "Owner@Example.com": OWNER_ID } });
    store.records.set(`${OTHER_ID}:tasks:keep`, {
      collection: "tasks",
      id: "keep",
      payload: { id: "keep", title: "Чужое" },
      updatedAt: 1,
    });
    const before = JSON.stringify([...store.records.entries()]);
    const response = await handleKremlinIngest(request(payload()), store.deps);
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify([...store.records.entries()]), before);
  });

  it("returns 409 and writes nothing when no account has that email", async () => {
    const store = memoryDeps({ users: { "other@example.com": OTHER_ID } });
    store.records.set(`${OTHER_ID}:tasks:keep`, {
      collection: "tasks",
      id: "keep",
      payload: { id: "keep", title: "Чужое" },
      updatedAt: 1,
    });
    const before = JSON.stringify([...store.records.entries()]);
    const response = await handleKremlinIngest(request(payload()), store.deps);
    assert.equal(response.status, 409);
    assert.equal(JSON.stringify([...store.records.entries()]), before);
  });

  it("writes only into the matching account and leaves another user's records untouched", async () => {
    const store = memoryDeps({
      users: { "other@example.com": OTHER_ID, "Owner@Example.com": OWNER_ID },
    });
    store.records.set(`${OTHER_ID}:tasks:keep`, {
      collection: "tasks",
      id: "keep",
      payload: localTask({ id: "keep", title: "Чужое" }),
      updatedAt: 1,
    });
    store.records.set(`${OWNER_ID}:tasks:local-1`, {
      collection: "tasks",
      id: "local-1",
      payload: localTask(),
      updatedAt: 50,
    });
    const otherBefore = store.records.get(`${OTHER_ID}:tasks:keep`);
    const response = await handleKremlinIngest(request(payload()), store.deps);
    assert.equal(response.status, 200);
    const owner = await store.deps.loadSlot(OWNER_ID);
    const other = await store.deps.loadSlot(OTHER_ID);
    assert.equal(owner.tasks.find((item) => item.id === "local-1")?.title, "Своя задача");
    assert.ok(owner.tasks.some((item) => item.externalId === "task-1" && item.source === "kremlin"));
    assert.equal(owner.goals.filter((item) => item.source === "kremlin").length, 1);
    assert.equal(other.tasks.length, 1);
    assert.equal(other.tasks[0]?.title, "Чужое");
    assert.deepEqual(store.records.get(`${OTHER_ID}:tasks:keep`), otherBefore);
    assert.equal([...store.records.keys()].some((key) => key.startsWith(`${OTHER_ID}:`) && key !== `${OTHER_ID}:tasks:keep`), false);
    assert.equal(matchOwnerId([{ id: OTHER_ID, email: "other@example.com" }, { id: OWNER_ID, email: "Owner@Example.com" }], OWNER_EMAIL), OWNER_ID);
    assert.equal(matchOwnerId([{ id: "first", email: "other@example.com" }], OWNER_EMAIL), null);
  });
});

function mustParse(body: unknown) {
  const parsed = parseKremlinPayload(body);
  if (!parsed.ok) throw new Error(parsed.issues.join("; "));
  return parsed.value;
}
