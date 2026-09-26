import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

/** The Base UI select parts, styled with Gadiruta's existing colors and spacing. */
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

/** Render the accessible select button while leaving each use free to choose its shape and size. */
export function SelectTrigger({
  children,
  className,
  ...props
}: SelectPrimitive.Trigger.Props & { children: ReactNode }) {
  return (
    <SelectPrimitive.Trigger
      className={`motion-interactive inline-flex min-w-0 items-center justify-between gap-2 text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
      type="button"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="motion-chevron shrink-0 text-muted">
        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.6} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** Put options in a viewport-aware popup; a calendar can keep the portal inside its own dialog. */
export function SelectContent({
  children,
  className,
  portalContainer,
}: {
  children: ReactNode;
  className?: string;
  portalContainer?: RefObject<HTMLElement | null>;
}) {
  return (
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Positioner align="start" alignItemWithTrigger={false} className="z-100" sideOffset={6}>
        <SelectPrimitive.Popup
          className={`motion-base-popup max-h-64 w-[var(--anchor-width)] max-w-[calc(100vw-2rem)] min-w-36 overflow-y-auto rounded-xl border border-line-popover bg-surface-card p-1 text-sm text-ink shadow-[var(--shadow-popover)] outline-none ${className ?? ''}`}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** Show one option with the same highlight and selected marker in every app select. */
export function SelectItem({ children, className, ...props }: SelectPrimitive.Item.Props & { children: ReactNode }) {
  return (
    <SelectPrimitive.Item
      className={`flex min-h-9 w-full cursor-default items-center gap-2 rounded-lg px-3 py-1.5 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-hover data-[selected]:font-[700] ${className ?? ''}`}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="shrink-0 text-accent">
        <Check aria-hidden="true" size={15} strokeWidth={1.8} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
