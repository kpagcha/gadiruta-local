import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { hexToHsv, hsvToHex, type HsvColor } from '../../data/color-picker.ts';

/** A source-owned, shadcn-style color picker using the app's existing Base UI popover. */
export function ColorPicker({
  id,
  label,
  hexLabel,
  hueLabel,
  value,
  visualColor,
  onChange,
  errorId,
}: {
  id: string;
  label: string;
  hexLabel: string;
  hueLabel: string;
  value: string;
  visualColor: string;
  onChange: (color: string) => void;
  errorId?: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [lastHue, setLastHue] = useState(() => hexToHsv(visualColor)?.hue ?? 0);
  const parsed = hexToHsv(value);
  const color = hexToHsv(visualColor)!;
  // A gray, white, or black hex color has no hue; retain the last chosen hue for the canvas.
  const hsv = { ...color, hue: color.saturation === 0 || color.value === 0 ? lastHue : color.hue };

  /** Send valid picker colors upstream while letting the hex field hold partial edits. */
  function chooseColor(next: HsvColor) {
    const hex = hsvToHex(next);
    setLastHue(next.hue);
    onChange(hex);
  }

  /** Read a pointer's location in the saturation and brightness canvas. */
  function chooseFromArea(event: PointerEvent<HTMLDivElement>) {
    const area = areaRef.current;
    if (area === null) return;
    const bounds = area.getBoundingClientRect();
    const saturation = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const value = Math.min(100, Math.max(0, (1 - (event.clientY - bounds.top) / bounds.height) * 100));
    chooseColor({ ...hsv, saturation, value });
  }

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        id={id}
        type="button"
        aria-label={label}
        aria-describedby={errorId}
        aria-invalid={parsed === null || errorId !== undefined ? true : undefined}
        className="motion-interactive mt-2 flex min-h-11 min-w-35 items-center gap-3 rounded-xl border border-line-input bg-surface-input px-2.5 text-left text-sm text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          className="size-7 shrink-0 rounded-lg border border-line"
          style={{ backgroundColor: visualColor }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs">{value}</span>
        <ChevronDown aria-hidden="true" className="ml-auto shrink-0 text-muted" size={16} />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="start" sideOffset={7} className="z-100">
          <PopoverPrimitive.Popup className="motion-base-popup w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line-popover bg-surface-card p-3 text-ink shadow-[var(--shadow-popover)] outline-none">
            <PopoverPrimitive.Title className="mb-3 text-sm font-semibold">{label}</PopoverPrimitive.Title>
            <div
              ref={areaRef}
              aria-hidden="true"
              className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-lg"
              style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                chooseFromArea(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromArea(event);
              }}
            >
              <span className="pointer-events-none absolute inset-0 bg-linear-to-r from-white to-transparent" />
              <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black to-transparent" />
              <span
                className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#0008]"
                style={{ left: `${hsv.saturation}%`, top: `${100 - hsv.value}%` }}
              />
            </div>
            <input
              aria-label={hueLabel}
              className="color-picker-hue mt-4 block w-full"
              max={359}
              min={0}
              onChange={(event) => chooseColor({ ...hsv, hue: Number(event.target.value) })}
              type="range"
              value={Math.round(hsv.hue) % 360}
            />
            <label className="mt-4 block text-xs font-semibold" htmlFor={`${id}-hex`}>
              {hexLabel}
            </label>
            <input
              id={`${id}-hex`}
              aria-describedby={errorId}
              aria-invalid={parsed === null || errorId !== undefined ? true : undefined}
              autoComplete="off"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-line-input bg-surface-input px-3 font-mono text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
              maxLength={7}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
              type="text"
              value={value}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
