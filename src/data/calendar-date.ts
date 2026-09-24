/**
 * Provides date-only calendar helpers for the browser's journey picker. UTC arithmetic keeps a
 * selected Cádiz calendar day unchanged when the browser runs in another time zone.
 */

/** Parse an ISO calendar date for display without applying the browser's local time zone. */
export function parseCalendarDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Format a UTC calendar day for a date input or shareable search URL. */
export function formatCalendarDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(
    value.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Check both the ISO shape and the actual day, including leap years. */
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && formatCalendarDate(parseCalendarDate(value)) === value;
}

/** Return the sortable year-month part of an ISO calendar date. */
export function monthKey(value: string): string {
  return value.slice(0, 7);
}

/** Move a displayed calendar month without crossing a local time-zone boundary. */
export function shiftMonth(value: string, amount: number): string {
  const [year = 0, month = 1] = value.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + amount, 1));
  return monthKey(formatCalendarDate(shifted));
}

/** List one month in Monday-first rows, with nulls before its first day. */
export function calendarDays(value: string): Array<string | null> {
  const [year = 0, month = 1] = value.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const leading = (firstDay.getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [
    ...Array<string | null>(leading).fill(null),
    ...Array.from({ length: dayCount }, (_, index) =>
      formatCalendarDate(new Date(Date.UTC(year, month - 1, index + 1))),
    ),
  ];
}
