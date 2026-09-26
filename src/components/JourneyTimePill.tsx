import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { madridToday } from '../data/calendar-date.ts';
import { currentMadridQuarterHour, normalizeJourneyTime, stepJourneyTime } from '../data/journey-time.ts';
import { isClockTime } from '../data/journey-time.ts';
import { Icon } from './Icon';
import { JourneyPickerPill } from './JourneyPickerPill';

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
  onChange: (date: string, time: string, committed: boolean) => void;
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
  const [isEditing, setIsEditing] = useState(false);
  const normalizedTime = normalizeJourneyTime(value);
  const today = madridToday();
  const earliestDate = minimum > today ? minimum : today;
  const dateCovered = date >= earliestDate && date <= maximum;
  const earlier = normalizedTime === '' ? null : stepJourneyTime(date, normalizedTime, -1, earliestDate, maximum);
  const later = normalizedTime === '' ? null : stepJourneyTime(date, normalizedTime, 1, earliestDate, maximum);

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
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
      if (isEditing) {
        onChange(date, normalizedTime, true);
        setIsEditing(false);
      }
    }
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
      if (choice !== undefined) onChange(date, choice, true);
      else if (isEditing) onChange(date, normalizedTime, true);
      setIsOpen(false);
      setActiveIndex(null);
      setIsEditing(false);
    }
  }

  /** Start a blank time at the Cádiz quarter hour, then step by 15 minutes. */
  function step(direction: -1 | 1) {
    const currentToday = madridToday();
    const currentEarliest = minimum > currentToday ? minimum : currentToday;
    if (normalizedTime === '') {
      if (date >= currentEarliest && date <= maximum) onChange(date, currentMadridQuarterHour(), true);
    } else {
      const next = stepJourneyTime(date, normalizedTime, direction, currentEarliest, maximum);
      if (next) onChange(next.date, next.time, true);
    }
    setIsOpen(false);
    setActiveIndex(null);
    setIsEditing(false);
  }

  return (
    <div ref={pickerRef} className="relative" onBlur={handleBlur}>
      <JourneyPickerPill
        previous={{
          label: t('search.earlierTime'),
          disabled: disabled || (normalizedTime === '' ? !dateCovered : earlier === null),
          onClick: () => step(-1),
        }}
        next={{
          label: t('search.laterTime'),
          disabled: disabled || (normalizedTime === '' ? !dateCovered : later === null),
          onClick: () => step(1),
        }}
      >
        <span className="inline-flex min-h-10 items-center gap-2 px-2.5">
          <Icon name="clock" size={18} className="shrink-0 text-accent" />
          <input
            ref={inputRef}
            aria-activedescendant={isOpen && activeIndex !== null ? `${listId}-${activeIndex}` : undefined}
            aria-controls={isOpen ? listId : undefined}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={t('search.departAfter')}
            autoComplete="off"
            className="min-h-10 w-11 min-w-0 bg-transparent p-0 text-sm font-[650] text-ink tabular-nums outline-none placeholder:text-muted disabled:opacity-50"
            disabled={disabled}
            maxLength={5}
            onChange={(event) => {
              onChange(date, event.target.value, false);
              setActiveIndex(null);
              setIsOpen(true);
              setIsEditing(true);
            }}
            onClick={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.timePlaceholder')}
            role="combobox"
            type="text"
            value={value}
          />
        </span>
      </JourneyPickerPill>

      {isOpen && !disabled && (
        <div
          ref={popoverRef}
          className="motion-popover absolute top-[calc(100%+8px)] left-0 z-50 w-52 rounded-xl border border-line-popover bg-surface-card p-2 shadow-[var(--shadow-popover)]"
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
                className={`motion-timeline-color cursor-pointer rounded-lg px-3 py-1.5 text-sm font-[650] tabular-nums ${
                  activeIndex === index || value === choice
                    ? 'bg-accent text-on-accent'
                    : 'text-ink hover:bg-surface-hover'
                }`}
                onClick={() => {
                  onChange(date, choice, true);
                  setIsOpen(false);
                  setActiveIndex(null);
                  setIsEditing(false);
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
