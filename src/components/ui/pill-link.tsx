import type { ComponentProps } from 'react';

/** Link to a related area or line with the same compact, touch-friendly style. */
export function PillLink({ className, ...props }: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      className={`motion-interactive inline-flex min-h-10 items-center rounded-lg bg-surface-active px-3 text-sm font-semibold text-ink no-underline hover:text-accent ${className ?? ''}`}
      {...props}
    />
  );
}
