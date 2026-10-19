import { useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { inputClass } from "@/components/modal";
import { DesktopDownload } from "@/components/desktop-download";
import { syncNow, useSyncStatus } from "@/lib/sync";

export function AccountView() {
  const { user, isPending } = useCurrentUserState();
  const { status } = useSyncStatus();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signedIn = Boolean(user && !user.isDevFallback);

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
            <input className={inputClass} type="password" placeholder="Пароль" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error ? <p className="text-sm text-ember">{error}</p> : null}
            <button type="submit" className="w-full rounded-full bg-gold py-3 text-ink">
              {mode === "up" ? "Создать аккаунт" : "Войти"}
            </button>
            <button type="button" className="text-sm text-gold" onClick={() => setMode(mode === "up" ? "in" : "up")}>
              {mode === "up" ? "Уже есть аккаунт" : "Создать аккаунт"}
            </button>
          </form>
        </>
      ) : null}
    </div>
  );

  async function signInGoogle() {
    setError("");
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/account",
    });
    if (result.error) {
      setError(
        "Google ещё не подключён на сервере. В Render нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.",
      );
    }
  }

  async function submit() {
    setError("");
    const result =
      mode === "up"
        ? await authClient.signUp.email({ name: name.trim() || email, email, password })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(result.error.message || "Не получилось");
      return;
    }
    await syncNow();
  }
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

function statusText(status: string) {
  if (status === "offline") return "офлайн, работаю локально";
  if (status === "sync") return "синхронизирую";
  if (status === "ok") return "синхронизировано";
  return "только это устройство";
}
