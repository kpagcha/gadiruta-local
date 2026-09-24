import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { currentMadridQuarterHour, normalizeJourneyTime, stepJourneyTime } from '../data/journey-time.ts';
import { isClockTime } from '../data/search-url.ts';
import { Icon } from './Icon';

const choices = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** Find a nearby half-hour choice without rounding an exact typed time. */
function nearestChoice(value: string): number {
  if (!isClockTime(value)) return 0;
  return Math.min(47, Math.round((Number(value.slice(0, 2)) * 60 + Number(value.slice(3))) / 30));
}

/** Let a rider type an exact departure time or select a half-hour shortcut. */
export function JourneyTimePill({
  date,
  value,
  onChange,
  minimum,
  maximum,
  disabled,
}: {
  date: string;
  value: string;
  onChange: (date: string, time: string) => void;
  minimum: string;
  maximum: string;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const normalizedTime = normalizeJourneyTime(value);
  const dateCovered = date >= minimum && date <= maximum;
  const earlier = normalizedTime === '' ? null : stepJourneyTime(date, normalizedTime, -1, minimum, maximum);
  const later = normalizedTime === '' ? null : stepJourneyTime(date, normalizedTime, 1, minimum, maximum);

  useEffect(() => {
    if (!isOpen) return;
    /** Close the suggestions after a pointer press outside the picker. */
    function dismiss(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Keep a nearby shortcut visible inside the list; exact typed minutes stay intact.
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const option = list?.children[activeIndex ?? nearestChoice(normalizedTime)] as HTMLElement | undefined;
      if (list && option) {
        list.scrollTop = option.offsetTop - list.offsetTop - (list.clientHeight - option.clientHeight) / 2;
      }
      // Bring a low mobile popover into view.
      const overflow = popoverRef.current
        ? popoverRef.current.getBoundingClientRect().bottom - (window.innerHeight - 16)
        : 0;
      if (overflow > 0) {
        window.scrollBy({
          top: overflow,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, isOpen, normalizedTime]);

  /** Close when focus leaves the input, arrows, and list together. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  }

  /** Navigate options explicitly; Enter otherwise keeps an exact typed time. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(null);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) =>
        Math.max(0, Math.min(47, (index ?? nearestChoice(normalizedTime) - direction) + direction)),
      );
      setIsOpen(true);
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const choice = activeIndex === null ? undefined : choices[activeIndex];
      if (choice !== undefined) onChange(date, choice);
      else if (value !== normalizedTime) onChange(date, normalizedTime);
      setIsOpen(false);
      setActiveIndex(null);
    }
  }

  /** Start a blank time at the Cádiz quarter hour, then step by 15 minutes. */
  function step(direction: -1 | 1) {
    if (normalizedTime === '') {
      onChange(date, currentMadridQuarterHour());
    } else {
      const next = direction === -1 ? earlier : later;
      if (next) onChange(next.date, next.time);
    }
    setIsOpen(false);
    setActiveIndex(null);
  }

  return (
    <div ref={pickerRef} className="relative" onBlur={handleBlur}>
      <div className="inline-flex min-h-12 items-center rounded-full border border-line-input bg-surface-input p-0.5 text-sm font-[650] focus-within:shadow-[var(--shadow-field-focus)]">
        <Icon name="clock" size={16} className="ml-2 shrink-0 text-accent" />
        <input
          ref={inputRef}
          aria-activedescendant={isOpen && activeIndex !== null ? `${listId}-${activeIndex}` : undefined}
          aria-controls={isOpen ? listId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={t('search.departAfter')}
          autoComplete="off"
          className={`min-h-10 min-w-0 bg-transparent px-1.5 text-sm font-[650] text-ink tabular-nums outline-none placeholder:text-muted disabled:opacity-50 ${
            value === '' ? 'w-[4.75rem]' : 'w-[3.5rem]'
          }`}
          disabled={disabled}
          maxLength={5}
          onChange={(event) => {
            onChange(date, event.target.value);
            setActiveIndex(null);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            if (value !== normalizedTime) onChange(date, normalizedTime);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.anyTime')}
          role="combobox"
          type="text"
          value={value}
        />
        {value !== '' && !disabled && (
          <button
            aria-label={t('search.clearTime')}
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-ink"
            onClick={() => {
              onChange(date, '');
              setIsOpen(false);
              setActiveIndex(null);
            }}
            title={t('search.clearTime')}
            type="button"
          >
            <Icon name="close" size={14} />
          </button>
        )}
        <span className="mx-0.5 h-4 w-px bg-line-input" aria-hidden="true" />
        {([-1, 1] as const).map((direction) => (
          <button
            key={direction}
            aria-label={t(direction === -1 ? 'search.earlierTime' : 'search.laterTime')}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:text-accent disabled:opacity-35"
            disabled={
              disabled || (normalizedTime === '' ? !dateCovered : direction === -1 ? earlier === null : later === null)
            }
            onClick={() => step(direction)}
            title={t(direction === -1 ? 'search.earlierTime' : 'search.laterTime')}
            type="button"
          >
            <Icon name={direction === -1 ? 'chevronLeft' : 'chevronRight'} size={16} />
          </button>
        ))}
      </div>

      {isOpen && !disabled && (
        <div
          ref={popoverRef}
          className="absolute top-[calc(100%+8px)] left-0 z-50 w-52 rounded-xl border border-line-popover bg-surface-card p-2 shadow-[var(--shadow-popover)]"
        >
          <ul
            id={listId}
            ref={listRef}
            aria-label={t('search.timeChoices')}
            className="relative max-h-48 overflow-y-auto overscroll-contain"
            role="listbox"
          >
            {choices.map((choice, index) => (
              <li
                key={choice}
                id={`${listId}-${index}`}
                aria-selected={value === choice}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-[650] tabular-nums ${
                  activeIndex === index || value === choice
                    ? 'bg-accent text-on-accent'
                    : 'text-ink hover:bg-surface-hover'
                }`}
                onClick={() => {
                  onChange(date, choice);
                  setIsOpen(false);
                  setActiveIndex(null);
                  inputRef.current?.focus();
                }}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
              >
                {choice}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
