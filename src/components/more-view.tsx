import { useState } from "react";
import { Field, inputClass, Modal } from "@/components/modal";
import { dayKey, monthDayLabel, nextCelebration, parseCelebration } from "@/lib/dates";
import { usePlanner, type Book, type BookKind, type BookStatus, type Priority } from "@/lib/store";

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
  const personNotes = usePlanner((s) => s.personNotes ?? []);
  const ideas = usePlanner((s) => s.ideas);
  const books = usePlanner((s) => s.books);
  const addContact = usePlanner((s) => s.addContact);
  const deleteContact = usePlanner((s) => s.deleteContact);
  const addPersonNote = usePlanner((s) => s.addPersonNote);
  const deletePersonNote = usePlanner((s) => s.deletePersonNote);
  const addIdea = usePlanner((s) => s.addIdea);
  const addBook = usePlanner((s) => s.addBook);
  const addBooks = usePlanner((s) => s.addBooks);
  const updateBook = usePlanner((s) => s.updateBook);
  const deleteBook = usePlanner((s) => s.deleteBook);
  const assignBookTask = usePlanner((s) => s.assignBookTask);

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
        <People
          contacts={contacts}
          notes={personNotes}
          onAdd={addContact}
          onDelete={deleteContact}
          onAddNote={addPersonNote}
          onDeleteNote={deletePersonNote}
        />
      ) : null}
      {section === "ideas" ? <Ideas ideas={ideas} onAdd={addIdea} /> : null}
      {section === "books" ? (
        <Books books={books} onAdd={addBook} onImport={addBooks} onUpdate={updateBook} onDelete={deleteBook} onTask={assignBookTask} />
      ) : null}
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
  notes,
  onAdd,
  onDelete,
  onAddNote,
  onDeleteNote,
}: {
  contacts: { id: string; name: string; group: string; birthday: string; kind?: "birthday" | "holiday" }[];
  notes: { id: string; contactId: string; text: string; created: string }[];
  onAdd: (contact: { name: string; group: string; birthday: string; kind?: "birthday" | "holiday" }) => void;
  onDelete: (id: string) => void;
  onAddNote: (text: string, contactId?: string) => void;
  onDeleteNote: (id: string) => void;
}) {
  const today = dayKey();
  const [eventName, setEventName] = useState("");
  const [kind, setKind] = useState<"birthday" | "holiday">("birthday");
  const [eventDate, setEventDate] = useState("");
  const [note, setNote] = useState("");
  const [notePerson, setNotePerson] = useState("");
  const [sort, setSort] = useState<"soon" | "asc" | "desc">("soon");
  const [tab, setTab] = useState<"dates" | "notes">("dates");
  const celebrations = contacts
    .map((person) => ({ person, next: nextCelebration(person.birthday, today) }))
    .filter((item): item is { person: (typeof contacts)[number]; next: NonNullable<ReturnType<typeof nextCelebration>> } => item.next != null)
    .sort((a, b) => a.next.days - b.next.days || a.person.name.localeCompare(b.person.name, "ru"));
  const listed = [...celebrations].sort((a, b) => {
    if (sort === "soon") return a.next.days - b.next.days || a.person.name.localeCompare(b.person.name, "ru");
    const left = calendarOrder(a.person.birthday);
    const right = calendarOrder(b.person.birthday);
    return sort === "asc" ? left - right : right - left;
  });
  const soon = celebrations.filter((item) => item.next.days <= 14);

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["dates", "Дни рождения и праздники"],
            ["notes", "Заметки"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm ${tab === id ? "bg-gold text-ink" : "border border-line text-mist"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "dates" ? (
      <>
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
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["soon", "Ближайшие"],
              ["asc", "По возрастанию"],
              ["desc", "По убыванию"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSort(id)}
              className={`rounded-full px-3 py-1 text-sm ${sort === id ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {listed.map(({ person, next }) => (
            <li key={person.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-3 py-3">
              <span>
                {person.name}
                <span className="mt-0.5 block text-xs text-mist">
                  {person.kind === "holiday" ? "Праздник" : "День рождения"} · {monthDayLabel(person.birthday)}
                  {sort === "soon" ? ` · ${next.days === 0 ? "сегодня" : next.days === 1 ? "завтра" : `через ${next.days} дн.`}` : ""}
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
      </>
      ) : null}

      {tab === "notes" ? (
      <section className="rounded-card border border-line bg-panel p-4">
        <h2 className="font-display text-2xl">Заметки</h2>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!note.trim()) return;
            onAddNote(note, notePerson);
            setNote("");
          }}
        >
          <select className={inputClass} value={notePerson} onChange={(event) => setNotePerson(event.target.value)}>
            <option value="">Без привязки к человеку</option>
            {[...contacts].sort((a, b) => a.name.localeCompare(b.name, "ru")).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <textarea className={inputClass} rows={3} placeholder="Заметка" value={note} onChange={(event) => setNote(event.target.value)} />
          <button type="submit" className="rounded-full bg-gold px-4 py-2 text-ink">
            Добавить
          </button>
        </form>
        <ul className="mt-4 space-y-2">
          {notes.map((item) => {
            const person = contacts.find((contact) => contact.id === item.contactId);
            return (
              <li key={item.id} className="rounded-2xl border border-line px-3 py-3">
                <p className="text-xs text-mist">
                  {person?.name ?? "Без привязки"} · {new Date(item.created).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
                <button type="button" className="mt-2 text-sm text-ember" onClick={() => onDeleteNote(item.id)}>
                  Удалить
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      ) : null}
    </div>
  );
}

function calendarOrder(raw: string) {
  const parsed = parseCelebration(raw);
  if (!parsed) return 0;
  return parsed.month * 32 + parsed.day;
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

const BOOK_KINDS: { id: BookKind; label: string }[] = [
  { id: "book", label: "Книга" },
  { id: "poem", label: "Стихотворение" },
  { id: "article", label: "Статья" },
  { id: "author", label: "Автор" },
];
const BOOK_STATUSES: { id: BookStatus; label: string }[] = [
  { id: "queue", label: "Очередь" },
  { id: "reading", label: "Читаю" },
  { id: "done", label: "Прочитано" },
  { id: "later", label: "Отложено" },
];
const BOOK_ACTIONS: Record<BookKind, string[]> = {
  book: ["Прочитать", "Законспектировать", "Выписать цитаты"],
  poem: ["Проанализировать", "Выучить наизусть"],
  article: ["Прочитать", "Выписать главное"],
  author: ["Собрать произведения", "Прочитать главную вещь"],
};
const PRIORITIES: Priority[] = ["Срочно", "Высокий", "Средний", "Низкий"];

function Books({
  books,
  onAdd,
  onImport,
  onUpdate,
  onDelete,
  onTask,
}: {
  books: Book[];
  onAdd: (book: Omit<Book, "id" | "date">) => void;
  onImport: (books: { title: string; author: string }[]) => number;
  onUpdate: (id: string, patch: Partial<Omit<Book, "id" | "date">>) => void;
  onDelete: (id: string) => void;
  onTask: (id: string, action: string, comment?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [kind, setKind] = useState<BookKind>("book");
  const [priority, setPriority] = useState<Priority>("Средний");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>("Средний");
  const [draftKind, setDraftKind] = useState<BookKind>("book");
  const [notice, setNotice] = useState("");
  const [paste, setPaste] = useState("");
  const [sort, setSort] = useState<"priority" | "new" | "old" | "title" | "author" | "deadline">("priority");
  const [status, setStatus] = useState<BookStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [taskNote, setTaskNote] = useState<Record<string, string>>({});
  function takeList(text: string, empty: string) {
    const parsed = parseBookList(text);
    const added = onImport(parsed);
    setNotice(added ? `Добавлено книг: ${added}` : parsed.length ? "Эти книги уже есть в списке" : empty);
    return added;
  }
  const shown = books
    .filter((book) => status === "all" || (book.status ?? "queue") === status)
    .filter((book) => (!from || book.date >= from) && (!to || book.date <= to))
    .sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "author") return a.author.localeCompare(b.author, "ru") || a.title.localeCompare(b.title, "ru");
      if (sort === "priority") return priorityRank(a.priority) - priorityRank(b.priority) || (a.deadline || "9999").localeCompare(b.deadline || "9999");
      if (sort === "deadline") return (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.title.localeCompare(b.title, "ru");
      const byDate = a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ru");
      return sort === "old" ? byDate : -byDate;
    });
  return (
    <div>
      <div className="mb-3 space-y-2 rounded-card border border-line bg-panel p-3">
        <input
          className={inputClass}
          placeholder="Название, автор или ссылка"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inputClass} placeholder="Автор" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {PRIORITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input className={inputClass} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} aria-label="Срок прочтения" />
        </div>
        <div className="flex flex-wrap gap-2">
          {BOOK_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setKind(item.id)}
              className={`rounded-full px-3 py-1 text-sm ${kind === item.id ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <textarea className={inputClass} rows={2} placeholder="Зачем читать, что заметить" value={note} onChange={(event) => setNote(event.target.value)} />
        <button
          type="button"
          className="rounded-full bg-gold px-4 py-2 text-ink"
          onClick={() => {
            const captured = captureWork(title);
            if (!captured.title.trim() && !author.trim()) return;
            onAdd({
              title: captured.title.trim() || author.trim(),
              author: author.trim(),
              kind,
              priority,
              deadline,
              note: note.trim(),
              link: captured.link,
              status: "queue",
            });
            setTitle("");
            setAuthor("");
            setNote("");
            setDeadline("");
          }}
        >
          В очередь
        </button>
      </div>
      <div className="mb-3 rounded-card border border-line bg-panel p-3">
        <textarea
          className={`${inputClass} min-h-32`}
          rows={6}
          placeholder={"Вставь список целиком, по одной книге в строке:\nТихий Дон — Шолохов\nМастер и Маргарита — Булгаков"}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded-full bg-gold px-4 py-2 text-ink"
          onClick={() => {
            if (!paste.trim()) return;
            if (takeList(paste, "В тексте не нашлось строк с книгами")) setPaste("");
          }}
        >
          Вставить список
        </button>
      </div>
      <label className="mb-4 flex cursor-pointer flex-col gap-2 rounded-card border border-dashed border-line bg-panel px-4 py-3 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
        <span>Список литературы: файл .txt или .csv, строка «Название — Автор»</span>
        <span className="rounded-full bg-gold px-4 py-2 text-center text-ink">Загрузить список</span>
        <input
          type="file"
          accept=".txt,.csv,.tsv,text/plain,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = String(reader.result ?? "");
              if (text.startsWith("PK") || text.includes("\u0000")) {
                setNotice("Excel так не читается. Сохрани список как .txt или .csv: каждая строка — «Название — Автор»");
                return;
              }
              takeList(text, "В файле не нашлось строк с книгами");
            };
            reader.readAsText(file);
          }}
        />
      </label>
      {notice ? <p className="mb-3 text-sm text-gold">{notice}</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setStatus("all")} className={`rounded-full px-3 py-1 text-sm ${status === "all" ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}>
          Все
        </button>
        {BOOK_STATUSES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStatus(item.id)}
            className={`rounded-full px-3 py-1 text-sm ${status === item.id ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select className={inputClass} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Сортировка">
          <option value="priority">Сначала важные</option>
          <option value="deadline">По сроку прочтения</option>
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="title">По названию</option>
          <option value="author">По автору</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-mist">
          С
          <input className={inputClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Дата добавления с" />
        </label>
        <label className="flex items-center gap-2 text-sm text-mist">
          По
          <input className={inputClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Дата добавления по" />
        </label>
        {from || to ? (
          <button type="button" className="text-sm text-gold" onClick={() => { setFrom(""); setTo(""); }}>
            Сбросить даты
          </button>
        ) : null}
      </div>
      <ul className="space-y-2">
        {shown.map((book) => (
          <li key={book.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
            {editing === book.id ? (
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!draftTitle.trim()) return;
                  onUpdate(book.id, { title: draftTitle, author: draftAuthor, deadline: draftDeadline, note: draftNote, priority: draftPriority, kind: draftKind });
                  setEditing(null);
                }}
              >
                <input className={inputClass} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                <input className={inputClass} value={draftAuthor} onChange={(event) => setDraftAuthor(event.target.value)} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select className={inputClass} value={draftKind} onChange={(event) => setDraftKind(event.target.value as BookKind)}>
                    {BOOK_KINDS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <select className={inputClass} value={draftPriority} onChange={(event) => setDraftPriority(event.target.value as Priority)}>
                    {PRIORITIES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <input className={inputClass} type="date" value={draftDeadline} onChange={(event) => setDraftDeadline(event.target.value)} aria-label="Срок прочтения" />
                </div>
                <textarea className={inputClass} rows={2} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Комментарий" />
                <div className="flex gap-3">
                  <button type="submit" className="text-sm text-gold">
                    Сохранить
                  </button>
                  <button type="button" className="text-sm text-ember" onClick={() => onDelete(book.id)}>
                    Удалить
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p>
                      {book.title}
                      {book.author ? ` — ${book.author}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-mist">
                      {BOOK_KINDS.find((item) => item.id === (book.kind ?? "book"))?.label} · {book.priority ?? "Средний"}
                      {book.deadline ? ` · прочитать до ${book.deadline}` : ""} · добавлена {book.date}
                    </p>
                    {book.note ? <p className="mt-1 text-sm text-mist">{book.note}</p> : null}
                    {book.link ? (
                      <a className="mt-1 block truncate text-sm text-gold" href={book.link} target="_blank" rel="noreferrer">
                        {book.link}
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm text-gold"
                    onClick={() => {
                      setEditing(book.id);
                      setDraftTitle(book.title);
                      setDraftAuthor(book.author);
                      setDraftDeadline(book.deadline ?? "");
                      setDraftNote(book.note ?? "");
                      setDraftPriority(book.priority ?? "Средний");
                      setDraftKind(book.kind ?? "book");
                    }}
                  >
                    Править
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BOOK_STATUSES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdate(book.id, { status: item.id })}
                      className={`rounded-full px-3 py-1 text-xs ${(book.status ?? "queue") === item.id ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BOOK_ACTIONS[book.kind ?? "book"].map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="rounded-full border border-line px-3 py-1 text-xs text-cream"
                      onClick={() => {
                        onTask(book.id, action, taskNote[book.id] ?? "");
                        setNotice(`Задача «${action}: ${book.title}» в списке, категория Чтение`);
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
                <input
                  className={`${inputClass} mt-2`}
                  placeholder="Комментарий к задаче, затем нажми действие"
                  value={taskNote[book.id] ?? ""}
                  onChange={(event) => setTaskNote((current) => ({ ...current, [book.id]: event.target.value }))}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="text-sm text-mist">В этом фильтре книг нет.</p> : null}
    </div>
  );
}

function priorityRank(priority?: Priority) {
  return { Срочно: 0, Высокий: 1, Средний: 2, Низкий: 3 }[priority ?? "Средний"];
}

function captureWork(raw: string) {
  const found = raw.match(/https?:\/\/\S+/);
  const link = found?.[0] ?? "";
  const title = raw.replace(link, "").trim();
  return { title: title || link, link };
}

function parseBookList(raw: string) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const head = lines[0].toLowerCase();
  const header = /(книга|название|title)/.test(head) && /(автор|author)/.test(head);
  return (header ? lines.slice(1) : lines).flatMap((line) => {
    const pair = splitBookLine(line);
    return pair.title ? [pair] : [];
  });
}

function splitBookLine(line: string) {
  const comma = line.split(/[;\t]/);
  if (comma.length >= 2) return { title: cleanCell(comma[0]), author: cleanCell(comma.slice(1).join(" ")) };
  const dash = line.split(/\s+[—–]\s+|\s+-\s+/);
  if (dash.length >= 2) return { title: cleanCell(dash[0]), author: cleanCell(dash.slice(1).join(" — ")) };
  const csv = line.split(",");
  if (csv.length === 2) return { title: cleanCell(csv[0]), author: cleanCell(csv[1]) };
  return { title: cleanCell(line), author: "" };
}

function cleanCell(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}
