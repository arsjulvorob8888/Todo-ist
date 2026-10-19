import { useState } from "react";
import { authClient, authEnabled } from "@/lib/auth/client";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { inputClass } from "@/components/modal";
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
        <form
          className="mt-6 space-y-3"
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
      ) : null}
    </div>
  );

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

function statusText(status: string) {
  if (status === "offline") return "офлайн, работаю локально";
  if (status === "sync") return "синхронизирую";
  if (status === "ok") return "синхронизировано";
  return "только это устройство";
}
