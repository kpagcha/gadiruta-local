/**
 * Handles exact local departure times for the journey picker. The arrows move by 15 minutes,
 * including a calendar-day change at midnight, while the dropdown offers 30-minute shortcuts.
 */
import { shiftCalendarDate } from './calendar-date.ts';

/** The departure choices currently supported by local journey search. */
export type DepartureMode = 'leave-now' | 'depart-at';

/** Accept compact clock entry and clear values that cannot describe a time of day. */
export function normalizeJourneyTime(value: string): string {
  const input = value.trim();
  if (isClockTime(input)) return input;

  // A lone digit names an afternoon hour: 3 becomes 15:00. A leading zero keeps morning explicit.
  const compact = input.match(/^(\d{1,4})$/);
  const colon = input.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!compact && !colon) return '';

  const digits = compact?.[1];
  const hourText = colon?.[1] ?? (digits && digits.length > 2 ? digits.slice(0, -2) : digits);
  const minuteText = colon?.[2] ?? (digits && digits.length > 2 ? digits.slice(-2) : '0');
  if (hourText === undefined || minuteText === undefined) return '';
  let hour = Number(hourText);
  const minute = Number(minuteText);
  if (hourText.length === 1 && hour >= 1 && hour <= 9) hour += 12;
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** A selected day and exact local time after one arrow press. */
export interface SteppedJourneyTime {
  date: string;
  time: string;
}

/** Return the current Cádiz clock time at exact whole-minute precision. */
export function currentMadridTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Return the current Cádiz clock time rounded down to the previous quarter hour. */
export function currentMadridQuarterHour(now: Date = new Date()): string {
  const time = currentMadridTime(now);
  const minute = Number(time.slice(3));
  return `${time.slice(0, 3)}${String(Math.floor(minute / 15) * 15).padStart(2, '0')}`;
}

/** Preview a 15-minute step, or reject it when it would leave the saved timetable. */
export function stepJourneyTime(
  date: string,
  time: string,
  direction: -1 | 1,
  minimum: string,
  maximum: string,
): SteppedJourneyTime | null {
  if (!isClockTime(time) || date < minimum || date > maximum) return null;

  let minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + direction * 15;
  let nextDate = date;
  if (minutes < 0) {
    minutes += 24 * 60;
    nextDate = shiftCalendarDate(date, -1);
  } else if (minutes >= 24 * 60) {
    minutes -= 24 * 60;
    nextDate = shiftCalendarDate(date, 1);
  }
  if (nextDate < minimum || nextDate > maximum) return null;
  return {
    date: nextDate,
    time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
  };
}

/** Accept any valid minute of the selected local day. */
export function isClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Display an absolute trip minute as a clock time, wrapping at midnight. */
export function clockTime(minute: number): string {
  const withinDay = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(withinDay / 60)).padStart(2, '0')}:${String(withinDay % 60).padStart(2, '0')}`;
}
