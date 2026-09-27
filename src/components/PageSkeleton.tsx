/** Reserve the rough shape of a page while its code or local network data loads. */
export function PageSkeleton({ variant, label }: { variant: 'settings' | 'directory' | 'detail'; label: string }) {
  if (variant === 'settings') {
    return (
      <div role="status">
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="max-w-170">
          <div className="h-3 w-24 rounded-full bg-surface-active" />
          <div className="mt-4 h-9 w-52 rounded-lg bg-surface-active" />
          <div className="mt-4 h-4 w-full max-w-115 rounded-full bg-surface-active" />
          <div className="mt-8 grid gap-5">
            <div className="h-32 rounded-2xl border border-line bg-surface-card p-5">
              <div className="h-5 w-28 rounded-full bg-surface-active" />
              <div className="mt-7 h-4 w-48 rounded-full bg-surface-active" />
            </div>
            <div className="h-36 rounded-2xl border border-line bg-surface-card p-5">
              <div className="h-5 w-24 rounded-full bg-surface-active" />
              <div className="mt-7 h-10 w-24 rounded-xl bg-surface-active" />
            </div>
            <div className="h-70 rounded-2xl border border-line bg-surface-card p-5">
              <div className="h-5 w-36 rounded-full bg-surface-active" />
              <div className="mt-5 h-10 w-60 max-w-full rounded-xl bg-surface-active" />
              <div className="mt-9 h-4 w-30 rounded-full bg-surface-active" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      {variant === 'directory' ? (
        <div aria-hidden="true">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="h-6 w-28 rounded-lg bg-surface-active" />
            <div className="h-11 w-56 max-w-full rounded-xl bg-surface-active" />
          </div>
          <div className="grid gap-4 desktop:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-30 rounded-2xl border border-line bg-surface-card p-5">
                <div className="h-5 w-32 rounded-full bg-surface-active" />
                <div className="mt-5 h-7 w-48 max-w-full rounded-lg bg-surface-active" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div aria-hidden="true" className="max-w-170">
          <div className="h-4 w-24 rounded-full bg-surface-active" />
          <div className="mt-7 h-10 w-56 max-w-full rounded-lg bg-surface-active" />
          <div className="mt-4 h-5 w-80 max-w-full rounded-full bg-surface-active" />
          <div className="mt-10 h-7 w-28 rounded-lg bg-surface-active" />
          <div className="mt-4 h-12 w-full rounded-xl bg-surface-active" />
          <div className="mt-7 grid gap-5 pl-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-5 w-60 max-w-full rounded-full bg-surface-active" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
