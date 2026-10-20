import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Field, inputClass, Modal } from "@/components/modal";
import { dayKey } from "@/lib/dates";
import { playTap } from "@/lib/sound";
import { usePlanner, type RoutineBlock } from "@/lib/store";

export function RoutineView() {
  const categories = usePlanner((s) => s.timeCats);
  const routine = usePlanner((s) => s.routine ?? []);
  const addRoutine = usePlanner((s) => s.addRoutine);
  const updateRoutine = usePlanner((s) => s.updateRoutine);
  const moveRoutine = usePlanner((s) => s.moveRoutine);
  const deleteRoutine = usePlanner((s) => s.deleteRoutine);
  const toggleRoutineDone = usePlanner((s) => s.toggleRoutineDone);
  const doneToday = usePlanner((s) => (s.routineDone ?? {})[dayKey()] ?? []);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [edit, setEdit] = useState<RoutineBlock | null>(null);
  const [error, setError] = useState("");

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-mist">План, не факт</p>
        <h1 className="font-display text-4xl">Распорядок дня</h1>
        <p className="mt-1 max-w-xl text-sm text-mist">
          Кружок отмечает пункт на сегодня. Завтра отметки сбрасываются, и день начинается заново.
        </p>
      </header>
      <form
        className="mb-4 grid gap-2 rounded-card border border-line bg-panel p-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!clockOk(start) || !clockOk(end)) {
            setError("Время в формате 08:30");
            return;
          }
          addRoutine(category, start, end);
          setError("");
        }}
      >
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <input className={inputClass} value={start} onChange={(event) => setStart(event.target.value)} aria-label="Начало" />
        <input className={inputClass} value={end} onChange={(event) => setEnd(event.target.value)} aria-label="Конец" />
        <button type="submit" className="rounded-full bg-gold px-4 py-2 text-ink">
          Добавить
        </button>
      </form>
      {error ? <p className="mb-3 text-sm text-ember">{error}</p> : null}
      <ul className="space-y-2">
        {routine.map((block, index) => {
          const done = doneToday.includes(block.id);
          return (
          <li key={block.id} className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-3">
            <span className="flex flex-col">
              <button
                type="button"
                title="Выше"
                disabled={index === 0}
                className="text-gold disabled:opacity-30"
                onClick={() => {
                  playTap();
                  moveRoutine(block.id, -1);
                }}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                title="Ниже"
                disabled={index === routine.length - 1}
                className="text-gold disabled:opacity-30"
                onClick={() => {
                  playTap();
                  moveRoutine(block.id, 1);
                }}
              >
                <ChevronDown className="size-4" />
              </button>
            </span>
            <span className="w-28 text-sm text-mist">
              {block.start} – {block.end}
            </span>
            <span className={`flex-1 ${done ? "text-mist line-through" : ""}`}>{block.category}</span>
            <span className="text-gold">{lengthLabel(block.start, block.end)}</span>
            <button type="button" className="text-sm text-gold" onClick={() => setEdit(block)}>
              Править
            </button>
            <button
              type="button"
              className="text-sm text-ember"
              onClick={() => {
                playTap();
                deleteRoutine(block.id);
              }}
            >
              Убрать
            </button>
            <button
              type="button"
              aria-label={done ? "Снять отметку" : "Отметить выполненным"}
              title={done ? "Снять отметку" : "Выполнено сегодня"}
              onClick={() => {
                playTap();
                toggleRoutineDone(block.id);
              }}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${done ? "border-gold bg-gold text-ink" : "border-gold"}`}
            >
              {done ? "✓" : ""}
            </button>
          </li>
          );
        })}
      </ul>
      {routine.length === 0 ? <p className="text-mist">Пока пусто. Выбери категорию и время сверху.</p> : null}
      {edit ? (
        <EditBlock
          block={edit}
          categories={categories}
          onClose={() => setEdit(null)}
          onSave={(patch) => {
            updateRoutine(edit.id, patch);
            setEdit(null);
          }}
        />
      ) : null}
    </div>
  );
}

function EditBlock({
  block,
  categories,
  onClose,
  onSave,
}: {
  block: RoutineBlock;
  categories: string[];
  onClose: () => void;
  onSave: (patch: Pick<RoutineBlock, "category" | "start" | "end">) => void;
}) {
  const [category, setCategory] = useState(block.category);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  const [error, setError] = useState("");
  return (
    <Modal title="Пункт распорядка" onClose={onClose}>
      <Field label="Категория">
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
          {!categories.includes(category) ? <option>{category}</option> : null}
        </select>
      </Field>
      <Field label="Начало">
        <input className={inputClass} value={start} onChange={(event) => setStart(event.target.value)} />
      </Field>
      <Field label="Конец">
        <input className={inputClass} value={end} onChange={(event) => setEnd(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <button
        type="button"
        className="w-full rounded-full bg-gold py-3 text-ink"
        onClick={() => {
          if (!clockOk(start) || !clockOk(end)) {
            setError("Время в формате 08:30");
            return;
          }
          onSave({ category, start, end });
        }}
      >
        Сохранить
      </button>
    </Modal>
  );
}

function clockOk(value: string) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function lengthLabel(start: string, end: string) {
  const from = minutes(start);
  let to = minutes(end);
  if (to <= from) to += 24 * 60;
  const span = to - from;
  const hours = Math.floor(span / 60);
  const mins = span % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return (hours || 0) * 60 + (mins || 0);
}
