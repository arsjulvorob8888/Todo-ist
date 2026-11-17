import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { INBOX_NAME, resolveTaskProject } from "./task-project.ts";

const boards = [
  { id: "inbox", name: "Входящие", inbox: true },
  { id: "home", name: "Дом", inbox: false },
  { id: "money", name: "Финансы", inbox: false },
];

describe("task project without a timing assignment", () => {
  it("saves an unmapped category into Входящие and explains the choice in the form", () => {
    const fresh = resolveTaskProject({ category: "Чтение", catProject: {}, boards });
    assert.equal(fresh.project, INBOX_NAME);
    assert.equal(fresh.projectId, "inbox");
    assert.equal(fresh.mapped, false);
    assert.match(fresh.hint, /Входящие/);
    assert.equal(fresh.hint.includes("Назначь его в тайминге"), false);

    const chosen = resolveTaskProject({
      category: "Чтение",
      catProject: {},
      boards,
      chosen: "Дом",
    });
    assert.equal(chosen.project, "Дом");
    assert.equal(chosen.projectId, "home");
    assert.equal(chosen.mapped, false);
  });

  it("keeps a category that already has a project on that project", () => {
    const saved = resolveTaskProject({
      category: "Финансы",
      catProject: { Финансы: "Финансы" },
      boards,
    });
    assert.equal(saved.project, "Финансы");
    assert.equal(saved.projectId, "money");
    assert.equal(saved.mapped, true);
    assert.equal(saved.hint, "");

    const explicit = resolveTaskProject({
      category: "Финансы",
      catProject: { Финансы: "Финансы" },
      boards,
      chosen: "Финансы",
    });
    assert.equal(explicit.project, "Финансы");
    assert.equal(explicit.projectId, "money");
  });

  it("offers the project picker in the task form instead of blocking on timing", () => {
    const source = readFileSync(new URL("../components/tasks-view.tsx", import.meta.url), "utf8");
    assert.match(source, /data-testid="task-project"/);
    assert.match(source, /resolveTaskProject/);
    assert.equal(source.includes("Назначь его в тайминге"), false);
  });
});
