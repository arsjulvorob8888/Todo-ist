import { Link } from "@tanstack/react-router";
import { Flame, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { ScorePips } from "@/components/score-pips";
import { dayKey, fmtHm, fmtSpan, formatDay } from "@/lib/dates";
import { quoteForNow } from "@/lib/quotes";
import { playStart, playTap } from "@/lib/sound";
import { dayScore, levelInfo, spanSeconds, streakCount, usePlanner, type Pomo, type Task } from "@/lib/store";

export function Today() {
  const tasks = usePlanner((s) => s.tasks);
  const spans = usePlanner((s) => s.spans);
  const xp = usePlanner((s) => s.xp);
  const timeCats = usePlanner((s) => s.timeCats);
  const completeTask = usePlanner((s) => s.completeTask);
  const startSpan = usePlanner((s) => s.startSpan);
  const stopSpan = usePlanner((s) => s.stopSpan);
  const updateSpan = usePlanner((s) => s.updateSpan);
  const startPomo = usePlanner((s) => s.startPomo);
  const focusTask = usePlanner((s) => s.focusTask);
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
  const finished = spans.filter((span) => span.day === today && span.end).sort((a, b) => b.start.localeCompare(a.start));
  const unrated = finished.filter((span) => !span.score);
  const score = dayScore(spans, today);
  const seconds = spans.filter((span) => span.day === today).reduce((sum, span) => sum + spanSeconds(span), 0);
  const done = tasks.filter((task) => task.completed.slice(0, 10) === today).length;
  const pomos = tasks.reduce((sum, task) => sum + (task.completed.slice(0, 10) === today ? task.pomodoros : 0), 0);
  const openTasks = tasks
    .filter((task) => task.status !== "Выполнено")
    .sort(byUrgency)
    .slice(0, 5);
  const level = levelInfo(xp);
  const streak = streakCount(tasks, spans);
  const [thought, setThought] = useState<ReturnType<typeof quoteForNow> | null>(null);
  useEffect(() => {
    const refresh = () => setThought(quoteForNow());
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm tracking-wide text-mist uppercase">Сегодня</p>
        <h1 className="font-display text-4xl capitalize">{formatDay(today)}</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-3 md:col-span-2">
          <article className="rounded-card border border-gold/40 bg-panel p-5">
            <p className="text-xs tracking-wide text-gold uppercase">{thought?.period ?? "Мысль"}</p>
            {thought ? (
              <>
                <blockquote className="mt-2 font-display text-lg leading-relaxed text-cream md:text-xl">«{thought.text}»</blockquote>
                <p className="mt-3 text-sm text-mist">{thought.author}</p>
              </>
            ) : (
              <p className="mt-3 h-16 text-mist">...</p>
            )}
          </article>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
        <article className="flex h-full items-center gap-4 rounded-card border border-line bg-panel p-4">
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
            <button type="button" onClick={() => { playTap(); stopSpan(today); }} className="animate-[live_1.4s_ease-out_infinite] rounded-full bg-ember px-4 py-2 text-ink">
              Стоп
            </button>
          </div>
        ) : (
          <p className="text-mist">Выбери, чем занят. Следующая категория сама закроет эту.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {timeCats.map((name) => (
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
        </div>
        {unrated.length > 0 ? (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <p className="text-sm text-mist">Как прошёл этап</p>
            {unrated.map((span) => (
              <div key={span.id}>
                <p className="mb-2 text-sm">{span.category}</p>
                <ScorePips value={span.score} onPick={(value) => updateSpan(span.id, { score: value })} />
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-sm text-mist">
          Оценка дня{" "}
          <span className="font-display text-2xl text-cream">{score ?? "—"}</span>
          {score != null ? ` из ${finished.filter((span) => span.score).length} этапов` : " — оцени закрытые этапы"}
        </p>
      </section>

      <Pomodoro
        tasks={tasks.filter((task) => task.status !== "Выполнено")}
        taskId={pomoTask}
        onTask={setPomoTask}
        pomo={pomo}
        now={Date.now()}
        onStart={(minutes) => {
          playStart();
          if (pomoTask) focusTask(pomoTask, minutes);
          else startPomo(minutes, "", "focus");
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
            {openTasks.map((task) => {
              const urgent = task.priority === "Срочно";
              const high = task.priority === "Высокий";
              return (
              <li key={task.id} className={`flex items-center gap-3 rounded-card border border-line border-l-4 px-3 py-3 ${urgent ? "border-l-ember bg-ember/10" : high ? "border-l-gold bg-panel" : "border-l-line bg-panel"}`}>
                <button
                  type="button"
                  aria-label="Выполнить"
                  onClick={() => completeTask(task.id)}
                  className={`size-8 shrink-0 rounded-full border-2 ${urgent ? "border-ember" : "border-gold"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{task.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold ${urgent ? "bg-ember text-ink" : high ? "border border-gold text-gold" : "bg-panel-2 text-mist"}`}>
                      {task.priority}
                    </span>
                  </p>
                  <p className="text-xs text-mist">
                    Поставлена {new Date(task.created).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    дедлайн {task.deadline ? new Date(task.deadline + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "не задан"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playStart();
                    focusTask(task.id, 25);
                  }}
                  className="rounded-full bg-gold px-3 py-2 text-sm text-ink"
                >
                  25 мин
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function byUrgency(a: Task, b: Task) {
  const weight: Record<string, number> = { Срочно: 0, Высокий: 1, Средний: 2, Низкий: 3 };
  const leftUrgent = a.priority === "Срочно" ? 0 : 1;
  const rightUrgent = b.priority === "Срочно" ? 0 : 1;
  if (leftUrgent !== rightUrgent) return leftUrgent - rightUrgent;
  const leftDay = a.deadline || "9999-99-99";
  const rightDay = b.deadline || "9999-99-99";
  if (leftDay !== rightDay) return leftDay < rightDay ? -1 : 1;
  return (weight[a.priority] ?? 2) - (weight[b.priority] ?? 2);
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
          <p className="flex items-center gap-1.5 text-xs tracking-wide text-gold uppercase">
            <Tomato className="size-4" />
            Pomidorro
          </p>
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

function Tomato({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 5.2c.6-1.6 2.2-2.6 3.4-2.7-.3 1.7-1.6 2.8-2.8 3.2" fill="#8fbf6a" />
      <path d="M11.2 6.2c1.6-.2 2.8.6 3.4 1.4" fill="none" stroke="#8fbf6a" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="12" cy="14.2" rx="6.4" ry="5.6" fill="#ef5d32" />
      <path d="M9.4 12.2c.3 1.1-.1 1.8-.8 2.2" fill="none" stroke="#f6d27a" strokeWidth="1" strokeLinecap="round" />
    </svg>
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
