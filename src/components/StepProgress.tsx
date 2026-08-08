type StepProgressProps = {
  current: number;
  total: number;
  label?: string;
};

export function StepProgress({ current, total, label }: StepProgressProps) {
  const safeTotal = Math.max(total, 1);
  const clamped = Math.min(Math.max(current, 0), safeTotal);
  const percent = Math.round((clamped / safeTotal) * 100);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-base font-medium text-[var(--foreground)]">
          {label ?? `Step ${clamped} of ${safeTotal}`}
        </p>
        <p className="text-sm text-[var(--muted)]">{percent}%</p>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
