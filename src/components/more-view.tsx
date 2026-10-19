import { useState } from "react";
import { Field, inputClass, Modal } from "@/components/modal";
import { usePlanner } from "@/lib/store";

export function MoreView() {
  const projects = usePlanner((s) => s.projects);
  const timeCats = usePlanner((s) => s.timeCats);
  const addCategory = usePlanner((s) => s.addCategory);
  const renameCategory = usePlanner((s) => s.renameCategory);
  const deleteCategory = usePlanner((s) => s.deleteCategory);
  const contacts = usePlanner((s) => s.contacts);
  const ideas = usePlanner((s) => s.ideas);
  const books = usePlanner((s) => s.books);
  const addContact = usePlanner((s) => s.addContact);
  const addIdea = usePlanner((s) => s.addIdea);
  const addBook = usePlanner((s) => s.addBook);
  const [tab, setTab] = useState<"time" | "project" | "people" | "ideas" | "books">("time");

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm text-mist">Справочники</p>
        <h1 className="font-display text-4xl">Ещё</h1>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["time", "Время"],
            ["project", "Проекты"],
            ["people", "Люди"],
            ["ideas", "Идеи"],
            ["books", "Книги"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-2 text-sm ${tab === id ? "bg-gold text-ink" : "bg-panel text-mist"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "time" ? (
        <Cats kind="time" names={timeCats} onAdd={addCategory} onRename={renameCategory} onDelete={deleteCategory} />
      ) : null}
      {tab === "project" ? (
        <Cats kind="project" names={projects} onAdd={addCategory} onRename={renameCategory} onDelete={deleteCategory} />
      ) : null}
      {tab === "people" ? <People contacts={contacts} onAdd={addContact} /> : null}
      {tab === "ideas" ? <Ideas ideas={ideas} onAdd={addIdea} /> : null}
      {tab === "books" ? <Books books={books} onAdd={addBook} /> : null}
    </div>
  );
}

function Cats({
  kind,
  names,
  onAdd,
  onRename,
  onDelete,
}: {
  kind: "time" | "project";
  names: string[];
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
            <span>{item}</span>
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
}: {
  contacts: { id: string; name: string; group: string; birthday: string }[];
  onAdd: (contact: { name: string; group: string; birthday: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [birthday, setBirthday] = useState("");
  return (
    <div>
      <button type="button" className="mb-3 rounded-full bg-gold px-4 py-2 text-ink" onClick={() => setOpen(true)}>
        Человек
      </button>
      <ul className="space-y-2">
        {contacts.map((person) => (
          <li key={person.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
            {person.name} · {person.group || "без группы"} · {person.birthday || "день рождения не указан"}
          </li>
        ))}
      </ul>
      {open ? (
        <Modal title="Контакт" onClose={() => setOpen(false)}>
          <Field label="Имя">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Группа">
            <input className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)} />
          </Field>
          <Field label="День рождения">
            <input className={inputClass} value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="14.05" />
          </Field>
          <button
            type="button"
            className="w-full rounded-full bg-gold py-3 text-ink"
            onClick={() => {
              if (!name.trim()) return;
              onAdd({ name: name.trim(), group, birthday });
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
