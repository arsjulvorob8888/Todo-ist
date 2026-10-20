import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import { dayKey, endOfDayMs } from "@/lib/dates";

export type Board = { id: string; name: string; color: string; inbox: boolean };
export type Mark = { id: string; name: string; color: string };
export type Priority = "Низкий" | "Средний" | "Высокий" | "Срочно";
export type Status = "В ожидании" | "В процессе" | "Выполнено";

export type Task = {
  id: string;
  title: string;
  project: string;
  priority: Priority;
  status: Status;
  deadline: string;
  description: string;
  created: string;
  completed: string;
  pomodoros: number;
  beforeStatus?: Status;
  projectId?: string;
  labelIds?: string[];
  order?: number;
  category?: string;
};

export type Span = {
  id: string;
  day: string;
  category: string;
  start: string;
  end: string;
  score?: number;
  order?: number;
};

export type RoutineBlock = {
  id: string;
  category: string;
  start: string;
  end: string;
};

export type Kpi = { id: string; name: string; target: number; current: number; unit: string };
export type Goal = {
  id: string;
  title: string;
  content: string;
  deadline?: string;
  done?: boolean;
  percent?: number;
  kpis?: Kpi[];
};
export type Contact = { id: string; name: string; group: string; birthday: string };
export type Idea = { id: string; title: string; note: string };
export type Book = { id: string; title: string; author: string; date: string };

export type Reward = { id: string; amount: number; text: string; levelUp: boolean };

export type Pomo = {
  running: boolean;
  mode: "focus" | "break";
  endsAt: number;
  remaining: number;
  taskId: string;
  minutes: number;
};

const COLORS = ["#e8a317", "#ef5d32", "#7aa2f7", "#8fbf6a", "#c58af9", "#f2a2c0"];

export function makeBoards(names: string[]): Board[] {
  return [
    { id: "inbox", name: "Входящие", color: "#e8a317", inbox: true },
    ...names
      .filter((name) => name !== "Входящие")
      .map((name, index) => ({
        id: `project-${index}-${name}`,
        name,
        color: COLORS[index % COLORS.length] ?? "#e8a317",
        inbox: false,
      })),
  ];
}

const LABELS: Mark[] = [
  { id: "call", name: "Звонок", color: "#ef5d32" },
  { id: "idea", name: "Идея", color: "#e8a317" },
  { id: "home", name: "Дом", color: "#8fbf6a" },
  { id: "wait", name: "Ждёт", color: "#7aa2f7" },
];
const PROJECTS = ["Работа / Бизнес", "Финансы", "Здоровье", "Семья", "Обучение", "Дом", "Блог", "Электрика", "Прочее"];
const TIME = [
  "Работа",
  "Сон",
  "Еда",
  "Спорт",
  "Чтение",
  "Планирование",
  "Соцсети",
  "Отдых",
  "Дорога",
  "Здоровье",
  "Финансы",
  "Программирование",
  "Электрика",
  "Общение",
  "Йога",
  "Покер",
  "Сбор",
  "Уборка",
  "Философия",
];

const uid = () => crypto.randomUUID();

export function levelInfo(xp: number) {
  let level = 1;
  let rest = xp;
  let need = 80;
  while (rest >= need) {
    rest -= need;
    level += 1;
    need = 60 + level * 20;
  }
  return { level, into: rest, need };
}

