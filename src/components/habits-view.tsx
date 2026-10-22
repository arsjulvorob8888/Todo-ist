import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { addDays, dayKey } from "@/lib/dates";
import { playHabit, playStart, playTap, playWin } from "@/lib/sound";
import { habitDue, habitStreak, usePlanner, weekdayOf, type Habit } from "@/lib/store";

const WEEK = [
  { id: 1, label: "Пн" },
  { id: 2, label: "Вт" },
  { id: 3, label: "Ср" },
  { id: 4, label: "Чт" },
  { id: 5, label: "Пт" },
  { id: 6, label: "Сб" },
  { id: 7, label: "Вс" },
];

const IDEAS = ["Вода", "Зарядка", "Чтение", "Прогулка", "Без соцсетей", "Сон до 23:00"];

function daysWord(count: number) {
  const tail = count % 10;
  const hundred = count % 100;
  if (tail === 1 && hundred !== 11) return "день";
  if (tail >= 2 && tail <= 4 && (hundred < 12 || hundred > 14)) return "дня";
  return "дней";
}

export function HabitsView() {
  const habits = usePlanner((s) => s.habits);
  const ensureHabits = usePlanner((s) => s.ensureHabits);
  const addHabit = usePlanner((s) => s.addHabit);
  const updateHabit = usePlanner((s) => s.updateHabit);
  const deleteHabit = usePlanner((s) => s.deleteHabit);
  const toggleHabit = usePlanner((s) => s.toggleHabit);
  const focusHabit = usePlanner((s) => s.focusHabit);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [editing, setEditing] = useState<string | null>(null);
  const today = dayKey();

  useEffect(() => {
    ensureHabits();
  }, [ensureHabits]);

  const due = habits.filter((habit) => habitDue(habit, today));
  const later = habits.filter((habit) => !habitDue(habit, today));
  const closed = due.filter((habit) => habit.done.includes(today)).length;

  function mark(id: string, day?: string) {
    const result = toggleHabit(id, day);
    if (!result) return;
    if (result.quiet || result.undone) playTap();
    else if (result.allDone) playWin();
    else playHabit();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist">Не рви цепь</p>
          <h1 className="font-display text-4xl">Привычки</h1>
        </div>
        <p className="font-display text-3xl text-gold">
          {closed}/{due.length || 0}
        </p>
      </header>

      <HabitBoard habits={habits} today={today} onToggle={mark} />

      <section className="rounded-card border border-line bg-panel p-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            addHabit(title, days);
            setTitle("");
            playTap();
          }}
        >
          <input
            className="w-full rounded-xl border border-line bg-panel-2 px-3 py-3 text-cream outline-none focus:border-gold"
            placeholder="Новая привычка"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {WEEK.map((day) => {
              const on = days.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setDays(on ? days.filter((item) => item !== day.id) : [...days, day.id].sort())}
                  className={`rounded-full px-3 py-1 text-sm ${on ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <button type="submit" className="rounded-full bg-gold px-4 py-2 text-ink">
            Добавить
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {IDEAS.filter((idea) => !habits.some((habit) => habit.title === idea)).map((idea) => (
            <button key={idea} type="button" className="rounded-full border border-line px-3 py-1 text-sm text-mist" onClick={() => addHabit(idea)}>
              + {idea}
            </button>
          ))}
        </div>
      </section>

      <HabitList title="Сегодня" habits={due} today={today} editing={editing} onEdit={setEditing} onToggle={mark} onFocus={focusHabit} onSave={updateHabit} onDelete={deleteHabit} />
      {later.length ? (
        <HabitList title="В другие дни" habits={later} today={today} editing={editing} onEdit={setEditing} onToggle={mark} onFocus={focusHabit} onSave={updateHabit} onDelete={deleteHabit} />
      ) : null}
    </div>
  );
}

function HabitList({
  title,
  habits,
  today,
  editing,
  onEdit,
  onToggle,
  onFocus,
  onSave,
  onDelete,
}: {
  title: string;
  habits: Habit[];
  today: string;
  editing: string | null;
  onEdit: (id: string | null) => void;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  onSave: (id: string, patch: Partial<Pick<Habit, "title" | "days">>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      {habits.length === 0 ? <p className="text-mist">На этот день привычек нет.</p> : null}
      <ul className="space-y-2">
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            today={today}
            editing={editing === habit.id}
            onEdit={() => onEdit(editing === habit.id ? null : habit.id)}
            onToggle={() => onToggle(habit.id)}
            onFocus={() => onFocus(habit.id)}
            onSave={(patch) => {
              onSave(habit.id, patch);
              onEdit(null);
            }}
            onDelete={() => onDelete(habit.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function HabitRow({
  habit,
  today,
  editing,
  onEdit,
  onToggle,
  onFocus,
  onSave,
  onDelete,
}: {
  habit: Habit;
  today: string;
  editing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onFocus: () => void;
  onSave: (patch: Partial<Pick<Habit, "title" | "days">>) => void;
  onDelete: () => void;
}) {
  const done = habit.done.includes(today);
  const streak = habitStreak(habit.done, today);
  const goal = streak < 21 ? 21 : 66;
  const locked = streak >= 66;
  const left = Math.max(0, goal - streak);
  const [draft, setDraft] = useState(habit.title);
  const [days, setDays] = useState(habit.days);
  const dots = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

  return (
    <li className={`rounded-card border px-3 py-3 ${done ? "border-gold bg-gold/10" : "border-line bg-panel"}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={done ? "Снять привычку" : "Отметить привычку"}
          onClick={onToggle}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${done ? "animate-[pop_280ms_ease-out] border-gold bg-gold text-ink" : "border-gold"}`}
        >
          {done ? "✓" : ""}
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}>
          <p className={done ? "text-mist line-through" : ""}>{habit.title}</p>
          <p className="flex items-center gap-1 text-xs text-mist">
            <Flame className="size-3 text-ember" />
            {streak} {streak === 1 ? "день" : "дней"}
            {habit.best > streak ? ` · рекорд ${habit.best}` : ""}
          </p>
        </button>
        <button type="button" className="rounded-full bg-gold px-3 py-1 text-sm text-ink" onClick={() => { playStart(); onFocus(); }}>
          25 мин
        </button>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between gap-3 text-xs text-mist">
          <span>{locked ? "Привычка закрепилась" : streak < 21 ? "До формирования" : "До закрепления"}</span>
          <span className="text-gold">{locked ? `${streak} дней подряд` : `${streak} из ${goal}`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (streak / goal) * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-mist">
          {locked
            ? "66 дней подряд — действие уже держится само."
            : `Ещё ${left} ${daysWord(left)} подряд. 21 — привычка формируется, 66 — закрепляется. Пропуск обнуляет серию.`}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {dots.map((day) => {
          const hit = habit.done.includes(day);
          const due = habitDue(habit, day);
          const letter = WEEK.find((item) => item.id === weekdayOf(day))?.label ?? "";
          return (
            <span key={day} title={day} className="text-center">
              <span className={`block h-2 rounded-sm ${hit ? "bg-gold" : due ? "bg-panel-2" : "bg-transparent"} ${day === today ? "ring-1 ring-gold" : ""}`} />
              <span className={`mt-1 block text-[10px] ${day === today ? "text-gold" : "text-mist"}`}>{letter}</span>
            </span>
          );
        })}
      </div>
      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ title: draft, days });
          }}
        >
          <input className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-cream" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {WEEK.map((day) => {
              const on = days.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => setDays(on ? days.filter((item) => item !== day.id) : [...days, day.id].sort())}
                  className={`rounded-full px-3 py-1 text-sm ${on ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-mist">Сегодня {WEEK.find((day) => day.id === weekdayOf(today))?.label}. Пустые дни недели значат «каждый день».</p>
          <div className="flex gap-3">
            <button type="submit" className="text-sm text-gold">
              Сохранить
            </button>
            <button type="button" className="text-sm text-ember" onClick={onDelete}>
              Удалить
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function HabitBoard({ habits, today, onToggle }: { habits: Habit[]; today: string; onToggle: (id: string, day?: string) => void }) {
  const cells = Array.from({ length: 84 }, (_, index) => addDays(today, index - 83));
  if (habits.length === 0) return null;
  return (
    <section className="rounded-card border border-line bg-panel p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-2xl">12 недель</h2>
        <p className="text-xs text-mist">одна таблица на все привычки</p>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {cells.map((day) => {
          const due = habits.filter((habit) => habitDue(habit, day) && habit.created.slice(0, 10) <= day);
          const hit = due.filter((habit) => habit.done.includes(day)).length;
          const alpha = due.length === 0 ? 0.08 : 0.18 + (hit / due.length) * 0.82;
          return (
            <div
              key={day}
              title={`${day} · ${hit}/${due.length || 0}`}
              className={`aspect-square rounded-sm bg-gold ${day === today ? "ring-1 ring-cream" : ""}`}
              style={{ opacity: alpha }}
            />
          );
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {habits.map((habit) => (
          <li key={habit.id} className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
            <p className="truncate text-xs text-mist" title={habit.title}>
              {habit.title}
            </p>
            <div className="grid grid-cols-12 gap-1">
              {cells.map((day) => {
                const started = habit.created.slice(0, 10) <= day;
                const due = started && habitDue(habit, day);
                const hit = due && habit.done.includes(day);
                const missed = due && !hit && day < today;
                const title = `${habit.title} · ${day}${hit ? " · сделано" : missed ? " · пропуск" : due ? "" : " · не в расписании"}`;
                return (
                  <button
                    key={day}
                    type="button"
                    title={title}
                    disabled={!due || day > today}
                    onClick={() => onToggle(habit.id, day)}
                    className={`aspect-square rounded-sm disabled:cursor-default ${
                      hit ? "bg-gold" : missed ? "bg-ember/50" : due ? "bg-panel-2" : "bg-panel-2/40"
                    } ${day === today ? "ring-1 ring-cream" : ""}`}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mist">Золотое — сделано, рыжее — пропуск, тусклое — день не в расписании. Клетка отмечается нажатием.</p>
    </section>
  );
}
