import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, dayKey, fmtHm, shortDay } from "@/lib/dates";
import { levelInfo, spanSeconds, streakCount, usePlanner } from "@/lib/store";

export function StatsView() {
  const spans = usePlanner((s) => s.spans);
  const tasks = usePlanner((s) => s.tasks);
  const scores = usePlanner((s) => s.scores);
  const xp = usePlanner((s) => s.xp);
  const level = levelInfo(xp);
  const today = dayKey();

  const days = Array.from({ length: 14 }, (_, index) => addDays(today, index - 13));
  const byDay = days.map((day) => {
    const seconds = spans.filter((span) => span.day === day).reduce((sum, span) => sum + spanSeconds(span), 0);
    return { day: shortDay(day), hours: Math.round((seconds / 3600) * 10) / 10 };
  });

  const todayMap = new Map<string, number>();
  for (const span of spans.filter((span) => span.day === today)) {
    todayMap.set(span.category, (todayMap.get(span.category) ?? 0) + spanSeconds(span));
  }
  const todayRows = [...todayMap.entries()].sort((a, b) => b[1] - a[1]);
  const max = todayRows[0]?.[1] ?? 1;

  const heat = Array.from({ length: 84 }, (_, index) => addDays(today, index - 83));
  const rated = Object.values(scores);
  const avg = rated.length ? (rated.reduce((sum, value) => sum + value, 0) / rated.length).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-mist">Как уходит время</p>
        <h1 className="font-display text-4xl">Рост</h1>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Уровень" value={String(level.level)} hint={`${xp} XP`} />
        <Stat label="Серия" value={String(streakCount(tasks, spans))} hint="дней" />
        <Stat label="Средняя оценка" value={String(avg)} hint="по отмеченным дням" />
      </section>
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="mb-3 font-display text-2xl">14 дней, часы</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay}>
              <XAxis dataKey="day" stroke="var(--color-mist)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-mist)" fontSize={11} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "var(--color-panel-2)" }}
                contentStyle={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", borderRadius: 12 }}
              />
              <Bar dataKey="hours" fill="var(--color-gold)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="mb-3 font-display text-2xl">Сегодня по категориям</h2>
        {todayRows.length === 0 ? <p className="text-mist">Тайминг за сегодня ещё не начат.</p> : null}
        <ul className="space-y-3">
          {todayRows.map(([name, seconds]) => (
            <li key={name}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{name}</span>
                <span className="text-gold">{fmtHm(seconds)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(seconds / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="mb-3 font-display text-2xl">12 недель</h2>
        <div className="grid grid-cols-12 gap-1">
          {heat.map((day) => {
            const seconds = spans.filter((span) => span.day === day).reduce((sum, span) => sum + spanSeconds(span), 0);
            const hours = seconds / 3600;
            const alpha = hours === 0 ? 0.08 : Math.min(1, 0.25 + hours / 8);
            return <div key={day} title={`${day} · ${fmtHm(seconds)}`} className="aspect-square rounded-sm bg-gold" style={{ opacity: alpha }} />;
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-card border border-line bg-panel p-4">
      <p className="text-sm text-mist">{label}</p>
      <p className="font-display text-4xl">{value}</p>
      <p className="text-sm text-mist">{hint}</p>
    </article>
  );
}
