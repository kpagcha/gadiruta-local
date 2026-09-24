/**
 * Reads and writes shareable direct-journey searches. It resolves public URL values against the
 * already loaded local place and stop options; it never requests a server or changes browser history.
 */
import { isCalendarDate } from './calendar-date.ts';
import type { LocationOption } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';

/** Values shown in the form and whether a URL describes a runnable local search. */
export interface ResolvedSearchUrl {
  origin: LocationOption | null;
  destination: LocationOption | null;
  date: string;
  departAfter: string;
  invalid: boolean;
  complete: boolean;
}

/** Accept any valid minute of the selected local day. */
export function isClockTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Use the short public Jerez slug while accepting its original local place ID in old links. */
function locationUrlId(option: LocationOption): string {
  return option.kind === 'place' && option.id === 'jerez-de-la-frontera' ? 'jerez' : option.id;
}

/** Resolve a public place slug or an exact stop ID to the locally available selection. */
function findUrlLocation(value: string | null, options: readonly LocationOption[]): LocationOption | null {
  if (value === null || value === '') return null;
  const id = value === 'jerez' ? 'jerez-de-la-frontera' : value;
  return options.find((option) => option.id === id) ?? null;
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
  const origin = findUrlLocation(from, options);
  const destination = findUrlLocation(to, options);
  // Preserve valid parts of a partial link in the form; one bad supplied value blocks auto-search.
  const dateValid =
    rawDate !== null && isCalendarDate(rawDate) && rawDate >= coverage.startDate && rawDate <= coverage.endDate;
  const timeValid = rawTime === null || rawTime === '' || isClockTime(rawTime);
  const sameStop = origin?.kind === 'stop' && destination?.kind === 'stop' && origin.id === destination.id;
  const invalid =
    (from !== null && origin === null) ||
    (to !== null && destination === null) ||
    (rawDate !== null && !dateValid) ||
    !timeValid ||
    sameStop;

  return {
    origin,
    destination,
    date: dateValid ? rawDate : today,
    departAfter: timeValid ? (rawTime ?? '') : '',
    invalid,
    complete: !invalid && origin !== null && destination !== null && dateValid,
  };
}

/** Produce the canonical search query, omitting an unset departure time. */
export function searchQuery(
  origin: LocationOption,
  destination: LocationOption,
  date: string,
  departAfter: string,
): string {
  const parameters = new URLSearchParams({
    from: locationUrlId(origin),
    to: locationUrlId(destination),
    date,
  });
  if (departAfter !== '') parameters.set('depart_after', departAfter);
  return `?${parameters.toString()}`;
}
