import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

/** Show a consistently styled hint for a single interactive element. */
export function AppTooltip({
  children,
  content,
  disabled = false,
}: {
  children: ReactElement;
  content: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger delay={300} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="z-100" sideOffset={7}>
          <TooltipPrimitive.Popup className="rounded-lg bg-ink px-2.5 py-1.5 text-xs font-[650] text-surface-card shadow-[var(--shadow-popover)]">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
