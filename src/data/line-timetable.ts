/**
 * Builds shareable links for exact line paths and finds their scheduled runs in the checked-in network.
 * The browser uses this after the static dataset loads; it does not contact the transit provider.
 */
import { isCalendarDate, shiftCalendarDate } from './calendar-date.ts';
import { lineUrl } from './line-url.ts';
import { lineStopPatterns, stopLocality, type LineStopPattern } from './network-browse.ts';
import type { NetworkDataset, NetworkRoute, NetworkTrip } from './network-schema.ts';
import { urlSlug } from './url-alias.ts';

export type DatedLineTrip = { trip: NetworkTrip; serviceDate: string; minuteOffset: 0 | -1440; firstMinute: number };

/** Compare exact physical stop orders, including repeated visits. */
function followsPath(trip: NetworkTrip, pattern: LineStopPattern): boolean {
  return (
    trip.stopTimes.length === pattern.stops.length &&
    trip.stopTimes.every((time, index) => time.stopId === pattern.stops[index]?.id)
  );
}

/** Give an ordered path a natural name and add its stop count only when endpoints repeat. */
export function linePathAlias(
  dataset: NetworkDataset,
  pattern: LineStopPattern,
  patterns: readonly LineStopPattern[],
): string {
  const first = pattern.stops[0]!;
  const last = pattern.stops[pattern.stops.length - 1]!;
  const endpoints = `${urlSlug(stopLocality(dataset, first) ?? first.name, 'stop')}-to-${urlSlug(stopLocality(dataset, last) ?? last.name, 'stop')}`;
  // Two paths can connect the same places while calling at different intermediate stops.
  const sameEndpoints = patterns.filter((other) => {
    const from = other.stops[0]!;
    const to = other.stops[other.stops.length - 1]!;
    return (
      `${urlSlug(stopLocality(dataset, from) ?? from.name, 'stop')}-to-${urlSlug(stopLocality(dataset, to) ?? to.name, 'stop')}` ===
      endpoints
    );
  });
  const alias = sameEndpoints.length === 1 ? endpoints : `${endpoints}-${pattern.stops.length}-stops`;
  if (sameEndpoints.filter((other) => other.stops.length === pattern.stops.length).length > 1) {
    throw new Error(`Line path ${alias} needs a reviewed description to distinguish its URL.`);
  }
  return alias;
}

/** Build a line link for a journey's calendar travel day and exact stop sequence. */
export function datedLineUrl(
  dataset: NetworkDataset,
  route: NetworkRoute,
  trip: NetworkTrip,
  travelDate: string,
): string {
  const patterns = lineStopPatterns(dataset, route.id);
  const pattern = patterns.find((item) => followsPath(trip, item));
  if (pattern === undefined) throw new Error(`Trip ${trip.id} has no ordered path on line ${route.id}.`);
  const parameters = new URLSearchParams({ path: linePathAlias(dataset, pattern, patterns), date: travelDate });
  return `${lineUrl(route, dataset.routes)}?${parameters.toString()}`;
}

/** List only runs following this stop sequence that visit at least one stop on the selected calendar day. */
export function datedLineTrips(
  dataset: NetworkDataset,
  routeId: string,
  pattern: LineStopPattern,
  date: string,
): DatedLineTrip[] {
  if (!isCalendarDate(date) || date < dataset.coverage.startDate || date > dataset.coverage.endDate) return [];
  // The saved service dates already include GTFS weekday rules and calendar exceptions.
  const datesByService = new Map(dataset.serviceDates.map((service) => [service.serviceId, new Set(service.dates)]));
  const precedingDate = shiftCalendarDate(date, -1);
  const runs: DatedLineTrip[] = [];
  for (const trip of dataset.trips) {
    if (trip.routeId !== routeId || !followsPath(trip, pattern)) continue;
    for (const [serviceDate, minuteOffset] of [
      [date, 0],
      [precedingDate, -1440],
    ] as const) {
      if (!datesByService.get(trip.serviceId)?.has(serviceDate)) continue;
      const firstMinute = trip.stopTimes
        .map((time) => time.arrivalMinutes + minuteOffset)
        .find((minute) => minute >= 0 && minute < 1440);
      if (firstMinute !== undefined) {
        runs.push({ trip, serviceDate, minuteOffset, firstMinute });
      }
    }
  }
  return runs.sort(
    (first, second) => first.firstMinute - second.firstMinute || first.trip.id.localeCompare(second.trip.id),
  );
}

/** Keep the line URL date within the versioned snapshot while allowing historical links. */
export function lineDateFromQuery(rawDate: string | null, coverage: NetworkDataset['coverage']): string | null {
  return rawDate !== null && isCalendarDate(rawDate) && rawDate >= coverage.startDate && rawDate <= coverage.endDate
    ? rawDate
    : null;
}
