export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

export function formatDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

export function shortDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function diffDays(from: string, to: string) {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type CelebrationDate = { month: number; day: number; year?: number };

export function parseCelebration(raw: string): CelebrationDate | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const dotted = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(value);
  if (!dotted) return null;
  const year = dotted[3] ? Number(dotted[3]) : undefined;
  return { year, month: Number(dotted[2]), day: Number(dotted[1]) };
}

function dateKey(year: number, month: number, day: number) {
  const last = new Date(year, month, 0).getDate();
  return dayKey(new Date(year, month - 1, Math.min(day, last)));
}

export function nextCelebration(raw: string, today = dayKey()) {
  const parsed = parseCelebration(raw);
  if (!parsed || parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) return null;
  const year = Number(today.slice(0, 4));
  let day = dateKey(year, parsed.month, parsed.day);
  if (day < today) day = dateKey(year + 1, parsed.month, parsed.day);
  return { day, days: diffDays(today, day), year: parsed.year };
}

export function monthDayLabel(raw: string) {
  const parsed = parseCelebration(raw);
  if (!parsed) return raw;
  const label = new Date(2000, parsed.month - 1, parsed.day).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return parsed.year ? `${label} ${parsed.year}` : label;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function fmtSpan(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function fmtHm(seconds: number) {
  const total = Math.round(Math.max(0, seconds) / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function endOfDayMs(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}
