import Button from "./Button";

/** Design.md 7: loading (skeleton rows), empty (icon + line + CTA),
 * error (retry) — for every data view. */

export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex gap-4 border-b border-gray-100 px-4 py-4"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 rounded bg-gray-200" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400"
        aria-hidden="true"
      >
        ∅
      </div>
      <p className="text-gray-600">{message}</p>
      {actionLabel && <Button onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="font-medium text-gray-900">Something went wrong</p>
      <p className="text-gray-600">{error?.message || "Unknown error"}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
