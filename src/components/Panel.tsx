/** Provide the shared semantic card surface used for major page regions. */

import type { ComponentPropsWithRef } from 'react';

/** Preserve native section semantics and support a caller-owned DOM ref. */
type PanelProps = ComponentPropsWithRef<'section'>;

/** Render a labelled page section on Gadiruta's shared elevated card surface. */
export function Panel({ className, ...props }: PanelProps) {
  // Keep the shared surface styles while allowing a caller to add spacing or layout classes.
  return (
    <section
      {...props}
      className={[
        'min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-(--shadow-card) max-[380px]:p-4.5 desktop:p-8',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
