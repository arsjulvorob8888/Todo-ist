import { Link } from "@tanstack/react-router";
import { Flame, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { dayKey, fmtHm, fmtSpan, formatDay } from "@/lib/dates";
import { playStart, playTap } from "@/lib/sound";
import { levelInfo, spanSeconds, streakCount, usePlanner, type Pomo, type Task } from "@/lib/store";

export function Today() {
  const tasks = usePlanner((s) => s.tasks);
  const spans = usePlanner((s) => s.spans);
  const xp = usePlanner((s) => s.xp);
  const timeCats = usePlanner((s) => s.timeCats);
  const completeTask = usePlanner((s) => s.completeTask);
  const startSpan = usePlanner((s) => s.startSpan);
  const stopSpan = usePlanner((s) => s.stopSpan);
  const startPomo = usePlanner((s) => s.startPomo);
  const pausePomo = usePlanner((s) => s.pausePomo);
  const stopPomo = usePlanner((s) => s.stopPomo);
  const pomo = usePlanner((s) => s.pomo);
  const [pomoTask, setPomoTask] = useState("");
  const today = dayKey();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const open = spans.find((span) => span.day === today && !span.end);
  const seconds = spans.filter((span) => span.day === today).reduce((sum, span) => sum + spanSeconds(span), 0);
  const done = tasks.filter((task) => task.completed.slice(0, 10) === today).length;
  const pomos = tasks.reduce((sum, task) => sum + (task.completed.slice(0, 10) === today ? task.pomodoros : 0), 0);
  const openTasks = tasks.filter((task) => task.status !== "Выполнено").slice(0, 5);
  const level = levelInfo(xp);
  const streak = streakCount(tasks, spans);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm tracking-wide text-mist uppercase">Сегодня</p>
        <h1 className="font-display text-4xl capitalize">{formatDay(today)}</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-card border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-ember">
            <Flame className="size-5" />
            <span className="text-sm">Серия</span>
          </div>
          <p className="mt-2 font-display text-5xl">{streak}</p>
          <p className="text-sm text-mist">{streak ? "дней без пропуска" : "закрой дело — серия начнётся"}</p>
        </article>
        <article className="rounded-card border border-line bg-panel p-4">
          <div className="flex items-center gap-2 text-gold">
            <Zap className="size-5" />
            <span className="text-sm">Уровень {level.level}</span>
          </div>
          <p className="mt-3 font-display text-2xl">{xp} XP</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full bg-gold" style={{ width: `${(level.into / level.need) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-mist">
            {level.into} / {level.need} до следующего
          </p>
        </article>
        <article className="flex items-center gap-4 rounded-card border border-line bg-panel p-4">
          <Rings time={Math.min(1, seconds / (8 * 3600))} tasks={Math.min(1, done / 3)} pomos={Math.min(1, pomos / 4)} />
          <div className="text-sm text-mist">
            <p>
              <span className="text-gold">Время</span> {fmtHm(seconds)} / 8:00
            </p>
            <p>
              <span className="text-ember">Дела</span> {done} / 3
            </p>
            <p>
              <span className="text-cream">Помидоры</span> {pomos} / 4
            </p>
          </div>
        </article>
      </section>

      <section className="rounded-card border border-line bg-panel p-4">
        {open ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs tracking-wide text-gold uppercase">Сейчас</p>
              <p className="font-display text-3xl">{open.category}</p>
              <p className="text-mist">{fmtSpan(spanSeconds(open))}</p>
            </div>
            <button type="button" onClick={() => { playTap(); stopSpan(today); }} className="rounded-full bg-ember px-4 py-2 text-ink">
              Стоп
            </button>
          </div>
        ) : (
          <p className="text-mist">Выбери, чем занят. Следующая категория сама закроет эту.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {timeCats.slice(0, 12).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                playStart();
                startSpan(name);
              }}
              className={`rounded-full px-3 py-2 text-sm ${open?.category === name ? "bg-gold text-ink" : "bg-panel-2 text-cream"}`}
            >
              {name}
            </button>
          ))}
          <Link to="/timing" className="rounded-full px-3 py-2 text-sm text-gold">
            Все категории
          </Link>
        </div>
      </section>

      <Pomodoro
        tasks={tasks.filter((task) => task.status !== "Выполнено")}
        taskId={pomoTask}
        onTask={setPomoTask}
        pomo={pomo}
        now={Date.now()}
        onStart={(minutes) => {
          playStart();
          startPomo(minutes, pomoTask, "focus");
        }}
        onBreak={() => startPomo(5, pomo.taskId, "break")}
        onPause={pausePomo}
        onStop={stopPomo}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Ближайшие дела</h2>
          <Link to="/tasks" className="text-sm text-gold">
            Все задачи
          </Link>
        </div>
        {openTasks.length === 0 ? (
          <p className="rounded-card border border-dashed border-line p-6 text-mist">Список пуст. Добавь одно дело — и закрой его.</p>
        ) : (
          <ul className="space-y-2">
            {openTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 rounded-card border border-line bg-panel px-3 py-3">
                <button
                  type="button"
                  aria-label="Выполнить"
                  onClick={() => completeTask(task.id)}
                  className="size-8 shrink-0 rounded-full border-2 border-gold"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{task.title}</p>
                  <p className="text-xs text-mist">
                    Поставлена {new Date(task.created).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    дедлайн {task.deadline ? new Date(task.deadline + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "не задан"}
                    {" · "}
                    {task.priority}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playStart();
                    startPomo(25, task.id);
                  }}
                  className="rounded-full bg-gold px-3 py-2 text-sm text-ink"
                >
                  25 мин
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Pomodoro({
  tasks,
  taskId,
  onTask,
  pomo,
  now,
  onStart,
  onBreak,
  onPause,
  onStop,
}: {
  tasks: Task[];
  taskId: string;
  onTask: (id: string) => void;
  pomo: Pomo;
  now: number;
  onStart: (minutes: number) => void;
  onBreak: () => void;
  onPause: () => void;
  onStop: () => void;
}) {
  const left = pomo.running ? Math.max(0, Math.round((pomo.endsAt - now) / 1000)) : pomo.remaining;
  const active = pomo.running || pomo.mode === "break";
  const linked = tasks.find((task) => task.id === (pomo.running || pomo.mode === "break" ? pomo.taskId : taskId));
  return (
    <section className="rounded-card border border-gold bg-panel p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-gold uppercase">Помидор</p>
          <h2 className="font-display text-3xl">{active ? fmtSpan(left) : "25 минут одного дела"}</h2>
          <p className="mt-1 max-w-xl text-sm text-mist">
            {pomo.mode === "break"
              ? "Фокус закрыт. Пять минут не трогай задачу, потом следующий круг."
              : "Один круг: 25 или 50 минут без переключений, затем 5 минут отдыха. Четыре круга за день закрывают кольцо."}
          </p>
        </div>
        {active ? (
          <div className="flex gap-2">
            {pomo.mode === "break" && !pomo.running ? (
              <button type="button" onClick={onBreak} className="rounded-full bg-gold px-4 py-2 text-ink">
                Перерыв 5 мин
              </button>
            ) : (
              <button type="button" onClick={onPause} className="rounded-full bg-panel-2 px-4 py-2">
                {pomo.running ? "Пауза" : "Дальше"}
              </button>
            )}
            <button type="button" onClick={onStop} className="rounded-full bg-ember px-4 py-2 text-ink">
              Сбросить
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => onStart(25)} className="rounded-full bg-gold px-4 py-2 text-ink">
              Старт 25
            </button>
            <button type="button" onClick={() => onStart(50)} className="rounded-full bg-panel-2 px-4 py-2">
              Старт 50
            </button>
          </div>
        )}
      </div>
      <label className="mt-4 block text-sm text-mist">
        К какой задаче
        <select
          className="mt-1 w-full rounded-xl border border-line bg-panel-2 px-3 py-3 text-cream"
          value={active ? pomo.taskId : taskId}
          onChange={(event) => onTask(event.target.value)}
          disabled={active}
        >
          <option value="">Без задачи</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
      </label>
      {linked ? <p className="mt-2 text-sm text-gold">{linked.title}</p> : null}
    </section>
  );
}

function Rings({ time, tasks, pomos }: { time: number; tasks: number; pomos: number }) {
  const rings = [
    { r: 46, pct: time, color: "var(--color-gold)" },
    { r: 34, pct: tasks, color: "var(--color-ember)" },
    { r: 22, pct: pomos, color: "var(--color-cream)" },
  ];
  return (
    <svg viewBox="0 0 120 120" className="size-28 shrink-0">
      {rings.map((ring) => {
        const c = 2 * Math.PI * ring.r;
        return (
          <g key={ring.r}>
            <circle cx="60" cy="60" r={ring.r} fill="none" stroke="var(--color-line)" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${c * ring.pct} ${c}`}
              transform="rotate(-90 60 60)"
            />
          </g>
        );
      })}
    </svg>
  );
}
