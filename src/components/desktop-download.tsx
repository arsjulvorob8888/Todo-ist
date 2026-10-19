export function DesktopDownload() {
  return (
    <a
      href="/downloads/ToDO-AKA.exe"
      download="ToDO-AKA.exe"
      className="my-4 flex items-center justify-between gap-3 rounded-card border border-line bg-panel p-4"
    >
      <span>
        <span className="block font-display text-2xl">Программа для Windows</span>
        <span className="mt-1 block text-sm text-mist">
          Настоящее окно ToDO-AKA, без браузера и без установки. Скачай файл и открой его.
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm text-ink">Скачать</span>
    </a>
  );
}
