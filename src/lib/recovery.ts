import { usePlanner, type Goal, type Priority, type Span, type Status, type Task } from "@/lib/store";

const FLAG = "todo-aka-recovery-2";

const CATS = [
  "DevOps",
  "Дорога",
  "Еда",
  "Здоровье",
  "Йога | Медитация",
  "Общение",
  "Отдых",
  "Планирование",
  "Покер",
  "Программирование",
  "Работа",
  "Решение текущих вопросов",
  "Сбор",
  "Сон",
  "Соцсети",
  "Спорт",
  "Туалет / Душ",
  "Уборка",
  "Философия | Психология",
  "Финансы",
  "Чтение",
];

function task(
  title: string,
  priority: Priority,
  created: string,
  deadline: string,
  category: string,
  labelIds: string[] = [],
): Task {
  return {
    id: `recovered-${created.slice(11, 16)}-${title.slice(0, 12)}`.replace(/\s/g, "-"),
    title,
    project: "",
    projectId: "inbox",
    priority,
    status: "В ожидании" as Status,
    deadline,
    description: "",
    created,
    completed: "",
    pomodoros: 0,
    labelIds,
    category,
  };
}

const TASKS: Task[] = [
  task("Изучение Устава через ИИ", "Средний", "2026-10-20T10:45:00.000Z", "2026-11-01", "Чтение"),
  task("Сборка - разборка АК-12", "Высокий", "2026-10-20T10:45:00.000Z", "2026-10-21", "Решение текущих вопросов"),
  task("Написать по поводу сдачи квартиры", "Средний", "2026-10-20T08:36:00.000Z", "2026-10-30", "Решение текущих вопросов"),
  task(
    "Узнать насчет учета в военкомате (поселок или оставить в Надыме на время службы)",
    "Высокий",
    "2026-10-20T07:45:00.000Z",
    "2026-11-08",
    "Решение текущих вопросов",
  ),
  task("Сделать прописку в Усть-Донецке", "Высокий", "2026-10-20T07:45:00.000Z", "2026-11-10", "Решение текущих вопросов"),
  task("Начать изучение английского", "Средний", "2026-10-20T07:18:00.000Z", "2026-10-20", "Чтение"),
  task("Продумать о проверки безопасности", "Высокий", "2026-10-20T07:10:00.000Z", "2026-10-20", "Планирование"),
  task("Начать чтение книг", "Средний", "2026-10-20T07:08:00.000Z", "2026-10-20", "Чтение"),
  task("Доработать торговую стратегию", "Средний", "2026-10-20T07:06:00.000Z", "2026-10-20", "Финансы"),
  task("Потренироваться", "Высокий", "2026-10-20T07:05:00.000Z", "2026-10-20", "Спорт", ["bang"]),
  task("Доработать проект Todo-AKA", "Срочно", "2026-10-20T07:00:00.000Z", "2026-10-25", "Программирование"),
];

const GOALS: Goal[] = [
  {
    id: "recovered-finance",
    title: "Финансовая свобода",
    content: "Чистая прибыль 300 000 ₽ в месяц.\nКапитал 10 млн.\nПассив 100 000 ₽.",
    deadline: "",
    done: false,
    percent: 0,
    kpis: [
      { id: "kpi-profit", name: "Ежемесячная прибыль", target: 300000, current: 150000, unit: "руб." },
      { id: "kpi-capital", name: "Капитал (-долги)", target: 10000000, current: 7000000, unit: "руб." },
      { id: "kpi-passive", name: "Пассив", target: 100000, current: 26000, unit: "руб." },
    ],
  },
];

function span(id: string, category: string, start: string, end: string): Span {
  return { id, day: "2026-10-20", category, start, end };
}

const SPANS: Span[] = [
  span("recovered-span-sleep", "Сон", "2026-10-20T00:22:00+02:00", "2026-10-20T08:52:00+02:00"),
  span("recovered-span-shower", "Туалет / Душ", "2026-10-20T08:52:00+02:00", "2026-10-20T10:05:00+02:00"),
  span("recovered-span-rest", "Отдых", "2026-10-20T10:05:00+02:00", "2026-10-20T11:18:00+02:00"),
  span("recovered-span-plan-1", "Планирование", "2026-10-20T11:18:00+02:00", "2026-10-20T11:53:00+02:00"),
  span("recovered-span-code-1", "Программирование", "2026-10-20T11:53:00+02:00", "2026-10-20T12:08:00+02:00"),
  span("recovered-span-social", "Соцсети", "2026-10-20T12:08:00+02:00", "2026-10-20T12:31:00+02:00"),
  span("recovered-span-errand", "Решение текущих вопросов", "2026-10-20T12:31:00+02:00", "2026-10-20T12:45:00+02:00"),
  span("recovered-span-work", "Работа", "2026-10-20T12:45:00+02:00", "2026-10-20T12:49:00+02:00"),
  span("recovered-span-plan-2", "Планирование", "2026-10-20T12:49:00+02:00", "2026-10-20T13:08:00+02:00"),
  span("recovered-span-code-2", "Программирование", "2026-10-20T13:08:00+02:00", "2026-10-20T13:27:00+02:00"),
  span("recovered-span-food", "Еда", "2026-10-20T13:27:00+02:00", "2026-10-20T13:43:00+02:00"),
];

export function recoverIfEmpty() {
  if (typeof localStorage === "undefined" || localStorage.getItem(FLAG) === "done") return;
  const state = usePlanner.getState();
  const titles = new Set(state.tasks.map((item) => item.title));
  const tasks = [
    ...state.tasks.map((item) => {
      const known = TASKS.find((saved) => saved.title === item.title);
      if (!known) return item;
      return { ...item, category: item.category || known.category, labelIds: item.labelIds?.length ? item.labelIds : known.labelIds };
    }),
    ...TASKS.filter((item) => !titles.has(item.title)),
  ];
  const goalTitles = new Set(state.goals.map((item) => item.title));
  const goals = [...state.goals, ...GOALS.filter((item) => !goalTitles.has(item.title))];
  const timeCats = [...new Set([...state.timeCats, ...CATS])].sort((a, b) => a.localeCompare(b, "ru"));
  const daySeconds = state.spans
    .filter((item) => item.day === "2026-10-20")
    .reduce((sum, item) => sum + Math.max(0, new Date(item.end || item.start).getTime() - new Date(item.start).getTime()) / 1000, 0);
  const spans = daySeconds > 3600 ? state.spans : [...state.spans, ...SPANS.filter((item) => !state.spans.some((have) => have.id === item.id))];
  const labels = state.labels.some((item) => item.name === "!!!")
    ? state.labels
    : [...state.labels, { id: "bang", name: "!!!", color: "#c58af9" }];
  usePlanner.setState({
    tasks,
    goals,
    timeCats,
    spans,
    labels,
    xp: Math.max(state.xp, 144),
  });
  localStorage.setItem(FLAG, "done");
}