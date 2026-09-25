import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

/** Show a consistently styled hint for a single interactive element. */
export function AppTooltip({
  side = 'top',
  align = 'center',
  children,
  content,
  disabled = false,
}: {
  side?: 'top' | 'bottom' | 'left' | 'right' | 'inline-start' | 'inline-end';
  align?: 'start' | 'center' | 'end';
  children: ReactElement;
  content: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger delay={300} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} className="z-100" sideOffset={7}>
          <TooltipPrimitive.Popup className="motion-base-popup rounded-lg bg-ink px-2.5 py-1.5 text-xs font-[650] text-surface-card shadow-[var(--shadow-popover)]">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
