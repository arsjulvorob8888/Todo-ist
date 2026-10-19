export function DesktopDownload() {
  return (
    <a
      href="/downloads/ToDO-AKA-desktop.zip"
      download="ToDO-AKA-desktop.zip"
      className="my-4 flex items-center justify-between gap-3 rounded-card border border-line bg-panel p-4"
    >
      <span>
        <span className="block font-display text-2xl">Компьютер</span>
        <span className="mt-1 block text-sm text-mist">
          Windows, без установки. Распакуй архив и открой файл «Запуск». Интернет не нужен.
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm text-ink">Скачать</span>
    </a>
  );
}
