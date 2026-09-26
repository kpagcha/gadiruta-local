import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { calendarDays, monthKey, parseCalendarDate, shiftCalendarDate, shiftMonth } from '../data/calendar-date.ts';
import { madridToday } from '../data/calendar-date.ts';
import { Icon } from './Icon';
import { JourneyPickerPill } from './JourneyPickerPill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** Keep the visible month inside the dates available for travel. */
function clampMonth(month: string, minimum: string, maximum: string): string {
  return month < minimum ? minimum : month > maximum ? maximum : month;
}

/** Let a rider choose one covered day from a compact, localized calendar pill. */
export function JourneyDatePill({
  value,
  onChange,
  minimum,
  maximum,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  minimum: string;
  maximum: string;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  const locale = i18n.resolvedLanguage ?? 'en';
  const today = madridToday();
  const earliestDate = minimum > today ? minimum : today;
  const hasAvailableDates = earliestDate <= maximum;
  const pickerDisabled = disabled || !hasAvailableDates;
  const dialogId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(monthKey(value));
  const minimumMonth = monthKey(earliestDate);
  const maximumMonth = monthKey(maximum);
  const dateCovered = value >= earliestDate && value <= maximum;
  const dateLabel =
    value === today
      ? t('search.today')
      : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
          parseCalendarDate(value),
        );
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    parseCalendarDate(`${visibleMonth}-01`),
  );
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, index + 1)),
    ),
  );
  const years = hasAvailableDates
    ? Array.from(
        { length: Number(maximum.slice(0, 4)) - Number(earliestDate.slice(0, 4)) + 1 },
        (_, index) => Number(earliestDate.slice(0, 4)) + index,
      )
    : [];

  useEffect(() => {
    if (!isOpen) return;
    /** Dismiss the calendar when the rider clicks away or presses Escape. */
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
    // The form sits low on small screens, so make the opened calendar reachable without clipping.
    const frame = requestAnimationFrame(() => {
      const popover = popoverRef.current;
      if (popover === null) return;
      const bounds = popover.getBoundingClientRect();
      const overflow = bounds.bottom - (window.innerHeight - 16);
      if (overflow > 0) {
        window.scrollBy({
          top: overflow,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  /** Open at the selected month, or close without changing the selected date. */
  function togglePicker() {
    if (!isOpen) {
      const currentToday = madridToday();
      const currentEarliest = minimum > currentToday ? minimum : currentToday;
      setVisibleMonth(clampMonth(monthKey(value), monthKey(currentEarliest), maximumMonth));
    }
    setIsOpen((open) => !open);
  }

  /** Apply a current or future covered day and return focus to the date pill. */
  function selectDate(date: string) {
    if (date < minimum || date < madridToday() || date > maximum) return;
    onChange(date);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={pickerRef} className="relative">
      <JourneyPickerPill
        previous={{
          label: t('search.previousDay'),
          disabled: pickerDisabled || !dateCovered || value <= earliestDate,
          onClick: () => {
            const previous = shiftCalendarDate(value, -1);
            if (previous >= minimum && previous >= madridToday()) onChange(previous);
          },
        }}
        next={{
          label: t('search.nextDay'),
          disabled: pickerDisabled || !dateCovered || value >= maximum,
          onClick: () => {
            const next = shiftCalendarDate(value, 1);
            if (next >= madridToday() && next <= maximum) onChange(next);
          },
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className="motion-interactive inline-flex min-h-10 items-center gap-2 rounded-full px-2.5 text-ink enabled:hover:bg-surface-hover disabled:opacity-50"
          aria-controls={isOpen ? dialogId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`${t('search.travelDate')}: ${dateLabel}`}
          disabled={pickerDisabled}
          onClick={togglePicker}
        >
          <Icon name="calendar" size={18} className="text-accent" />
          <span className="w-14 text-left whitespace-nowrap tabular-nums">{dateLabel}</span>
        </button>
      </JourneyPickerPill>

      {isOpen && (
        <div
          id={dialogId}
          ref={popoverRef}
          className="motion-popover absolute top-[calc(100%+8px)] left-0 z-50 w-[min(20rem,calc(100vw-3rem))] rounded-2xl border border-line-popover bg-surface-card p-4 shadow-[var(--shadow-popover)] max-[380px]:p-3"
          role="dialog"
          aria-label={t('search.chooseDate')}
        >
          <div className="mb-3 flex items-center justify-between gap-2 max-[380px]:gap-1">
            <button
              type="button"
              className="motion-interactive grid size-10 shrink-0 place-items-center rounded-full enabled:hover:bg-surface-hover disabled:opacity-35 max-[380px]:size-8"
              aria-label={t('search.previousMonth')}
              disabled={visibleMonth <= minimumMonth}
              onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="flex min-w-0 items-center gap-1 text-sm font-[700] max-[380px]:text-xs">
              <span className="truncate capitalize">{monthLabel}</span>
              <Select
                items={years.map((year) => ({ value: String(year), label: String(year) }))}
                value={visibleMonth.slice(0, 4)}
                onValueChange={(year) => {
                  if (year === null) return;
                  setVisibleMonth(clampMonth(`${year}-${visibleMonth.slice(5)}`, minimumMonth, maximumMonth));
                }}
              >
                <SelectTrigger
                  aria-label={t('search.calendarYear')}
                  className="min-h-10 rounded-lg bg-surface-card px-2 text-sm font-[700] focus:shadow-[var(--shadow-field-focus)] max-[380px]:min-h-8 max-[380px]:text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={popoverRef}>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              className="motion-interactive grid size-10 shrink-0 place-items-center rounded-full enabled:hover:bg-surface-hover disabled:opacity-35 max-[380px]:size-8"
              aria-label={t('search.nextMonth')}
              disabled={visibleMonth >= maximumMonth}
              onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
            >
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-[650] text-muted" aria-hidden="true">
            {weekdays.map((weekday, index) => (
              <span key={index} className="grid aspect-square w-full max-w-9 place-items-center">
                {weekday}
              </span>
            ))}
          </div>
          <motion.div
            key={visibleMonth}
            className="grid grid-cols-7 gap-1"
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {calendarDays(visibleMonth).map((day, index) =>
              day === null ? (
                <span key={`blank-${index}`} className="aspect-square w-full max-w-9" aria-hidden="true" />
              ) : (
                <button
                  key={day}
                  type="button"
                  className={`motion-interactive grid aspect-square w-full max-w-9 place-items-center rounded-full text-[13px] font-[650] enabled:hover:bg-surface-hover disabled:opacity-30 ${
                    day === value && day >= earliestDate
                      ? 'bg-accent text-on-accent hover:bg-accent'
                      : day === today
                        ? 'border border-accent text-accent'
                        : ''
                  }`}
                  aria-label={new Intl.DateTimeFormat(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(parseCalendarDate(day))}
                  aria-current={day === today ? 'date' : undefined}
                  aria-pressed={day === value}
                  disabled={day < earliestDate || day > maximum}
                  onClick={() => selectDate(day)}
                >
                  {parseCalendarDate(day).getUTCDate()}
                </button>
              ),
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
