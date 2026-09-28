import type { ComponentPropsWithRef } from 'react';

/** Give the search form and its results the same roomy section surface. */
export function PanelCard({ className, ...props }: ComponentPropsWithRef<'section'>) {
  return (
    <section
      className={`min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)] max-[380px]:p-4.5 desktop:p-8 ${className ?? ''}`}
      {...props}
    />
  );
}
