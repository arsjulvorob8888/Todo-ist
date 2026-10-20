import { useEffect, useState } from "react";
import { Field, inputClass, Modal } from "@/components/modal";
import { dayKey } from "@/lib/dates";
import { playTap } from "@/lib/sound";
import { usePlanner, type Goal, type Kpi } from "@/lib/store";

const uid = () => crypto.randomUUID();

export function GoalsView() {
  const mission = usePlanner((s) => s.mission);
  const setMission = usePlanner((s) => s.setMission);
  const goals = usePlanner((s) => s.goals);
  const addGoal = usePlanner((s) => s.addGoal);
  const updateGoal = usePlanner((s) => s.updateGoal);
  const toggleGoal = usePlanner((s) => s.toggleGoal);
  const deleteGoal = usePlanner((s) => s.deleteGoal);
  const [draft, setDraft] = useState(mission);
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-mist">Зачем всё это</p>
        <h1 className="font-display text-4xl">Цели</h1>
      </header>
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Миссия</h2>
        <textarea className={`${inputClass} mt-3`} rows={5} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="button" className="mt-3 rounded-full bg-gold px-4 py-2 text-ink" onClick={() => setMission(draft)}>
          Сохранить миссию
        </button>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Глобальные цели</h2>
          <button type="button" className="rounded-full bg-panel px-4 py-2" onClick={() => setEditing("new")}>
            Добавить
          </button>
        </div>
        <ul className="space-y-3">
          {goals.map((goal) => {
            const percent = goalPercent(goal);
            const left = goal.deadline ? deadlineLeft(goal.deadline, now) : null;
            return (
              <li key={goal.id} className="rounded-card border border-line bg-panel p-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={goal.done ? "Снять отметку" : "Цель достигнута"}
                    title={goal.done ? "Снять отметку" : "Отметить выполнение"}
                    onClick={() => {
                      playTap();
                      toggleGoal(goal.id);
                    }}
                    className={`mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${goal.done ? "border-gold bg-gold text-ink" : "border-gold"}`}
                  >
                    {goal.done ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className={`font-display text-xl ${goal.done ? "text-mist line-through" : ""}`}>{goal.title}</h3>
                      <span className="font-display text-3xl text-gold">{percent}%</span>
                    </div>
                    {goal.deadline ? (
                      <p className="text-xs text-mist">
                        Дедлайн {formatDeadline(goal.deadline)}
                        {left ? <span className={left.overdue ? "text-ember" : "text-gold"}> · {left.overdue ? "−" : ""}{left.text}</span> : null}
                      </p>
                    ) : null}
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2">
                      <div className="h-full bg-gold" style={{ width: `${percent}%` }} />
                    </div>
                    {(goal.kpis ?? []).length ? (
                      <ul className="mt-3 space-y-2">
                        {(goal.kpis ?? []).map((kpi) => {
                          const part = kpiShare(kpi);
                          return (
                            <li key={kpi.id}>
                              <div className="mb-1 flex justify-between gap-3 text-sm">
                                <span>{kpi.name}</span>
                                <span className="text-mist">
                                  {kpi.current} / {kpi.target}
                                  {kpi.unit ? ` ${kpi.unit}` : ""} · {part}%
                                </span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                                <div className="h-full bg-gold-2" style={{ width: `${part}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {goal.content ? <p className="mt-3 text-sm whitespace-pre-wrap text-cream">{goal.content}</p> : null}
                    <div className="mt-3 flex gap-3 text-sm">
                      <button type="button" className="text-gold" onClick={() => setEditing(goal)}>
                        Править
                      </button>
                      <button type="button" className="text-ember" onClick={() => deleteGoal(goal.id)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {editing ? (
        <GoalForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(goal) => {
            if (editing === "new") addGoal(goal);
            else updateGoal(editing.id, goal);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function GoalForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Goal;
  onClose: () => void;
  onSave: (goal: Omit<Goal, "id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [percent, setPercent] = useState(String(initial?.percent ?? 0));
  const [kpis, setKpis] = useState<Kpi[]>(initial?.kpis ?? []);

  function patchKpi(id: string, patch: Partial<Kpi>) {
    setKpis((list) => list.map((kpi) => (kpi.id === id ? { ...kpi, ...patch } : kpi)));
  }

  return (
    <Modal title={initial ? "Цель" : "Новая цель"} onClose={onClose}>
      <Field label="Название">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Описание">
        <textarea className={inputClass} rows={3} value={content} onChange={(event) => setContent(event.target.value)} />
      </Field>
      <Field label="Дедлайн">
        <input className={inputClass} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>
      {kpis.length === 0 ? (
        <Field label="Процент выполнения">
          <input className={inputClass} inputMode="numeric" value={percent} onChange={(event) => setPercent(event.target.value)} />
        </Field>
      ) : (
        <p className="text-sm text-mist">Процент считается как среднее по KPI.</p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-mist">KPI</p>
          <button
            type="button"
            className="text-sm text-gold"
            onClick={() => setKpis((list) => [...list, { id: uid(), name: "", target: 100, current: 0, unit: "" }])}
          >
            Добавить KPI
          </button>
        </div>
        {kpis.map((kpi) => (
          <div key={kpi.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-line p-2">
            <input className={inputClass} placeholder="Показатель" value={kpi.name} onChange={(event) => patchKpi(kpi.id, { name: event.target.value })} />
            <input className={inputClass} placeholder="Единица" value={kpi.unit} onChange={(event) => patchKpi(kpi.id, { unit: event.target.value })} />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="Факт"
              value={String(kpi.current)}
              onChange={(event) => patchKpi(kpi.id, { current: Number(event.target.value.replace(",", ".")) || 0 })}
            />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="План"
              value={String(kpi.target)}
              onChange={(event) => patchKpi(kpi.id, { target: Number(event.target.value.replace(",", ".")) || 0 })}
            />
            <button type="button" className="text-left text-sm text-ember" onClick={() => setKpis((list) => list.filter((item) => item.id !== kpi.id))}>
              Убрать KPI
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="w-full rounded-full bg-gold py-3 text-ink"
        onClick={() => {
          if (!title.trim()) return;
          const clean = kpis.filter((kpi) => kpi.name.trim());
          const manual = Math.min(100, Math.max(0, Number(percent) || 0));
          onSave({
            title: title.trim(),
            content,
            deadline,
            done: initial?.done ?? false,
            percent: clean.length ? goalPercent({ kpis: clean }) : manual,
            kpis: clean,
          });
        }}
      >
        Сохранить
      </button>
    </Modal>
  );
}

function kpiShare(kpi: Kpi) {
  if (!kpi.target) return kpi.current > 0 ? 100 : 0;
  return Math.round(Math.min(100, Math.max(0, (kpi.current / kpi.target) * 100)));
}

function goalPercent(goal: Pick<Goal, "percent" | "kpis">) {
  const kpis = goal.kpis ?? [];
  if (kpis.length) return Math.round(kpis.reduce((sum, kpi) => sum + kpiShare(kpi), 0) / kpis.length);
  return Math.round(Math.min(100, Math.max(0, goal.percent ?? 0)));
}

function formatDeadline(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function deadlineLeft(deadline: string, now: number) {
  const end = new Date(`${deadline}T23:59:59`).getTime();
  if (Number.isNaN(end)) return null;
  const delta = end - now;
  const total = Math.floor(Math.abs(delta) / 60000);
  const days = Math.floor(total / (60 * 24));
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const text =
    days > 0
      ? `${days} д ${hours} ч ${String(minutes).padStart(2, "0")} мин`
      : `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
  return { overdue: delta < 0, text };
}
