import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Field, inputClass, Modal } from "@/components/modal";
import { TimeCategories } from "@/components/more-view";
import { ScorePips } from "@/components/score-pips";
import { addDays, clock, dayKey, fmtHm, fmtSpan, formatDay } from "@/lib/dates";
import { playStart, playStop, playTap } from "@/lib/sound";
import { dayScore, spanSeconds, usePlanner, compareSpans, type Span } from "@/lib/store";

type SpanSort = "new" | "old" | "long" | "score" | "category" | "hand";

function stamp(iso: string) {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function moment(span: Span) {
  return stamp(span.end || span.start);
}

function sortSpans(list: Span[], mode: SpanSort) {
  const items = [...list];
  if (mode === "hand") return items.sort(compareSpans);
  if (mode === "old") return items.sort((a, b) => moment(a) - moment(b) || stamp(a.start) - stamp(b.start));
  if (mode === "long") return items.sort((a, b) => spanSeconds(b) - spanSeconds(a) || moment(b) - moment(a));
  if (mode === "score") return items.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || moment(b) - moment(a));
  if (mode === "category") return items.sort((a, b) => a.category.localeCompare(b.category, "ru") || moment(b) - moment(a));
  return items.sort((a, b) => {
    if (!a.end !== !b.end) return a.end ? 1 : -1;
    return moment(b) - moment(a) || stamp(b.start) - stamp(a.start);
  });
}

