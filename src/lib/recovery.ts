import { usePlanner, type Goal, type Priority, type Status, type Task } from "@/lib/store";

const FLAG = "todo-aka-recovery-1";

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
    labelIds: [],
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
  task("Потренироваться", "Высокий", "2026-10-20T07:05:00.000Z", "2026-10-20", "Спорт"),
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

export function recoverIfEmpty() {
  if (typeof localStorage === "undefined") return;
  const state = usePlanner.getState();
  if (state.tasks.length > 0) {
    localStorage.setItem(FLAG, "kept");
    return;
  }
  if (localStorage.getItem(FLAG) === "kept") return;
  const timeCats = [...new Set([...CATS, ...state.timeCats])].sort((a, b) => a.localeCompare(b, "ru"));
  usePlanner.setState({
    timeCats,
    tasks: TASKS,
    goals: state.goals.length > 0 ? state.goals : GOALS,
    xp: state.xp > 0 ? state.xp : 144,
  });
  localStorage.setItem(FLAG, "restored");
}
