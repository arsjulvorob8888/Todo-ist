import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, BookOpen, CalendarClock, Flag, FolderKanban, Lightbulb, ListChecks, Repeat, Sun, Timer, UserRound, Users, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Burst } from "@/components/fx";
import { cn } from "@/lib/cn";
import { fmtSpan } from "@/lib/dates";
import { playBell, playLevel, playWin, playXp, setSoundEnabled } from "@/lib/sound";
import { startSync, useSyncStatus } from "@/lib/sync";
import { restoreIfBlank, startBackup } from "@/lib/backup";
import { recoverIfEmpty } from "@/lib/recovery";
import { usePlanner } from "@/lib/store";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const NAV = [
  { to: "/", label: "Сегодня", icon: Sun, shelf: "" },
  { to: "/tasks", label: "Задачи", icon: ListChecks, shelf: "" },
  { to: "/timing", label: "Тайминг", icon: Timer, shelf: "" },
  { to: "/routine", label: "Распорядок", icon: CalendarClock, shelf: "" },
  { to: "/habits", label: "Привычки", icon: Repeat, shelf: "" },
  { to: "/stats", label: "Рост", icon: BarChart3, shelf: "" },
  { to: "/goals", label: "Цели", icon: Flag, shelf: "" },
  { to: "/projects", label: "Проекты", icon: FolderKanban, shelf: "" },
  { to: "/people", label: "Люди", icon: Users, shelf: "" },
  { to: "/ideas", label: "Идеи", icon: Lightbulb, shelf: "" },
  { to: "/books", label: "Чтение", icon: BookOpen, shelf: "" },
  { to: "/account", label: "Кабинет", icon: UserRound, shelf: "" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return <Ready>{children}</Ready>;
}

function Ready({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const shelf = useRouterState({ select: (state) => (state.location.search as { shelf?: string }).shelf });
  const sound = usePlanner((s) => s.sound);
  const toggleSound = usePlanner((s) => s.toggleSound);
  const reward = usePlanner((s) => s.reward);
  const clearReward = usePlanner((s) => s.clearReward);
  const undo = usePlanner((s) => s.undo);
  const dismissUndo = usePlanner((s) => s.dismissUndo);
  const completeTask = usePlanner((s) => s.completeTask);
  const burst = usePlanner((s) => s.burst);
  const pomo = usePlanner((s) => s.pomo);
  const tasks = usePlanner((s) => s.tasks);
  const habits = usePlanner((s) => s.habits);
  const pausePomo = usePlanner((s) => s.pausePomo);
  const stopPomo = usePlanner((s) => s.stopPomo);
  const finishPomo = usePlanner((s) => s.finishPomo);
  const { status } = useSyncStatus();
  const sawSync = useRef(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void (async () => {
      await restoreIfBlank();
      startBackup();
      startSync();
    })();
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    if (status === "sync") sawSync.current = true;
    if (!sawSync.current || status === "sync") return;
    recoverIfEmpty();
  }, [status]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setSoundEnabled(sound), [sound]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(dismissUndo, 8000);
    return () => window.clearTimeout(timer);
  }, [undo, dismissUndo]);

  useEffect(() => {
    if (!reward) return;
    if (reward.levelUp) playLevel();
    else if (reward.amount >= 15) playWin();
    else playXp();
    const timer = window.setTimeout(clearReward, 1200);
    return () => window.clearTimeout(timer);
  }, [reward, clearReward]);

  useEffect(() => {
    if (!pomo.running || !pomo.endsAt) return;
    const timer = window.setInterval(() => {
      const current = usePlanner.getState().pomo;
      if (current.running && current.endsAt && Date.now() >= current.endsAt) {
        playBell();
        finishPomo();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [pomo.running, pomo.endsAt, finishPomo]);

  const left = pomo.running ? Math.max(0, Math.round((pomo.endsAt - now) / 1000)) : pomo.remaining;
  const showDock = pomo.running || (pomo.remaining > 0 && pomo.remaining !== pomo.minutes * 60);
  const linkedTask = tasks.find((task) => task.id === pomo.taskId);
  const linkedHabit = habits.find((habit) => habit.id === pomo.taskId);
  const focusTitle = linkedTask?.title || linkedHabit?.title || "";
  const focusHint = linkedTask?.category || (linkedHabit ? "Привычки" : "");

  return (
    <div className="min-h-screen bg-ink font-sans text-cream">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-24 flex-col items-center gap-2 border-r border-line bg-panel py-5 md:flex">
        <Link to="/account" className="mb-4" aria-label="Аккаунт">
          <AccountMark />
        </Link>
        <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = item.shelf ? path.startsWith("/books") && (shelf === "read" ? "read" : "queue") === item.shelf : item.to === "/" ? path === "/" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              search={item.shelf ? { shelf: item.shelf } : undefined}
              className={cn(
                "flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px]",
                active ? "bg-gold text-ink" : "text-mist",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        </nav>
        <button type="button" onClick={toggleSound} className="mt-2 text-mist hover:text-cream" aria-label="Звук">
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </aside>

      <main className="mx-auto min-h-screen max-w-5xl px-4 pt-6 pb-28 md:pl-32 md:pr-8">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/account" aria-label="Аккаунт">
            <AccountMark />
          </Link>
          <div>
            <p className="font-display text-2xl text-gold">ToDO-AKA</p>
            <p className="text-xs text-mist">{syncLabel(status)}</p>
          </div>
        </div>
        {children}
      </main>

      {showDock ? (
        <div className="fixed right-4 bottom-24 z-30 flex max-w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-card border border-gold bg-panel px-4 py-3 md:bottom-6">
          <div className="min-w-0">
            <p className="text-xs tracking-wide text-gold uppercase">{pomo.mode === "break" ? "Перерыв" : "Помидор"}</p>
            <p className="truncate text-sm">{focusTitle || "Без задачи"}</p>
            {focusHint ? <p className="truncate text-xs text-mist">{focusHint}</p> : null}
            <p className="font-display text-2xl">{fmtSpan(left)}</p>
          </div>
          <button type="button" onClick={pausePomo} className="rounded-full bg-panel-2 px-3 py-2 text-sm">
            {pomo.running ? "Пауза" : "Дальше"}
          </button>
          <button type="button" onClick={stopPomo} className="rounded-full bg-ember px-3 py-2 text-sm text-ink">
            Стоп
          </button>
        </div>
      ) : null}

      {undo ? (
        <button
          type="button"
          className="fixed bottom-24 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 truncate rounded-card border border-gold bg-panel px-5 py-3 text-sm shadow-xl md:bottom-6"
          onClick={() => completeTask(undo.id)}
        >
          Отменить выполнение · {undo.title}
        </button>
      ) : null}

      {reward ? (
        <div className="pointer-events-none fixed top-20 left-1/2 z-50 animate-[rise_1100ms_ease-out_forwards]">
          <div className="rounded-full bg-gold px-5 py-2 font-display text-xl text-ink">
            +{reward.amount} XP · {reward.levelUp ? "Новый уровень" : reward.text}
          </div>
        </div>
      ) : null}

      {burst > 0 ? <Burst nonce={burst} /> : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 overflow-x-auto border-t border-line bg-panel px-1 md:hidden">
        {NAV.map((item) => {
          const active = item.shelf ? path.startsWith("/books") && (shelf === "read" ? "read" : "queue") === item.shelf : item.to === "/" ? path === "/" : path.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              to={item.to}
              search={item.shelf ? { shelf: item.shelf } : undefined}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center gap-1 py-2 text-[10px]",
                active ? "text-gold" : "text-mist",
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AccountMark() {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const letter = (user?.displayName || user?.primaryEmail || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      title={signedIn ? `${user?.displayName || "Аккаунт"} · вошли` : "Не вошли"}
      className={cn(
        "relative grid size-11 place-items-center rounded-full border",
        signedIn ? "border-gold bg-gold text-ink" : "border-line bg-panel-2 text-mist",
        isPending && "opacity-60",
      )}
    >
      {signedIn ? (
        <span className="font-display text-lg leading-none">{letter}</span>
      ) : (
        <UserRound className="size-5" />
      )}
      <span
        className={cn(
          "absolute right-0 bottom-0 size-3 rounded-full border-2 border-ink",
          signedIn ? "bg-gold-2" : "bg-line",
        )}
      />
    </span>
  );
}

function syncLabel(status: string) {
  if (status === "offline") return "Офлайн · данные на этом устройстве";
  if (status === "sync") return "Синхронизация…";
  if (status === "ok") return "Синхронизировано";
  return "Локально · синхронизация при входе";
}