export function TimingView() {
  const scoreOff = usePlanner((s) => s.scoreOff ?? []);
  const timeCats = usePlanner((s) => s.timeCats);
  const spans = usePlanner((s) => s.spans);
  const startSpan = usePlanner((s) => s.startSpan);
  const stopSpan = usePlanner((s) => s.stopSpan);
  const deleteSpan = usePlanner((s) => s.deleteSpan);
  const updateSpan = usePlanner((s) => s.updateSpan);
  const moveSpan = usePlanner((s) => s.moveSpan);
  const addManualSpan = usePlanner((s) => s.addManualSpan);
  const [day, setDay] = useState(dayKey());
  const [sort, setSort] = useState<SpanSort>("new");
  const [manual, setManual] = useState(false);
  const [cats, setCats] = useState(false);
  const [editId, setEditId] = useState("");
  const [ask, setAsk] = useState<{ category: string; mode: "start" | "stop" } | null>(null);
  const [askTime, setAskTime] = useState("12:00");
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const daySpans = sortSpans(
    spans.filter((span) => span.day === day),
    sort,
  );
  const open = daySpans.find((span) => !span.end);
  const totals = new Map<string, number>();
  for (const span of daySpans) totals.set(span.category, (totals.get(span.category) ?? 0) + spanSeconds(span));
  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const score = dayScore(spans, day);
  const ratedCount = daySpans.filter((span) => span.end && span.score).length;

  function begin(category: string) {
    if (day !== dayKey()) {
      setAskTime("12:00");
      setAsk({ category, mode: "start" });
      return;
    }
    playStart();
    startSpan(category);
  }

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist">Лента дня</p>
          <h1 className="font-display text-4xl capitalize">{formatDay(day)}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-full bg-panel px-3 py-2" onClick={() => setDay(addDays(day, -1))}>
            Назад
          </button>
          <button type="button" className="rounded-full bg-panel px-3 py-2" onClick={() => setDay(dayKey())}>
            Сегодня
          </button>
          <button type="button" className="rounded-full bg-panel px-3 py-2" onClick={() => setDay(addDays(day, 1))}>
            Вперёд
          </button>
        </div>
      </header>

      <section className="mb-4 rounded-card border border-line bg-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-3xl">{open ? `${open.category} · ${fmtSpan(spanSeconds(open))}` : "Пауза"}</p>
            <p className="text-sm text-mist">Нажатие категории ставит старт и закрывает предыдущую.</p>
          </div>
          <button type="button" className="shrink-0 rounded-full border border-line px-3 py-2 text-sm text-gold" onClick={() => setCats(true)}>
            Редактировать категории
          </button>
        </div>
        {open ? (
          <button
            type="button"
            className="mt-3 rounded-full bg-ember px-4 py-2 text-ink"
            onClick={() => {
              if (day !== dayKey()) {
                setAskTime("18:00");
                setAsk({ category: open.category, mode: "stop" });
                return;
              }
              playStop();
              stopSpan(day);
            }}
          >
            Стоп
          </button>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {timeCats.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => begin(name)}
              className={`rounded-full px-3 py-2 text-sm ${open?.category === name ? "bg-gold text-ink" : "bg-panel-2"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5">
        <section className="md:col-span-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">Интервалы</h2>
            <div className="flex items-center gap-2">
              <select className="rounded-full border border-line bg-panel-2 px-3 py-1 text-sm text-cream" value={sort} onChange={(event) => setSort(event.target.value as SpanSort)} aria-label="Сортировка">
                <option value="new">Сначала новые</option>
                <option value="old">Сначала старые</option>
                <option value="long">По длительности</option>
                <option value="score">По оценке</option>
                <option value="category">По категории</option>
                <option value="hand">Свой порядок</option>
              </select>
              <button type="button" className="text-sm text-gold" onClick={() => setManual(true)}>
                Вручную
              </button>
            </div>
          </div>
          <ul className="space-y-2">
            {daySpans.map((span, index) => (
              <li key={span.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
                <div className="flex items-center gap-2">
                  {sort === "hand" ? (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      title="Выше"
                      disabled={index === 0}
                      className="text-gold disabled:opacity-30"
                      onClick={() => {
                        playTap();
                        moveSpan(span.id, -1);
                      }}
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Ниже"
                      disabled={index === daySpans.length - 1}
                      className="text-gold disabled:opacity-30"
                      onClick={() => {
                        playTap();
                        moveSpan(span.id, 1);
                      }}
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </span>
                  ) : null}
                  <button type="button" className="w-28 text-left text-sm text-mist" onClick={() => setEditId(span.id)}>
                    {clock(span.start)} – {span.end ? clock(span.end) : "идёт"}
                  </button>
                  <button type="button" className="flex-1 text-left" onClick={() => setEditId(span.id)}>
                    {span.category}
                  </button>
                  <span className="text-gold">{fmtSpan(spanSeconds(span))}</span>
                  <button type="button" className="text-sm text-gold" onClick={() => setEditId(span.id)}>
                    Изменить
                  </button>
                  <button type="button" className="text-sm text-ember" onClick={() => { playTap(); deleteSpan(span.id); }}>
                    Удалить
                  </button>
                </div>
                {span.end && !scoreOff.includes(span.category) ? (
                  <div className="mt-3">
                    <ScorePips value={span.score} onPick={(value) => updateSpan(span.id, { score: value })} />
                  </div>
                ) : null}
              </li>
            ))}
            {daySpans.length === 0 ? <li className="text-mist">За этот день ещё пусто.</li> : null}
          </ul>
        </section>
        <aside className="rounded-card border border-line bg-panel p-4 md:col-span-2">
          <h2 className="font-display text-2xl">Итого</h2>
          <ul className="mt-3 space-y-2">
            {[...totals.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([name, seconds]) => (
                <li key={name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{name}</span>
                    <span>{fmtHm(seconds)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full bg-gold" style={{ width: `${grand ? (seconds / grand) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
          </ul>
          <p className="mt-4 font-display text-xl">Всего {fmtHm(grand)}</p>
          <p className="mt-4 text-sm text-mist">
            Оценка дня
            <span className="mt-1 block font-display text-3xl text-cream">{score ?? "—"}</span>
            {score != null ? `Среднее из ${ratedCount} этапов` : "Поставь оценку каждому закрытому этапу"}
          </p>
        </aside>
      </div>
      {editId ? (
        <EditSpan
          span={spans.find((span) => span.id === editId)}
          categories={timeCats}
          onClose={() => setEditId("")}
          onSave={(patch) => {
            updateSpan(editId, patch);
            setEditId("");
          }}
        />
      ) : null}
      {cats ? (
        <Modal title="Категории" onClose={() => setCats(false)}>
          <TimeCategories />
        </Modal>
      ) : null}
      {ask ? (
        <Modal title={ask.mode === "start" ? "Начало" : "Окончание"} onClose={() => setAsk(null)}>
          <Field label="Время, часы и минуты">
            <input className={inputClass} value={askTime} onChange={(event) => setAskTime(event.target.value)} />
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              const iso = combine(day, askTime);
              if (!iso) return;
              if (ask.mode === "start") startSpan(ask.category, iso);
              else stopSpan(day, iso);
              setAsk(null);
            }}
          >
            Сохранить
          </button>
        </Modal>
      ) : null}
      {manual ? (
        <Manual
          categories={timeCats}
          onClose={() => setManual(false)}
          onSave={(category, start, end) => {
            const a = combine(day, start);
            const b = combine(day, end);
            if (!a || !b || new Date(b) <= new Date(a)) return;
            addManualSpan(category, day, a, b);
            setManual(false);
          }}
        />
      ) : null}
    </div>
  );
}

function hhmm(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function EditSpan({
  span,
  categories,
  onClose,
  onSave,
}: {
  span: { category: string; start: string; end: string } | undefined;
  categories: string[];
  onClose: () => void;
  onSave: (patch: { category: string; start: string; end: string }) => void;
}) {
  const [category, setCategory] = useState(span?.category ?? categories[0] ?? "");
  const [start, setStart] = useState(span ? hhmm(span.start) : "09:00");
  const [end, setEnd] = useState(span?.end ? hhmm(span.end) : "");
  const [error, setError] = useState("");
  if (!span) return null;
  return (
    <Modal title="Интервал" onClose={onClose}>
      <Field label="Категория">
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
          {category && !categories.includes(category) ? <option>{category}</option> : null}
        </select>
      </Field>
      <Field label="Начало">
        <input className={inputClass} value={start} onChange={(event) => setStart(event.target.value)} />
      </Field>
      <Field label="Конец, пусто если ещё идёт">
        <input className={inputClass} value={end} onChange={(event) => setEnd(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <button
        type="button"
        className="w-full rounded-full bg-gold py-3 text-ink"
        onClick={() => {
          const nextStart = combine(dayFromIso(span.start), start);
          const nextEnd = end.trim() ? combine(dayFromIso(span.start), end) : "";
          if (!nextStart || (end.trim() && !nextEnd)) {
            setError("Время в формате 08:30");
            return;
          }
          if (nextEnd && new Date(nextEnd) <= new Date(nextStart)) {
            setError("Конец должен быть позже начала");
            return;
          }
          onSave({ category, start: nextStart, end: nextEnd });
        }}
      >
        Сохранить
      </button>
    </Modal>
  );
}

function dayFromIso(iso: string) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function combine(day: string, hhmmValue: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmmValue.trim());
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d, hours, minutes, 0).toISOString();
}

function Manual({
  categories,
  onClose,
  onSave,
}: {
  categories: string[];
  onClose: () => void;
  onSave: (category: string, start: string, end: string) => void;
}) {
  const [category, setCategory] = useState(categories[0] ?? "");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  return (
    <Modal title="Интервал вручную" onClose={onClose}>
      <Field label="Категория">
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </Field>
      <Field label="Начало">
        <input className={inputClass} value={start} onChange={(event) => setStart(event.target.value)} />
      </Field>
      <Field label="Конец">
        <input className={inputClass} value={end} onChange={(event) => setEnd(event.target.value)} />
      </Field>
      <button type="button" className="w-full rounded-full bg-gold py-3 text-ink" onClick={() => onSave(category, start, end)}>
        Добавить
      </button>
    </Modal>
  );
}
