import { useEffect, useState } from "react";
import { authClient, authEnabled, signIn, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { mailReady } from "@/lib/auth/mail.functions";
import { inputClass } from "@/components/modal";
import { DesktopDownload } from "@/components/desktop-download";
import { BACKUP_FILE, backupFolderName, chooseBackupFolder, downloadBackup, latestBackup, restoreBackupFile } from "@/lib/backup";
import { syncNow, useSyncStatus } from "@/lib/sync";

export function AccountView() {
  const { user, isPending } = useCurrentUserState();
  const { status } = useSyncStatus();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [mailOn, setMailOn] = useState(false);
  const signedIn = Boolean(user && !user.isDevFallback);

  useEffect(() => {
    void mailReady()
      .then((result) => setMailOn(result.configured))
      .catch(() => setMailOn(false));
  }, []);

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm text-mist">Личный кабинет</p>
      <h1 className="font-display text-4xl">Аккаунт</h1>
      <article className="mt-4 rounded-card border border-gold bg-panel p-4">
        <p className="text-xs tracking-wide text-gold uppercase">Тариф</p>
        <p className="font-display text-3xl">BETA FREE</p>
        <p className="text-sm text-mist">Один план на время беты ToDO-AKA. Проекты, метки, помидор и синхронизация телефона с компьютером — без оплаты.</p>
      </article>
      <DesktopDownload />
      <BackupCard />
      <p className="mt-4 text-sm text-mist">Связь: {statusText(status)}. Без интернета всё остаётся на устройстве и уходит на сервер, когда сеть вернётся.</p>
      <button type="button" className="mt-3 rounded-full bg-panel-2 px-4 py-2 text-sm" onClick={() => void syncNow()}>
        Синхронизировать
      </button>

      {!authEnabled ? (
        <p className="mt-6 text-sm text-mist">
          В этом окне предпросмотра вход выключен, данные остаются на устройстве. На опубликованном сайте здесь будет регистрация по почте — один аккаунт для телефона и компьютера.
        </p>
      ) : null}

      {authEnabled && isPending ? <p className="mt-6 text-mist">Проверяю сессию…</p> : null}

      {authEnabled && !isPending && signedIn ? (
        <article className="mt-6 rounded-card border border-line bg-panel p-4">
          <p className="font-display text-2xl">{user?.displayName || "Без имени"}</p>
          <p className="text-sm text-mist">{user?.primaryEmail}</p>
          <button type="button" className="mt-4 rounded-full bg-ember px-4 py-2 text-ink" onClick={() => void signOut("/account")}>
            Выйти
          </button>
        </article>
      ) : null}

      {authEnabled && !isPending && !signedIn ? (
        <>
          <button
            type="button"
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-cream py-3 font-semibold text-ink"
            onClick={() => void signInGoogle()}
          >
            <GoogleMark />
            Войти через Google
          </button>
          <p className="mt-4 text-center text-xs tracking-wide text-mist uppercase">или почта</p>
          <p className="mt-2 text-center text-sm text-mist">
            {mailOn
              ? "После создания аккаунта открой письмо и нажми «Подтвердить почту». Если письма нет во входящих — загляни в Спам."
              : "Подтверждение письмом включится, когда в Render будут SMTP_USER и SMTP_PASS ящика Яндекса."}
          </p>
          {sentTo ? (
            <article className="mt-4 rounded-card border border-gold bg-panel p-4">
              <p className="font-display text-2xl">Проверь почту</p>
              <p className="mt-2 text-sm text-mist">
                Письмо ушло на {sentTo}. Открой его и подтверди адрес. После этого кабинет откроется сам.
              </p>
              {error ? <p className="mt-2 text-sm text-ember">{error}</p> : null}
              <button type="button" className="mt-4 rounded-full bg-gold px-4 py-2 text-ink" onClick={() => void resend()}>
                Отправить ещё раз
              </button>
            </article>
          ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {mode === "up" ? (
              <input className={inputClass} placeholder="Имя" value={name} onChange={(event) => setName(event.target.value)} />
            ) : null}
            <input className={inputClass} type="email" placeholder="Почта" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className={inputClass} type="password" placeholder="Пароль, от 8 символов" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error ? <p className="text-sm text-ember">{error}</p> : null}
            <button type="submit" className="w-full rounded-full bg-gold py-3 text-ink">
              {mode === "up" ? "Создать аккаунт" : "Войти"}
            </button>
            <button type="button" className="text-sm text-gold" onClick={() => setMode(mode === "up" ? "in" : "up")}>
              {mode === "up" ? "Уже есть аккаунт" : "Создать аккаунт"}
            </button>
          </form>
          )}
        </>
      ) : null}
    </div>
  );

  async function signInGoogle() {
    setError("");
    const preview = window.location.hostname.endsWith(".grok-sandbox.com");
    if (preview) {
      try {
        await signIn("grok-google", { callbackURL: "/account", errorCallbackURL: "/account" });
      } catch (error) {
        setError(error instanceof Error ? error.message : "Не удалось войти через Google");
      }
      return;
    }
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/account",
    });
    if (result.error) {
      setError("Google не подключён. В Render нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET, затем Manual Deploy.");
    }
  }

  async function submit() {
    setError("");
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов.");
      return;
    }
    const result =
      mode === "up"
        ? await authClient.signUp.email({ name: name.trim() || email, email, password, callbackURL: "/account" })
        : await authClient.signIn.email({ email, password, callbackURL: "/account" });
    if (result.error) {
      const raw = result.error.message || "";
      if (raw.toLowerCase().includes("not verified") || raw.toLowerCase().includes("email_not_verified")) {
        setSentTo(email);
      }
      setError(raw ? ruAuthError(raw) : "Сервер регистрации ещё старый. На Render нажми Manual Deploy и подожди, пока сайт станет Live.");
      return;
    }
    if (result.data?.user && result.data.user.emailVerified === false && !result.data.token) {
      setSentTo(email);
      return;
    }
    await syncNow();
  }

  async function resend() {
    setError("");
    const target = sentTo || email;
    const result = await authClient.sendVerificationEmail({ email: target, callbackURL: "/account" });
    if (result.error) {
      setError("Письмо не ушло. Проверь SMTP_USER и SMTP_PASS в Render и подожди новый деплой.");
      return;
    }
    setSentTo(target);
  }
}

function ruAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already") || text.includes("exist")) return "Такая почта уже зарегистрирована. Нажми «Уже есть аккаунт» и войди.";
  if (text.includes("password") && text.includes("short")) return "Пароль должен быть не короче 8 символов.";
  if (text.includes("not verified") || text.includes("email_not_verified")) {
    return "Почта ещё не подтверждена. Открой письмо и нажми ссылку. Если его нет — проверь Спам.";
  }
  if (text.includes("invalid email or password") || text.includes("invalid_email")) {
    return "Неверная почта или пароль.";
  }
  if (text.includes("invalid")) return "Неверная почта или пароль.";
  return message || "Не получилось. Попробуй ещё раз.";
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15.1 2A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}

function BackupCard() {
  const [folder, setFolder] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void backupFolderName().then(setFolder);
    void latestBackup().then((snap) => setSavedAt(snap?.savedAt ?? ""));
  }, []);

  return (
    <article className="mt-4 rounded-card border border-line bg-panel p-4">
      <p className="text-xs tracking-wide text-gold uppercase">Резервная копия</p>
      <p className="mt-2 font-display text-2xl">Файл {BACKUP_FILE}</p>
      <p className="mt-2 text-sm text-mist">
        {folder
          ? `Он лежит в папке «${folder}», которую ты выбрал. Ищи файл с этим именем.`
          : "Папка ещё не выбрана. Нажми «Запомнить папку» и укажи, например, Документы. После этого файл будет обновляться сам."}
      </p>
      <p className="mt-2 text-sm text-mist">
        Кнопка «Скачать файл» кладёт такую же копию в папку «Загрузки». Отдельно в браузере хранятся последние 20 автоматических копий. Пустой экран их не стирает.
        {savedAt ? ` Последняя: ${new Date(savedAt).toLocaleString("ru")}.` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-gold px-4 py-2 text-sm text-ink"
          onClick={() => {
            setNote("");
            void chooseBackupFolder()
              .then((name) => {
                setFolder(name);
                setNote(`Записал файл в папку «${name}».`);
              })
              .catch((error: unknown) => setNote(error instanceof Error ? error.message : "Папку выбрать не удалось"));
          }}
        >
          Запомнить папку
        </button>
        <button
          type="button"
          className="rounded-full bg-panel-2 px-4 py-2 text-sm"
          onClick={() => {
            downloadBackup();
            setNote("Файл скачан. Он в папке «Загрузки».");
          }}
        >
          Скачать файл
        </button>
        <label className="cursor-pointer rounded-full bg-panel-2 px-4 py-2 text-sm">
          Восстановить из файла
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void restoreBackupFile(file)
                .then(() => setNote("Данные из файла возвращены."))
                .catch((error: unknown) => setNote(error instanceof Error ? error.message : "Файл не подошёл"));
            }}
          />
        </label>
      </div>
      {note ? <p className="mt-3 text-sm text-gold">{note}</p> : null}
    </article>
  );
}

function statusText(status: string) {
  if (status === "offline") return "офлайн, работаю локально";
  if (status === "sync") return "синхронизирую";
  if (status === "ok") return "синхронизировано";
  return "только это устройство";
}
