import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

/** Produce the available minute choices while retaining an exact minute from a shared URL. */
function minuteChoices(step: 10 | 15, selected: string | null): string[] {
  const minutes = Array.from({ length: 60 / step }, (_, index) => String(index * step).padStart(2, '0'));
  if (selected !== null && !minutes.includes(selected)) minutes.push(selected);
  return minutes.sort((first, second) => Number(first) - Number(second));
}

/** Let a rider choose an optional local departure time in a separate clock pill. */
export function JourneyTimePill({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const dialogId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [minuteStep, setMinuteStep] = useState<10 | 15>(15);
  const selectedHour = value === '' ? null : value.slice(0, 2);
  const selectedMinute = value === '' ? null : value.slice(3, 5);
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  const minutes = minuteChoices(minuteStep, selectedMinute);

  useEffect(() => {
    if (!isOpen) return;
    /** Dismiss the clock popover without changing its selected value. */
    function dismiss(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') {
          setIsOpen(false);
          triggerRef.current?.focus();
        }
      } else if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Bring both the chosen hour and a low mobile popover into view when opening.
    const frame = requestAnimationFrame(() => {
      selectedHourRef.current?.scrollIntoView({ block: 'nearest' });
      const popover = popoverRef.current;
      if (popover === null) return;
      const overflow = popover.getBoundingClientRect().bottom - (window.innerHeight - 16);
      if (overflow > 0) {
        window.scrollBy({
          top: overflow,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  /** Select an hour and keep the current minute, or begin at its first minute. */
  function chooseHour(hour: string) {
    onChange(`${hour}:${selectedMinute ?? '00'}`);
  }

  /** Complete the selected time and return focus to its pill. */
  function chooseMinute(minute: string) {
    if (selectedHour === null) return;
    onChange(`${selectedHour}:${minute}`);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={pickerRef} className="relative">
      <div className="inline-flex min-h-12 items-center rounded-full border border-line-input bg-surface-input p-1 text-sm font-[650]">
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-ink transition-colors hover:bg-surface-hover disabled:opacity-50"
          aria-controls={isOpen ? dialogId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`${t('search.departAfter')}: ${value || t('search.anyTime')}`}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
        >
          <Icon name="clock" size={17} className="text-accent" />
          <span className={value ? 'tabular-nums' : undefined}>{value || t('search.anyTime')}</span>
        </button>
        {value !== '' && !disabled && (
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-hover"
            aria-label={t('search.clearTime')}
            title={t('search.clearTime')}
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          id={dialogId}
          ref={popoverRef}
          className="absolute top-[calc(100%+8px)] left-0 z-50 w-52 rounded-xl border border-line-popover bg-surface-card p-2 shadow-[var(--shadow-popover)]"
          role="dialog"
          aria-label={t('search.departAfter')}
        >
          <div
            className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-input p-1"
            role="group"
            aria-label={t('search.minuteStep')}
          >
            {([10, 15] as const).map((step) => (
              <button
                key={step}
                type="button"
                className={`rounded-md px-2 py-1 text-xs font-[650] transition-colors ${
                  minuteStep === step ? 'bg-surface-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
                aria-pressed={minuteStep === step}
                onClick={() => setMinuteStep(step)}
              >
                {step === 10 ? t('search.tenMinutes') : t('search.fifteenMinutes')}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div
              className="grid max-h-44 gap-0.5 overflow-y-auto overscroll-contain p-0.5"
              role="group"
              aria-label={t('search.hours')}
            >
              {hours.map((hour) => (
                <button
                  key={hour}
                  ref={selectedHour === hour ? selectedHourRef : undefined}
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-sm font-[650] tabular-nums transition-colors hover:bg-surface-hover ${
                    selectedHour === hour ? 'bg-accent text-on-accent hover:bg-accent' : ''
                  }`}
                  aria-pressed={selectedHour === hour}
                  onClick={() => chooseHour(hour)}
                >
                  {hour}
                </button>
              ))}
            </div>
            <span className="text-sm font-[700] text-muted" aria-hidden="true">
              :
            </span>
            <div
              className="grid max-h-44 gap-0.5 overflow-y-auto overscroll-contain p-0.5"
              role="group"
              aria-label={t('search.minutes')}
            >
              {minutes.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  className={`rounded-lg px-2 py-1.5 text-sm font-[650] tabular-nums transition-colors hover:bg-surface-hover disabled:opacity-35 ${
                    selectedMinute === minute ? 'bg-accent text-on-accent hover:bg-accent' : ''
                  }`}
                  aria-pressed={selectedMinute === minute}
                  disabled={selectedHour === null}
                  onClick={() => chooseMinute(minute)}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
