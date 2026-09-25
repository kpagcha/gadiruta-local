/**
 * Reads and writes shareable direct-journey searches. It resolves public URL values against the
 * already loaded local place and stop options; it never requests a server or changes browser history.
 */
import { isCalendarDate } from './calendar-date.ts';
import type { DepartureMode } from './journey-time.ts';
import { isSameLocationChoice, type LocationOption } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';
import { stopTokenFromUrl, stopUrlToken, stopUrlValue } from './stop-url.ts';

/** Values shown in the form and whether a URL describes a runnable local search. */
export interface ResolvedSearchUrl {
  origin: LocationOption | null;
  destination: LocationOption | null;
  date: string;
  departAfter: string;
  departureMode: DepartureMode;
  invalid: boolean;
  complete: boolean;
}

/** Accept any valid minute of the selected local day. */
export function isClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Resolve stored IDs and readable stop links against the current local selections. */
function findUrlLocation(value: string | null, options: readonly LocationOption[]): LocationOption | null {
  if (value === null || value === '') return null;
  const byId = options.find((option) => option.id === value);
  if (byId) return byId;
  const token = stopTokenFromUrl(value);
  return token === null
    ? null
    : (options.find((option) => option.kind === 'stop' && stopUrlToken(option.id) === token) ?? null);
}

/** Read valid URL fields independently, but run a search only when all required fields are valid. */
export function resolveSearchUrl(
  search: string,
  options: readonly LocationOption[],
  coverage: NetworkDataset['coverage'],
  today: string,
): ResolvedSearchUrl {
  const parameters = new URLSearchParams(search);
  const from = parameters.get('from');
  const to = parameters.get('to');
  const rawDate = parameters.get('date');
  const rawTime = parameters.get('depart_after');
  const rawMode = parameters.get('mode');
  const departureMode: DepartureMode = rawDate !== null || rawTime !== null ? 'depart-at' : 'leave-now';
  const origin = findUrlLocation(from, options);
  const destination = findUrlLocation(to, options);
  // Preserve valid parts of a partial link in the form; one bad supplied value blocks auto-search.
  const dateValid =
    rawDate !== null &&
    isCalendarDate(rawDate) &&
    rawDate >= today &&
    rawDate >= coverage.startDate &&
    rawDate <= coverage.endDate;
  const todayCovered = today >= coverage.startDate && today <= coverage.endDate;
  const timeValid = rawTime === null || rawTime === '' || isClockTime(rawTime);
  const sameLocation = isSameLocationChoice(origin, destination);
  const invalid =
    (from !== null && origin === null) ||
    (to !== null && destination === null) ||
    (departureMode === 'depart-at' && !dateValid) ||
    (rawMode !== null && (rawMode !== 'now' || departureMode !== 'leave-now')) ||
    !timeValid ||
    sameLocation;

  return {
    origin,
    destination,
    date: dateValid ? rawDate : today,
    departAfter: timeValid ? (rawTime ?? '') : '',
    departureMode,
    invalid,
    complete:
      !invalid && origin !== null && destination !== null && (departureMode === 'leave-now' ? todayCovered : dateValid),
  };
}

/** Produce a shareable query for either current departures or a chosen day and time. */
export function searchQuery(
  origin: LocationOption,
  destination: LocationOption,
  departureMode: DepartureMode,
  date: string,
  departAfter: string,
): string {
  const parameters = new URLSearchParams({
    from: origin.kind === 'stop' ? stopUrlValue(origin) : origin.id,
    to: destination.kind === 'stop' ? stopUrlValue(destination) : destination.id,
  });
  if (departureMode === 'leave-now') {
    parameters.set('mode', 'now');
  } else {
    parameters.set('date', date);
    if (departAfter !== '') parameters.set('depart_after', departAfter);
  }
  return `?${parameters.toString()}`;
}
