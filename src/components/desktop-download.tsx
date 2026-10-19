export function DesktopDownload() {
  return (
    <a
      href="/downloads/ToDO-AKA-windows.zip"
      download="ToDO-AKA-windows.zip"
      className="my-4 flex items-center justify-between gap-3 rounded-card border border-line bg-panel p-4"
    >
      <span>
        <span className="block font-display text-2xl">Программа для Windows</span>
        <span className="mt-1 block text-sm text-mist">
          Тот же экран, что на сайте: задачи, кольца, помидор и тайминг. Распакуй архив и открой ToDO-AKA.exe.
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm text-ink">Скачать</span>
    </a>
  );
}
