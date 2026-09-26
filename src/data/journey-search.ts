/**
 * Turns editable search criteria into a runnable local query, results, and a shareable URL.
 * It has no browser or React side effects: the page owns history, storage, and visible state.
 */
import { isCalendarDate, madridToday } from './calendar-date.ts';
import { findDirectJourneys, type DirectJourney } from './direct-journeys.ts';
import { currentMadridTime, normalizeJourneyTime, type DepartureMode } from './journey-time.ts';
import { isSameLocationChoice, type LocationOption } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';
import { searchQuery } from './search-url.ts';

/** Text being edited and the exact choice, if a rider selected one. */
export interface LocationFieldValue {
  text: string;
  choice: LocationOption | null;
}

/** Editable form criteria; unresolved locations cannot be submitted. */
export interface TripSearchDraft {
  origin: LocationFieldValue;
  destination: LocationFieldValue;
  departureMode: DepartureMode;
  date: string;
  departAfter: string;
}

/** Resolved criteria, also used for recent searches after loading their saved links. */
export interface JourneySearch {
  origin: LocationOption;
  destination: LocationOption;
  departureMode: DepartureMode;
  date: string;
  departAfter: string;
}

/** Submitted journeys grouped around the departure cutoff captured for this search. */
export interface JourneySearchResult {
  earlier: DirectJourney[];
  later: DirectJourney[];
}

/** Reject incomplete or unavailable criteria, resolving Leave now from one captured instant. */
export function submitJourneySearch(
  dataset: NetworkDataset,
  draft: TripSearchDraft,
  now: Date,
): {
  search: JourneySearch;
  query: string;
  result: JourneySearchResult;
} | null {
  const origin = draft.origin.choice;
  const destination = draft.destination.choice;
  if (origin === null || destination === null || isSameLocationChoice(origin, destination)) return null;

  const today = madridToday(now);
  const date = draft.departureMode === 'leave-now' ? today : draft.date;
  if (!isCalendarDate(date) || date < today || date < dataset.coverage.startDate || date > dataset.coverage.endDate) {
    return null;
  }

  // A Leave now link stays relative when reopened; only this result records its exact cutoff.
  const departAfter =
    draft.departureMode === 'leave-now' ? currentMadridTime(now) : normalizeJourneyTime(draft.departAfter);
  const search: JourneySearch = {
    origin,
    destination,
    departureMode: draft.departureMode,
    date,
    departAfter: draft.departureMode === 'depart-at' ? departAfter : '',
  };
  return {
    search,
    query: searchQuery(origin, destination, search.departureMode, date, departAfter),
    result: findDirectJourneys(dataset, date, origin, destination, departAfter),
  };
}
