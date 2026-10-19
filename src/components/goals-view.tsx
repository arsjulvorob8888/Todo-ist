import { useState } from "react";
import { Field, inputClass, Modal } from "@/components/modal";
import { usePlanner } from "@/lib/store";

export function GoalsView() {
  const mission = usePlanner((s) => s.mission);
  const setMission = usePlanner((s) => s.setMission);
  const goals = usePlanner((s) => s.goals);
  const addGoal = usePlanner((s) => s.addGoal);
  const updateGoal = usePlanner((s) => s.updateGoal);
  const deleteGoal = usePlanner((s) => s.deleteGoal);
  const [draft, setDraft] = useState(mission);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

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
          <button type="button" className="rounded-full bg-panel px-4 py-2" onClick={() => setOpen(true)}>
            Добавить
          </button>
        </div>
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id} className="rounded-card border border-line bg-panel p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-display text-xl">{goal.title}</h3>
                <button type="button" className="text-sm text-ember" onClick={() => deleteGoal(goal.id)}>
                  Удалить
                </button>
              </div>
              <textarea
                className={inputClass}
                rows={3}
                defaultValue={goal.content}
                onBlur={(event) => updateGoal(goal.id, event.target.value)}
              />
            </li>
          ))}
        </ul>
      </section>
      {open ? (
        <Modal title="Новая цель" onClose={() => setOpen(false)}>
          <Field label="Название">
            <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              if (!title.trim()) return;
              addGoal(title.trim());
              setTitle("");
              setOpen(false);
            }}
          >
            Сохранить
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
