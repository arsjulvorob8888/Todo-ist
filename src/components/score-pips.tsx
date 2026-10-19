export function ScorePips({ value, onPick }: { value?: number; onPick: (score: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
        <button
          key={score}
          type="button"
          aria-label={`Оценка ${score}`}
          onClick={() => onPick(score)}
          className={`size-7 rounded-full text-xs ${value === score ? "bg-gold text-ink" : "bg-panel-2 text-mist"}`}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
