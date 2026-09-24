/**
 * Keeps recent direct-journey searches in this browser. Saved links are resolved against the
 * current network snapshot before display, so old place and stop names are never trusted.
 */
import { RECENT_SEARCH_LIMIT } from '../config.ts';
import { isCalendarDate } from './calendar-date.ts';
import type { DepartureMode } from './journey-time.ts';
import type { LocationOption } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';
import { isClockTime, resolveSearchUrl, searchQuery } from './search-url.ts';

/** A runnable search whose locations come from the current network snapshot. */
export interface RecentSearch {
  origin: LocationOption;
  destination: LocationOption;
  departureMode: DepartureMode;
  date: string;
  departAfter: string;
}

const STORAGE_KEY = 'gadiruta-local.recent-searches.v1';

/** Treat direction and exact stop choice as part of a route's identity. */
function isSameRoute(first: RecentSearch, second: RecentSearch): boolean {
  return (
    first.origin.kind === second.origin.kind &&
    first.origin.id === second.origin.id &&
    first.destination.kind === second.destination.kind &&
    first.destination.id === second.destination.id
  );
}

/** Resolve one saved link, falling back to Leave now when its chosen date has passed. */
function resolveSavedSearch(
  query: string,
  options: readonly LocationOption[],
  coverage: NetworkDataset['coverage'],
  today: string,
): RecentSearch | null {
  const parameters = new URLSearchParams(query);
  const savedDate = parameters.get('date');
  if (savedDate !== null && isCalendarDate(savedDate) && savedDate < today) {
    const savedTime = parameters.get('depart_after');
    if (parameters.has('mode') || (savedTime !== null && savedTime !== '' && !isClockTime(savedTime))) return null;
    parameters.delete('date');
    parameters.delete('depart_after');
    parameters.set('mode', 'now');
  }

  const resolved = resolveSearchUrl(`?${parameters.toString()}`, options, coverage, today);
  if (!resolved.complete || resolved.origin === null || resolved.destination === null) return null;
  return {
    origin: resolved.origin,
    destination: resolved.destination,
    departureMode: resolved.departureMode,
    date: resolved.date,
    departAfter: resolved.departAfter,
  };
}

/** Read up to the configured limit of distinct, currently runnable searches. */
export function loadRecentSearches(
  options: readonly LocationOption[],
  coverage: NetworkDataset['coverage'],
  today: string,
): RecentSearch[] {
  let saved: unknown;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    saved = value === null ? [] : JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(saved)) return [];

  const recent: RecentSearch[] = [];
  for (const value of saved) {
    if (typeof value !== 'string') continue;
    const search = resolveSavedSearch(value, options, coverage, today);
    if (search !== null && !recent.some((entry) => isSameRoute(entry, search))) recent.push(search);
    if (recent.length === RECENT_SEARCH_LIMIT) break;
  }
  return recent;
}

/** Move a successful search to the front, replacing older criteria for the same route. */
export function prependRecentSearch(current: readonly RecentSearch[], search: RecentSearch): RecentSearch[] {
  return [search, ...current.filter((entry) => !isSameRoute(entry, search))].slice(0, RECENT_SEARCH_LIMIT);
}

/** Save current search links when browser storage allows it. */
export function persistRecentSearches(searches: readonly RecentSearch[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        searches.map(({ origin, destination, departureMode, date, departAfter }) =>
          searchQuery(origin, destination, departureMode, date, departAfter),
        ),
      ),
    );
  } catch {
    // A denied write must not interrupt the search or its in-memory recent list.
  }
}
