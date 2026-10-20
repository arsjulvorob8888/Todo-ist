import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(92vh,48rem)] w-full max-w-md flex-col overflow-hidden rounded-card border border-line bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5">
          <h2 className="font-display text-2xl text-cream">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-mist hover:text-cream">
            Закрыть
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-mist">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-panel-2 px-3 py-3 text-cream outline-none focus:border-gold";
