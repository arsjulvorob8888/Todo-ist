import { useState } from "react";
import { Field, inputClass, Modal } from "@/components/modal";
import { dayKey, monthDayLabel, nextCelebration } from "@/lib/dates";
import { usePlanner } from "@/lib/store";

const TITLES = {
  time: "Время",
  project: "Проекты",
  people: "Люди",
  ideas: "Идеи",
  books: "Книги",
} as const;

export function TimeCategories() {
  const timeCats = usePlanner((s) => s.timeCats);
  const projects = usePlanner((s) => s.projects);
  const catProject = usePlanner((s) => s.catProject ?? {});
  const addCategory = usePlanner((s) => s.addCategory);
  const renameCategory = usePlanner((s) => s.renameCategory);
  const deleteCategory = usePlanner((s) => s.deleteCategory);
  const placeCategory = usePlanner((s) => s.placeCategory);
  const scoreOff = usePlanner((s) => s.scoreOff ?? []);
  const setCategoryScore = usePlanner((s) => s.setCategoryScore);
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [nextProject, setNextProject] = useState("");
  return (
    <div>
      <Field label="Название">
        <input className={inputClass} placeholder="Новая категория" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Проект">
        <select className={inputClass} value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">Выбери проект</option>
          {projects.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="mb-4 w-full rounded-full bg-gold py-3 text-ink disabled:opacity-40"
        disabled={!name.trim() || !project}
        onClick={() => {
          addCategory("time", name, project);
          setName("");
        }}
      >
        Добавить в проект
      </button>
      <ul className="space-y-2">
        {timeCats.map((item) => (
          <li key={item} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-3 py-3">
            <span>
              {item}
              <span className={`mt-0.5 block text-xs ${catProject[item] ? "text-mist" : "text-ember"}`}>
                {catProject[item] ? `Проект: ${catProject[item]}` : "Проект не назначен"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3 text-sm">
              <label className="flex items-center gap-1.5 text-xs text-mist" title="Нужна ли оценка этого действия">
                <input
                  type="checkbox"
                  className="size-4 accent-gold"
                  checked={!scoreOff.includes(item)}
                  onChange={(event) => setCategoryScore(item, event.target.checked)}
                />
                Оценка
              </label>
              <button
                type="button"
                className="text-gold"
                onClick={() => {
                  setEdit(item);
                  setNext(item);
                  setNextProject(catProject[item] || projects[0] || "Прочее");
                }}
              >
                Править
              </button>
              <button type="button" className="text-ember" onClick={() => deleteCategory("time", item)}>
                Удалить
              </button>
            </span>
          </li>
        ))}
      </ul>
      {edit ? (
        <Modal title="Категория" onClose={() => setEdit(null)}>
          <Field label="Название">
            <input className={inputClass} value={next} onChange={(event) => setNext(event.target.value)} />
          </Field>
          <Field label="Проект">
            <select className={inputClass} value={nextProject} onChange={(event) => setNextProject(event.target.value)}>
              {projects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              if (next.trim() && next.trim() !== edit) renameCategory("time", edit, next);
              placeCategory(next.trim() || edit, nextProject);
              setEdit(null);
            }}
          >
            Сохранить
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

export function LibraryView({ section }: { section: keyof typeof TITLES }) {
  const projects = usePlanner((s) => s.projects);
  const timeCats = usePlanner((s) => s.timeCats);
  const catProject = usePlanner((s) => s.catProject ?? {});
  const addCategory = usePlanner((s) => s.addCategory);
  const renameCategory = usePlanner((s) => s.renameCategory);
  const deleteCategory = usePlanner((s) => s.deleteCategory);
  const contacts = usePlanner((s) => s.contacts);
  const ideas = usePlanner((s) => s.ideas);
  const books = usePlanner((s) => s.books);
  const addContact = usePlanner((s) => s.addContact);
  const deleteContact = usePlanner((s) => s.deleteContact);
  const addIdea = usePlanner((s) => s.addIdea);
  const addBook = usePlanner((s) => s.addBook);

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-mist">Справочник</p>
        <h1 className="font-display text-4xl">{TITLES[section]}</h1>
      </header>
      {section === "time" ? (
        <Cats kind="time" names={timeCats} onAdd={addCategory} onRename={renameCategory} onDelete={deleteCategory} />
      ) : null}
      {section === "project" ? (
        <Cats
          kind="project"
          names={projects}
          notes={Object.fromEntries(
            projects.map((project) => [project, timeCats.filter((name) => (catProject[name] || "Прочее") === project).join(", ")]),
          )}
          onAdd={addCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
      ) : null}
      {section === "people" ? (
        <People contacts={contacts} onAdd={addContact} onDelete={deleteContact} />
      ) : null}
      {section === "ideas" ? <Ideas ideas={ideas} onAdd={addIdea} /> : null}
      {section === "books" ? <Books books={books} onAdd={addBook} /> : null}
    </div>
  );
}

function Cats({
  kind,
  names,
  notes,
  onAdd,
  onRename,
  onDelete,
}: {
  kind: "time" | "project";
  names: string[];
  notes?: Record<string, string>;
  onAdd: (kind: "time" | "project", name: string) => void;
  onRename: (kind: "time" | "project", from: string, to: string) => void;
  onDelete: (kind: "time" | "project", name: string) => void;
}) {
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [next, setNext] = useState("");
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <input className={inputClass} placeholder="Новая категория" value={name} onChange={(event) => setName(event.target.value)} />
        <button
          type="button"
          className="rounded-full bg-gold px-4 text-ink"
          onClick={() => {
            onAdd(kind, name);
            setName("");
          }}
        >
          Добавить
        </button>
      </div>
      <ul className="space-y-2">
        {names.map((item) => (
          <li key={item} className="flex items-center justify-between rounded-2xl border border-line bg-panel px-3 py-3">
            <span>
              {item}
              {notes?.[item] ? <span className="mt-0.5 block text-xs text-mist">{notes[item]}</span> : null}
            </span>
            <span className="flex gap-3 text-sm">
              <button
                type="button"
                className="text-gold"
                onClick={() => {
                  setEdit(item);
                  setNext(item);
                }}
              >
                Править
              </button>
              <button type="button" className="text-ember" onClick={() => onDelete(kind, item)}>
                Удалить
              </button>
            </span>
          </li>
        ))}
      </ul>
      {edit ? (
        <Modal title="Категория" onClose={() => setEdit(null)}>
          <Field label="Название">
            <input className={inputClass} value={next} onChange={(event) => setNext(event.target.value)} />
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              onRename(kind, edit, next);
              setEdit(null);
            }}
          >
            Сохранить
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function People({
  contacts,
  onAdd,
  onDelete,
}: {
  contacts: { id: string; name: string; group: string; birthday: string; kind?: "birthday" | "holiday" }[];
  onAdd: (contact: { name: string; group: string; birthday: string; kind?: "birthday" | "holiday" }) => void;
  onDelete: (id: string) => void;
}) {
  const today = dayKey();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [birthday, setBirthday] = useState("");
  const [eventName, setEventName] = useState("");
  const [kind, setKind] = useState<"birthday" | "holiday">("birthday");
  const [eventDate, setEventDate] = useState("");
  const celebrations = contacts
    .map((person) => ({ person, next: nextCelebration(person.birthday, today) }))
    .filter((item): item is { person: (typeof contacts)[number]; next: NonNullable<ReturnType<typeof nextCelebration>> } => item.next != null)
    .sort((a, b) => a.next.days - b.next.days || a.person.name.localeCompare(b.person.name, "ru"));
  const soon = celebrations.filter((item) => item.next.days <= 14);
  const dated = new Set(celebrations.map((item) => item.person.id));

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Ближайшие 2 недели</h2>
        {soon.length === 0 ? <p className="mt-2 text-sm text-mist">В ближайшие 14 дней дней рождения и праздников нет.</p> : null}
        <ul className="mt-3 space-y-2">
          {soon.map(({ person, next }) => (
            <li key={person.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {person.name}
                <span className="text-mist"> · {person.kind === "holiday" ? "праздник" : "день рождения"} · {monthDayLabel(person.birthday)}</span>
              </span>
              <span className="shrink-0 text-gold">{next.days === 0 ? "сегодня" : next.days === 1 ? "завтра" : `через ${next.days} дн.`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Дни рождения и праздники</h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!eventName.trim() || !eventDate) return;
            onAdd({
              name: eventName.trim(),
              group: kind === "holiday" ? "Праздник" : "День рождения",
              birthday: eventDate,
              kind,
            });
            setEventName("");
            setEventDate("");
          }}
        >
          <input className={inputClass} placeholder="Кого поздравить" value={eventName} onChange={(event) => setEventName(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`rounded-full px-3 py-1 text-sm ${kind === "birthday" ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`} onClick={() => setKind("birthday")}>
              День рождения
            </button>
            <button type="button" className={`rounded-full px-3 py-1 text-sm ${kind === "holiday" ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`} onClick={() => setKind("holiday")}>
              Праздник
            </button>
          </div>
          <input className={inputClass} type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} aria-label="Дата" />
          <button type="submit" className="rounded-full bg-gold px-4 py-2 text-ink">
            Добавить
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {celebrations.map(({ person, next }) => (
            <li key={person.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-3">
              <span>
                {person.name}
                <span className="mt-0.5 block text-xs text-mist">
                  {person.kind === "holiday" ? "Праздник" : "День рождения"} · {monthDayLabel(person.birthday)}
                  {next.year && person.kind !== "holiday" && next.days === 0 ? ` · исполняется ${Number(today.slice(0, 4)) - next.year}` : ""}
                </span>
              </span>
              <button type="button" className="text-sm text-ember" onClick={() => onDelete(person.id)}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <button type="button" className="mb-3 rounded-full bg-gold px-4 py-2 text-ink" onClick={() => setOpen(true)}>
          Человек
        </button>
        <ul className="space-y-2">
          {contacts
            .filter((person) => !dated.has(person.id))
            .map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-3 py-3">
                <span>
                  {person.name} · {person.group || "без группы"}
                </span>
                <button type="button" className="text-sm text-ember" onClick={() => onDelete(person.id)}>
                  Удалить
                </button>
              </li>
            ))}
        </ul>
      </section>
      {open ? (
        <Modal title="Контакт" onClose={() => setOpen(false)}>
          <Field label="Имя">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Группа">
            <input className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)} />
          </Field>
          <Field label="День рождения">
            <input className={inputClass} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              if (!name.trim()) return;
              onAdd({ name: name.trim(), group, birthday, kind: birthday ? "birthday" : undefined });
              setName("");
              setGroup("");
              setBirthday("");
              setOpen(false);
            }}
          >
            Сохранить
          </button>
        </Modal>
      ) : null}
    </div>
  );
}

function Ideas({
  ideas,
  onAdd,
}: {
  ideas: { id: string; title: string; note: string }[];
  onAdd: (idea: { title: string; note: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  return (
    <div>
      <input className={`${inputClass} mb-2`} placeholder="Идея" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${inputClass} mb-2`} rows={3} placeholder="Суть" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        type="button"
        className="rounded-full bg-gold px-4 py-2 text-ink"
        onClick={() => {
          if (!title.trim()) return;
          onAdd({ title: title.trim(), note });
          setTitle("");
          setNote("");
        }}
      >
        Записать
      </button>
      <ul className="mt-4 space-y-2">
        {ideas.map((idea) => (
          <li key={idea.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
            <p className="font-display text-xl">{idea.title}</p>
            <p className="text-sm text-mist">{idea.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Books({
  books,
  onAdd,
}: {
  books: { id: string; title: string; author: string; date: string }[];
  onAdd: (book: { title: string; author: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input className={inputClass} placeholder="Книга" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={inputClass} placeholder="Автор" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <button
          type="button"
          className="rounded-full bg-gold px-4 py-2 text-ink"
          onClick={() => {
            if (!title.trim()) return;
            onAdd({ title: title.trim(), author });
            setTitle("");
            setAuthor("");
          }}
        >
          Добавить
        </button>
      </div>
      <ul className="space-y-2">
        {books.map((book) => (
          <li key={book.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
            {book.title} — {book.author} <span className="text-mist">{book.date}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