export function dayScore(spans: Span[], day: string) {
  const rated = spans.filter((span) => span.day === day && span.end && span.score);
  if (rated.length === 0) return null;
  const sum = rated.reduce((total, span) => total + (span.score ?? 0), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

export function compareSpans(a: { order?: number; start: string }, b: { order?: number; start: string }) {
  const aSet = a.order != null;
  const bSet = b.order != null;
  if (aSet && bSet) return (a.order ?? 0) - (b.order ?? 0);
  if (aSet !== bSet) return aSet ? 1 : -1;
  return b.start.localeCompare(a.start);
}

export function compareTasks(a: Task, b: Task) {
  const aSet = a.order != null;
  const bSet = b.order != null;
  if (aSet && bSet) return (a.order ?? 0) - (b.order ?? 0);
  if (aSet !== bSet) return aSet ? 1 : -1;
  return b.created.localeCompare(a.created);
}

export function spanSeconds(span: Span, now = Date.now()) {
  const start = new Date(span.start).getTime();
  const cap = span.end ? new Date(span.end).getTime() : Math.min(now, endOfDayMs(span.day));
  return Math.max(0, (cap - start) / 1000);
}

export function streakCount(tasks: Task[], spans: Span[]) {
  const days = new Set<string>();
  for (const task of tasks) if (task.completed) days.add(task.completed.slice(0, 10));
  for (const span of spans) days.add(span.day);
  let cursor = dayKey();
  if (!days.has(cursor)) cursor = shift(cursor, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = shift(cursor, -1);
  }
  return n;
}

function shift(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

type State = {
  mission: string;
  xp: number;
  sound: boolean;
  projects: string[];
  boards: Board[];
  labels: Mark[];
  timeCats: string[];
  routine: RoutineBlock[];
  routineDone: Record<string, string[]>;
  tasks: Task[];
  spans: Span[];
  goals: Goal[];
  contacts: Contact[];
  ideas: Idea[];
  books: Book[];
  scores: Record<string, number>;
  pomo: Pomo;
  reward: Reward | null;
  undo: { id: string; title: string; at: number } | null;
  burst: number;
  setMission: (value: string) => void;
  toggleSound: () => void;
  addTask: (task: Omit<Task, "id" | "created" | "completed" | "pomodoros" | "status"> & { status?: Status }) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  placeTask: (id: string, targetId: string, after: boolean) => void;
  completeTask: (id: string) => void;
  dismissUndo: () => void;
  deleteTask: (id: string) => void;
  startSpan: (category: string, at?: string) => void;
  stopSpan: (day: string, at?: string) => void;
  updateSpan: (id: string, patch: Partial<Span>) => void;
  moveSpan: (id: string, direction: -1 | 1) => void;
  deleteSpan: (id: string) => void;
  addManualSpan: (category: string, day: string, start: string, end: string) => void;
  setScore: (day: string, score: number) => void;
  addGoal: (goal: Omit<Goal, "id" | "done"> & { done?: boolean }) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  toggleGoal: (id: string) => void;
  deleteGoal: (id: string) => void;
  renameCategory: (kind: "project" | "time", from: string, to: string) => void;
  addCategory: (kind: "project" | "time", name: string) => void;
  deleteCategory: (kind: "project" | "time", name: string) => void;
  addRoutine: (category: string, start: string, end: string) => void;
  updateRoutine: (id: string, patch: Partial<RoutineBlock>) => void;
  moveRoutine: (id: string, direction: -1 | 1) => void;
  placeRoutine: (id: string, targetId: string, after: boolean) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineDone: (id: string) => void;
  addLabel: (name: string) => void;
  deleteLabel: (id: string) => void;
  addContact: (contact: Omit<Contact, "id">) => void;
  addIdea: (idea: Omit<Idea, "id">) => void;
  addBook: (book: Omit<Book, "id" | "date">) => void;
  startPomo: (minutes: number, taskId?: string, mode?: "focus" | "break") => void;
  focusTask: (id: string, minutes?: number) => void;
  pausePomo: () => void;
  stopPomo: () => void;
  finishPomo: () => void;
  clearReward: () => void;
};

const emptyPomo = (): Pomo => ({
  running: false,
  mode: "focus",
  endsAt: 0,
  remaining: 25 * 60,
  taskId: "",
  minutes: 25,
});

export const usePlanner = create<State>()(
  persist(
    (set, get) => ({
      mission:
        "Стать лучшей версией себя: хитрым, мудрым, живучим, успешным. Превращать хаос в порядок — в себе, в других и в мире.",
      xp: 0,
      sound: true,
      projects: PROJECTS,
      boards: makeBoards(PROJECTS),
      labels: LABELS,
      timeCats: TIME,
      routine: [],
      routineDone: {},
      tasks: [],
      spans: [],
      goals: [{ id: "mission-goal", title: "Финансовая свобода", content: "Чистая прибыль 300 000 ₽ в месяц. Капитал 10 млн. Пассив 100 000 ₽." }],
      contacts: [],
      ideas: [],
      books: [],
      scores: {},
      pomo: emptyPomo(),
      reward: null,
      undo: null,
      burst: 0,
      setMission: (mission) => set({ mission }),
      toggleSound: () => set({ sound: !get().sound }),
      addTask: (task) => {
        const board =
          get().boards.find((item) => item.id === task.projectId) ||
          get().boards.find((item) => item.name === task.project) ||
          get().boards.find((item) => item.inbox);
        const orders = get().tasks.map((item) => item.order).filter((value): value is number => value != null);
        set({
          tasks: [
            {
              id: uid(),
              created: new Date().toISOString(),
              completed: "",
              pomodoros: 0,
              status: task.status ?? "В ожидании",
              labelIds: task.labelIds ?? [],
              ...task,
              projectId: board?.id ?? "inbox",
              project: board?.name ?? task.project,
              ...(orders.length ? { order: Math.min(...orders) - 1 } : {}),
            },
            ...get().tasks,
          ],
        });
      },
      updateTask: (id, patch) => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
      placeTask: (id, targetId, after) => {
        const list = [...get().tasks].sort(compareTasks);
        const from = list.findIndex((task) => task.id === id);
        if (from < 0 || id === targetId) return;
        const [item] = list.splice(from, 1);
        let to = list.findIndex((task) => task.id === targetId);
        if (to < 0 || !item) return;
        if (after) to += 1;
        list.splice(to, 0, item);
        set({ tasks: list.map((task, index) => ({ ...task, order: index })) });
      },
      completeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        if (task.status === "Выполнено") {
          set({
            undo: null,
            xp: Math.max(0, get().xp - 15),
            tasks: get().tasks.map((t) =>
              t.id === id ? { ...t, status: t.beforeStatus || "В ожидании", completed: "", beforeStatus: undefined } : t,
            ),
          });
          return;
        }
        const gained = award(get().xp, 15, "Задача закрыта");
        set({
          tasks: get().tasks.map((t) =>
            t.id === id ? { ...t, status: "Выполнено", beforeStatus: t.status, completed: new Date().toISOString() } : t,
          ),
          undo: { id, title: task.title, at: Date.now() },
          ...gained,
          burst: get().burst + 1,
        });
      },
      dismissUndo: () => set({ undo: null }),
      deleteTask: (id) => set({ tasks: get().tasks.filter((t) => t.id !== id) }),
      startSpan: (category, at) => {
        const moment = at ? new Date(at) : new Date();
        const day = dayKey(moment);
        const iso = moment.toISOString();
        let spans = get().spans.map((span) => ({ ...span }));
        const open = spans.find((span) => span.day === day && !span.end);
        if (open && open.category === category && !at) return;
        if (open) {
          if (moment.getTime() <= new Date(open.start).getTime()) return;
          open.end = iso;
        }
        const firstToday = !spans.some((span) => span.day === day);
        spans = [...spans, { id: uid(), day, category, start: iso, end: "" }];
        const gained = open ? award(get().xp, 3, "Этап закрыт") : firstToday ? award(get().xp, 5, "День начат") : {};
        set({ spans, ...gained, ...(open || firstToday ? { burst: get().burst + 1 } : {}) });
      },
      stopSpan: (day, at) => {
        const moment = at ? new Date(at) : new Date();
        let closed = false;
        const spans = get().spans.map((span) => {
          if (span.day !== day || span.end) return span;
          if (moment.getTime() <= new Date(span.start).getTime()) return span;
          closed = true;
          return { ...span, end: moment.toISOString() };
        });
        const gained = closed ? award(get().xp, 3, "Этап закрыт") : {};
        set({ spans, ...gained, ...(closed ? { burst: get().burst + 1 } : {}) });
      },
      updateSpan: (id, patch) => {
        const prev = get().spans.find((span) => span.id === id);
        const spans = get().spans.map((span) => (span.id === id ? { ...span, ...patch } : span));
        const scored = typeof patch.score === "number" && prev && prev.score !== patch.score;
        const gained = scored ? award(get().xp, 2, `Оценка ${patch.score}`) : {};
        set({ spans, ...gained, ...(scored ? { burst: get().burst + 1 } : {}) });
      },
      moveSpan: (id, direction) => {
        const all = get().spans;
        const span = all.find((item) => item.id === id);
        if (!span) return;
        const dayList = all
          .filter((item) => item.day === span.day)
          .sort(compareSpans);
        const index = dayList.findIndex((item) => item.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= dayList.length) return;
        const ids = dayList.map((item) => item.id);
        [ids[index], ids[next]] = [ids[next]!, ids[index]!];
        const rank = new Map(ids.map((itemId, place) => [itemId, place]));
        set({
          spans: all.map((item) => (item.day === span.day ? { ...item, order: rank.get(item.id) ?? item.order } : item)),
        });
      },
      deleteSpan: (id) => set({ spans: get().spans.filter((span) => span.id !== id) }),
      addManualSpan: (category, day, start, end) =>
        set({
          spans: [...get().spans, { id: uid(), day, category, start, end }],
        }),
      setScore: (day, score) => set({ scores: { ...get().scores, [day]: score } }),
      addGoal: (goal) =>
        set({
          goals: [
            ...get().goals,
            {
              id: uid(),
              title: goal.title.trim(),
              content: goal.content ?? "",
              deadline: goal.deadline ?? "",
              done: false,
              percent: goal.percent ?? 0,
              kpis: goal.kpis ?? [],
            },
          ],
        }),
      updateGoal: (id, patch) => set({ goals: get().goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)) }),
      toggleGoal: (id) =>
        set({ goals: get().goals.map((goal) => (goal.id === id ? { ...goal, done: !goal.done } : goal)) }),
      deleteGoal: (id) => set({ goals: get().goals.filter((g) => g.id !== id) }),
      renameCategory: (kind, from, to) => {
        const clean = to.trim();
        if (!clean || clean === from) return;
        if (kind === "project") {
          set({
            projects: get().projects.map((name) => (name === from ? clean : name)),
            boards: get().boards.map((board) => (board.name === from ? { ...board, name: clean } : board)),
            tasks: get().tasks.map((task) => (task.project === from ? { ...task, project: clean } : task)),
          });
        } else {
          set({
            timeCats: get().timeCats.map((name) => (name === from ? clean : name)),
            spans: get().spans.map((span) => (span.category === from ? { ...span, category: clean } : span)),
            routine: (get().routine ?? []).map((block) => (block.category === from ? { ...block, category: clean } : block)),
          });
        }
      },
      addCategory: (kind, name) => {
        const clean = name.trim();
        if (!clean) return;
        if (kind === "project") {
          if (get().projects.includes(clean) || get().boards.some((board) => board.name === clean)) return;
          const board = {
            id: uid(),
            name: clean,
            color: COLORS[get().boards.length % COLORS.length] ?? "#e8a317",
            inbox: false,
          };
          set({
            projects: [...get().projects, clean].sort((a, b) => a.localeCompare(b, "ru")),
            boards: [...get().boards, board],
          });
        } else {
          if (get().timeCats.includes(clean)) return;
          set({ timeCats: [...get().timeCats, clean].sort((a, b) => a.localeCompare(b, "ru")) });
        }
      },
      deleteCategory: (kind, name) => {
        if (kind === "project") {
          set({
            projects: get().projects.filter((item) => item !== name),
            boards: get().boards.filter((board) => board.inbox || board.name !== name),
          });
        } else {
          set({
            timeCats: get().timeCats.filter((item) => item !== name),
            routine: (get().routine ?? []).filter((block) => block.category !== name),
          });
        }
      },
      addLabel: (name) => {
        const clean = name.trim();
        if (!clean || get().labels.some((label) => label.name === clean)) return;
        set({
          labels: [...get().labels, { id: uid(), name: clean, color: COLORS[get().labels.length % COLORS.length] ?? "#e8a317" }],
        });
      },
      deleteLabel: (id) =>
        set({
          labels: get().labels.filter((label) => label.id !== id),
          tasks: get().tasks.map((task) => ({ ...task, labelIds: (task.labelIds ?? []).filter((labelId) => labelId !== id) })),
        }),
      addContact: (contact) => set({ contacts: [...get().contacts, { ...contact, id: uid() }] }),
      addIdea: (idea) => set({ ideas: [{ ...idea, id: uid() }, ...get().ideas] }),
      addBook: (book) => set({ books: [{ ...book, id: uid(), date: dayKey() }, ...get().books] }),
      startPomo: (minutes, taskId = "", mode = "focus") =>
        set({
          pomo: {
            running: true,
            mode,
            minutes,
            remaining: minutes * 60,
            endsAt: Date.now() + minutes * 60 * 1000,
            taskId,
          },
        }),
      focusTask: (id, minutes = 25) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task) {
          get().startPomo(minutes, id);
          return;
        }
        const category = task.category || (get().timeCats.includes(task.project) ? task.project : "");
        if (category) get().startSpan(category);
        if (task.status !== "Выполнено" && task.status !== "В процессе") get().updateTask(id, { status: "В процессе" });
        get().startPomo(minutes, id);
      },
      pausePomo: () => {
        const pomo = get().pomo;
        if (!pomo.running) {
          set({ pomo: { ...pomo, running: true, endsAt: Date.now() + pomo.remaining * 1000 } });
          return;
        }
        const remaining = Math.max(0, Math.round((pomo.endsAt - Date.now()) / 1000));
        set({ pomo: { ...pomo, running: false, remaining, endsAt: 0 } });
      },
      stopPomo: () => set({ pomo: emptyPomo() }),
      finishPomo: () => {
        const pomo = get().pomo;
        if (pomo.mode === "break") {
          set({ pomo: emptyPomo() });
          return;
        }
        const taskId = pomo.taskId;
        const gained = award(get().xp, 10, "Помидор закрыт");
        set({
          pomo: { ...emptyPomo(), mode: "break", remaining: 5 * 60, minutes: 5, taskId, running: false },
          tasks: get().tasks.map((task) => (task.id === taskId ? { ...task, pomodoros: task.pomodoros + 1 } : task)),
          ...gained,
          burst: get().burst + 1,
        });
      },
      deleteRoutine: (id) => set({ routine: (get().routine ?? []).filter((block) => block.id !== id) }),
      addRoutine: (category, start, end) => {
        const name = category.trim();
        if (!name || !clockOk(start) || !clockOk(end)) return;
        set({ routine: [...(get().routine ?? []), { id: uid(), category: name, start, end }] });
      },
      updateRoutine: (id, patch) =>
        set({
          routine: (get().routine ?? []).map((block) => (block.id === id ? { ...block, ...patch } : block)),
        }),
      moveRoutine: (id, direction) => {
        const list = [...(get().routine ?? [])];
        const index = list.findIndex((block) => block.id === id);
        const next = index + direction;
        if (index < 0 || next < 0 || next >= list.length) return;
        const [item] = list.splice(index, 1);
        list.splice(next, 0, item!);
        set({ routine: list });
      },
      placeRoutine: (id, targetId, after) => {
        const list = [...(get().routine ?? [])];
        const from = list.findIndex((block) => block.id === id);
        if (from < 0 || id === targetId) return;
        const [item] = list.splice(from, 1);
        let to = list.findIndex((block) => block.id === targetId);
        if (to < 0 || !item) return;
        if (after) to += 1;
        list.splice(to, 0, item);
        set({ routine: list });
      },
      toggleRoutineDone: (id) => {
        const day = dayKey();
        const done = { ...(get().routineDone ?? {}) };
        const ids = new Set(done[day] ?? []);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        done[day] = [...ids];
        const cutoff = shiftDay(day, -14);
        for (const key of Object.keys(done)) if (key < cutoff) delete done[key];
        set({ routineDone: done });
      },
      clearReward: () => set({ reward: null }),
    }),
    {
      name: "poryadok-v1",
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<State>;
        const projects = saved.projects?.length ? saved.projects : current.projects;
        return {
          ...current,
          ...saved,
          projects,
          boards: saved.boards?.length ? saved.boards : makeBoards(projects),
          labels: saved.labels?.length ? saved.labels : current.labels,
          routine: saved.routine ?? [],
          routineDone: saved.routineDone ?? {},
          burst: 0,
          reward: null,
          undo: null,
        };
      },
    },
  ),
);

function shiftDay(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

function clockOk(value: string) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function award(xp: number, amount: number, text: string): Pick<State, "xp" | "reward"> {
  const before = levelInfo(xp).level;
  const next = xp + amount;
  return {
    xp: next,
    reward: { id: uid(), amount, text, levelUp: levelInfo(next).level > before },
  };
}

export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (usePlanner.persist.hasHydrated()) setReady(true);
    return usePlanner.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}
