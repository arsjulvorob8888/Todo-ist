import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { Field, inputClass, Modal } from "@/components/modal";
import { addDays, dayKey } from "@/lib/dates";
import { playStart, playTap } from "@/lib/sound";
import { compareTasks, usePlanner, type Board, type Mark, type Priority, type Task } from "@/lib/store";

const PRIORITIES: Priority[] = ["Срочно", "Высокий", "Средний", "Низкий"];
const OPEN = "Все кроме выполнено";
const STATUSES = [OPEN, "Все", "В ожидании", "В процессе", "Выполнено"];

export function TasksView() {
  const tasks = usePlanner((s) => s.tasks);
  const projects = usePlanner((s) => s.projects);
  const addTask = usePlanner((s) => s.addTask);
  const completeTask = usePlanner((s) => s.completeTask);
  const deleteTask = usePlanner((s) => s.deleteTask);
  const updateTask = usePlanner((s) => s.updateTask);
  const placeTask = usePlanner((s) => s.placeTask);
  const boards = usePlanner((s) => s.boards);
  const labels = usePlanner((s) => s.labels);
  const addLabel = usePlanner((s) => s.addLabel);
  const focusTask = usePlanner((s) => s.focusTask);
  const timeCats = usePlanner((s) => s.timeCats);
  const catProject = usePlanner((s) => s.catProject ?? {});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState(OPEN);
  const [priority, setPriority] = useState("Все");
  const [due, setDue] = useState("Все");
  const [project, setProject] = useState("Все");
  const [labelId, setLabelId] = useState("Все");
  const [labelName, setLabelName] = useState("");
  const [now, setNow] = useState(Date.now());
  const [dragId, setDragId] = useState("");
  const [overId, setOverId] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef("");
  const overRef = useRef("");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const visible = tasks.filter((task) => {
    if (filter === OPEN && task.status === "Выполнено") return false;
    if (filter !== "Все" && filter !== OPEN && task.status !== filter) return false;
    if (priority !== "Все" && task.priority !== priority) return false;
    if (!matchesDue(task, due)) return false;
    if (project !== "Все" && task.projectId !== project && task.project !== project) return false;
    if (labelId !== "Все" && !(task.labelIds ?? []).includes(labelId)) return false;
    return true;
  }).sort(compareTasks);

  function finishDrag(clientY: number) {
    const from = dragRef.current;
    const target = overRef.current;
    dragRef.current = "";
    overRef.current = "";
    setDragId("");
    setOverId("");
    if (!from || !target || from === target) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${target}"]`);
    const box = row?.getBoundingClientRect();
    const after = box ? clientY > box.top + box.height / 2 : false;
    placeTask(from, target, after);
    playTap();
  }

  function resetFilters() {
    setFilter(OPEN);
    setPriority("Все");
    setDue("Все");
    setProject("Все");
    setLabelId("Все");
  }

  return (
    <div>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mist">Одно действие — одна цель</p>
          <h1 className="font-display text-4xl">Задачи</h1>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-gold px-4 py-2 text-ink">
          Новая
        </button>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setFilter(name)}
            className={`rounded-full px-3 py-2 text-sm ${filter === name ? "bg-gold text-ink" : "bg-panel text-mist"}`}
          >
            {name}
          </button>
        ))}
        <select className={inputClass + " w-auto"} value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="Все">Все проекты</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setLabelId("Все")}
          className={`rounded-full px-3 py-1 text-sm ${labelId === "Все" ? "bg-gold text-ink" : "bg-panel text-mist"}`}
        >
          Все метки
        </button>
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => setLabelId(label.id)}
            className={`rounded-full px-3 py-1 text-sm ${labelId === label.id ? "text-ink" : "text-cream"}`}
            style={{ background: labelId === label.id ? label.color : "transparent", border: `1px solid ${label.color}` }}
          >
            {label.name}
          </button>
        ))}
        <input
          className={inputClass + " w-36"}
          placeholder="Новая метка"
          value={labelName}
          onChange={(event) => setLabelName(event.target.value)}
        />
        <button
          type="button"
          className="rounded-full bg-panel-2 px-3 py-2 text-sm"
          onClick={() => {
            addLabel(labelName);
            setLabelName("");
          }}
        >
          Метка
        </button>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs tracking-wide text-mist uppercase">
          Важность
          <select className={inputClass + " mt-1"} value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="Все">Все</option>
            {PRIORITIES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs tracking-wide text-mist uppercase">
          Статус
          <select className={inputClass + " mt-1"} value={filter} onChange={(event) => setFilter(event.target.value)}>
            {STATUSES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs tracking-wide text-mist uppercase">
          Дедлайн
          <select className={inputClass + " mt-1"} value={due} onChange={(event) => setDue(event.target.value)}>
            {["Все", "Просрочен", "Сегодня", "Завтра", "7 дней", "Без дедлайна"].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <ul ref={listRef} className="space-y-2">
        {visible.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            now={now}
            labels={labels}
            dragging={dragId === task.id}
            over={overId === task.id}
            onDragStart={() => {
              dragRef.current = task.id;
              setDragId(task.id);
            }}
            onDragMove={(clientY) => {
              if (!dragRef.current || !listRef.current) return;
              const rows = [...listRef.current.querySelectorAll<HTMLElement>("[data-id]")];
              const hit = rows.find((row) => {
                const box = row.getBoundingClientRect();
                return clientY >= box.top && clientY <= box.bottom;
              });
              const next = hit?.dataset.id ?? "";
              if (next !== overRef.current) {
                overRef.current = next;
                setOverId(next);
              }
            }}
            onDragEnd={finishDrag}
            onDragCancel={() => {
              dragRef.current = "";
              overRef.current = "";
              setDragId("");
              setOverId("");
            }}
            onDone={() => completeTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            onEdit={() => setEditing(task)}
            onProgress={() => updateTask(task.id, { status: "В процессе" })}
            onPomo={() => {
              playStart();
              focusTask(task.id, 25);
            }}
          />
        ))}
      </ul>
      {visible.length === 0 ? (
        <p className="mt-6 text-mist">
          {tasks.length === 0 ? "Нет задач в этом фильтре." : "В этом фильтре пусто."}
          {tasks.length > 0 ? (
            <button
              type="button"
              className="ml-3 rounded-full bg-gold px-3 py-1 text-ink"
              onClick={resetFilters}
            >
              Показать все ({tasks.length})
            </button>
          ) : null}
        </p>
      ) : null}
      {open ? (
        <TaskForm
          projects={projects}
          boards={boards}
          labels={labels}
          categories={timeCats}
          catProject={catProject}
          onClose={() => setOpen(false)}
          onSave={(task) => {
            addTask(task);
            setFilter(OPEN);
            setPriority("Все");
            setDue("Все");
            setProject("Все");
          }}
        />
      ) : null}
      {editing ? (
        <TaskForm
          projects={projects}
          boards={boards}
          labels={labels}
          categories={timeCats}
          catProject={catProject}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(task) => {
            updateTask(editing.id, task);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function deadlineLeft(deadline: string, now: number) {
  if (!deadline) return null;
  const end = new Date(`${deadline}T23:59:59`).getTime();
  if (Number.isNaN(end)) return null;
  const delta = end - now;
  const total = Math.floor(Math.abs(delta) / 60000);
  const days = Math.floor(total / (60 * 24));
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const text =
    days > 0
      ? `${days} д ${hours} ч ${String(minutes).padStart(2, "0")} мин`
      : `${hours} ч ${String(minutes).padStart(2, "0")} мин`;
  return { overdue: delta < 0, text };
}

function priorityLook(priority: Priority, done: boolean) {
  if (done) return { rail: "border-l-line", wash: "bg-panel", ring: "border-line", pill: "bg-panel-2 text-mist" };
  if (priority === "Срочно") return { rail: "border-l-ember", wash: "bg-ember/10", ring: "border-ember", pill: "bg-ember text-ink" };
  if (priority === "Высокий") return { rail: "border-l-gold", wash: "bg-panel", ring: "border-gold", pill: "border border-gold text-gold" };
  if (priority === "Средний") return { rail: "border-l-gold-2", wash: "bg-panel", ring: "border-gold-2", pill: "bg-panel-2 text-cream" };
  return { rail: "border-l-line", wash: "bg-panel", ring: "border-line", pill: "text-mist" };
}

function matchesDue(task: Task, due: string) {
  if (due === "Все") return true;
  if (due === "Без дедлайна") return !task.deadline;
  if (!task.deadline) return false;
  const today = dayKey();
  if (due === "Просрочен") return task.deadline < today && task.status !== "Выполнено";
  if (due === "Сегодня") return task.deadline === today;
  if (due === "Завтра") return task.deadline === addDays(today, 1);
  if (due === "7 дней") return task.deadline >= today && task.deadline <= addDays(today, 7);
  return true;
}

function TaskRow({
  task,
  now,
  labels,
  dragging,
  over,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onDone,
  onDelete,
  onEdit,
  onProgress,
  onPomo,
}: {
  task: Task;
  now: number;
  labels: Mark[];
  dragging: boolean;
  over: boolean;
  onDragStart: () => void;
  onDragMove: (clientY: number) => void;
  onDragEnd: (clientY: number) => void;
  onDragCancel: () => void;
  onDone: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onProgress: () => void;
  onPomo: () => void;
}) {
  const done = task.status === "Выполнено";
  const look = priorityLook(task.priority, done);
  const left = deadlineLeft(task.deadline, now);
  return (
    <li
      data-id={task.id}
      className={`flex items-center gap-3 rounded-card border border-l-4 px-3 py-3 ${look.rail} ${look.wash} ${dragging ? "border-gold opacity-60" : over ? "border-gold" : "border-line"}`}
    >
      <button
        type="button"
        title="Перетащить"
        aria-label="Перетащить"
        className="cursor-grab touch-none text-mist active:cursor-grabbing"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          onDragMove(event.clientY);
        }}
        onPointerUp={(event) => onDragEnd(event.clientY)}
        onPointerCancel={onDragCancel}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        aria-label={done ? "Вернуть в работу" : "Выполнить"}
        onClick={onDone}
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${done ? "border-gold bg-gold text-ink" : look.ring}`}
      >
        {done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`flex flex-wrap items-center gap-2 ${done ? "text-mist line-through" : ""}`}>
          <span>{task.title}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold tracking-wide ${look.pill}`}>{task.priority}</span>
        </p>
        <p className="text-xs text-mist">
          Поставлена {formatCreated(task.created)}
          {task.category ? ` · ${task.category}` : ""} · дедлайн {formatDeadline(task.deadline)} · {task.status}
        </p>
        {(task.labelIds ?? []).length ? (
          <p className="mt-1 flex flex-wrap gap-1">
            {labels
              .filter((label) => (task.labelIds ?? []).includes(label.id))
              .map((label) => (
                <span key={label.id} className="rounded-full px-2 py-0.5 text-xs text-ink" style={{ background: label.color }}>
                  {label.name}
                </span>
              ))}
          </p>
        ) : null}
      </div>
      {left ? (
        <span
          className={`shrink-0 text-right text-sm whitespace-nowrap tabular-nums ${left.overdue ? "text-ember" : done ? "text-mist" : "text-gold"}`}
          title={left.overdue ? "Дедлайн прошёл" : "До конца дня дедлайна"}
        >
          {left.overdue ? `−${left.text}` : left.text}
        </span>
      ) : null}
      <button type="button" onClick={onEdit} className="text-sm text-gold">
        Править
      </button>
      {!done ? (
        <button type="button" onClick={onProgress} className="hidden text-sm text-mist sm:block">
          В работе
        </button>
      ) : null}
      <button type="button" onClick={onPomo} className="rounded-full bg-gold px-3 py-2 text-sm text-ink">
        25 мин
      </button>
      <button type="button" onClick={onDelete} className="text-sm text-ember">
        Удалить
      </button>
    </li>
  );
}

function TaskForm({
  projects,
  boards,
  labels,
  categories,
  catProject,
  initial,
  onClose,
  onSave,
}: {
  projects: string[];
  boards: Board[];
  labels: Mark[];
  categories: string[];
  catProject: Record<string, string>;
  initial?: Task;
  onClose: () => void;
  onSave: (task: { title: string; project: string; projectId: string; labelIds: string[]; priority: Priority; deadline: string; description: string; category: string }) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "Средний");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [picked, setPicked] = useState<string[]>(initial?.labelIds ?? []);
  const [error, setError] = useState("");
  return (
    <Modal title={initial ? "Править задачу" : "Новая задача"} onClose={onClose}>
      <Field label="Текст">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Категория">
        <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Выбери категорию</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
              {catProject[name] ? ` · ${catProject[name]}` : ""}
            </option>
          ))}
        </select>
      </Field>
      {category ? (
        <p className={`-mt-2 mb-3 text-sm ${catProject[category] ? "text-mist" : "text-ember"}`}>
          {catProject[category] ? `Проект: ${catProject[category]}` : "Проект не назначен. Открой категории в тайминге и выбери проект."}
        </p>
      ) : null}
      <Field label="Метки">
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => {
            const on = picked.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => setPicked((current) => (on ? current.filter((id) => id !== label.id) : [...current, label.id]))}
                className="rounded-full px-3 py-1 text-sm"
                style={{ background: on ? label.color : "transparent", color: on ? "#12110e" : "#f4efe6", border: `1px solid ${label.color}` }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Важность">
        <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
          {PRIORITIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Дедлайн">
        <input className={inputClass} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
      </Field>
      <Field label="Заметка">
        <textarea className={inputClass} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      {initial?.created ? <p className="mb-3 text-sm text-mist">Поставлена {formatCreated(initial.created)}. Это время не меняется.</p> : null}
      {error ? <p className="mb-2 text-sm text-ember">{error}</p> : null}
      <button
        type="button"
        className="mt-2 w-full rounded-full bg-gold py-3 text-ink"
        onClick={() => {
          if (!title.trim() || !deadline || !category) {
            setError("Нужны текст, категория и дедлайн");
            return;
          }
          const projectName = catProject[category];
          if (!projectName) {
            setError("У этой категории ещё нет проекта. Назначь его в тайминге.");
            return;
          }
          const home = boards.find((item) => item.name === projectName) || boards.find((item) => item.inbox);
          onSave({
            title: title.trim(),
            project: home?.name || projectName,
            projectId: home?.id || projectName,
            labelIds: picked,
            priority,
            deadline,
            description,
            category,
          });
          onClose();
        }}
      >
        Сохранить
      </button>
    </Modal>
  );
}

function formatCreated(iso: string) {
  if (!iso) return "без даты";
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDeadline(key: string) {
  if (!key) return "не задан";
  return new Date(dayKeyToDate(key)).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function dayKeyToDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d || 1);
}
