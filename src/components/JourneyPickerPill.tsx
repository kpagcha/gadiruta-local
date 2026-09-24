import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** One previous or next action shown at the end of a journey picker pill. */
interface JourneyPillStep {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/** Give the date and time pickers the same shell, divider, and step controls. */
export function JourneyPickerPill({
  children,
  previous,
  next,
}: {
  children: ReactNode;
  previous: JourneyPillStep;
  next: JourneyPillStep;
}) {
  return (
    <div className="inline-flex min-h-12 items-center rounded-full border border-line-input bg-surface-input p-1 text-sm font-[650] focus-within:shadow-[var(--shadow-field-focus)]">
      {children}
      <span className="mx-1.5 h-4 w-px bg-line-input" aria-hidden="true" />
      <span className="inline-flex items-center gap-0.5">
        {([previous, next] as const).map((step, index) => (
          <button
            key={index}
            aria-label={step.label}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors enabled:hover:text-accent disabled:opacity-35"
            disabled={step.disabled}
            onClick={step.onClick}
            title={step.label}
            type="button"
          >
            <Icon name={index === 0 ? 'chevronLeft' : 'chevronRight'} size={16} />
          </button>
        ))}
      </span>
    </div>
  );
}
