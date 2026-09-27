/**
 * Builds shareable links for exact line paths and finds their scheduled runs in the checked-in network.
 * The browser uses this after the static dataset loads; it does not contact the transit provider.
 */
import { isCalendarDate } from './calendar-date.ts';
import { clockTime } from './journey-time.ts';
import { lineUrl } from './line-url.ts';
import { lineStopPatterns, stopLocality, type LineStopPattern } from './network-browse.ts';
import type { NetworkDataset, NetworkRoute, NetworkTrip } from './network-schema.ts';
import { urlSlug } from './url-alias.ts';

export type DatedLineTrip = { trip: NetworkTrip; serviceDate: string; firstMinute: number };

/** Name a run by its first departure on the selected service date. */
function departureAlias(run: DatedLineTrip): string {
  return clockTime(run.trip.stopTimes[0]!.departureMinutes).replace(':', '-');
}

/** Give one run a readable token, numbering buses that depart at the same time on this path. */
export function lineRunAlias(run: DatedLineTrip, runs: readonly DatedLineTrip[]): string {
  const base = departureAlias(run);
  const sameDeparture = runs
    .filter((other) => departureAlias(other) === base)
    .sort(
      (first, second) =>
        first.serviceDate.localeCompare(second.serviceDate) || first.trip.id.localeCompare(second.trip.id),
    );
  const index = sameDeparture.findIndex(
    (other) => other.trip.id === run.trip.id && other.serviceDate === run.serviceDate,
  );
  if (index < 0) throw new Error(`Run ${run.trip.id} is missing from the selected line timetable.`);
  return index === 0 ? base : `${base}-${index + 1}`;
}

/** Resolve a shared run token within the already selected date and exact path. */
export function lineRunFromAlias(runs: readonly DatedLineTrip[], alias: string): DatedLineTrip | undefined {
  return runs.find((run) => lineRunAlias(run, runs) === alias);
}

/** Compare exact physical stop orders, including repeated visits. */
function followsPath(trip: NetworkTrip, pattern: LineStopPattern): boolean {
  return (
    trip.stopTimes.length === pattern.stops.length &&
    trip.stopTimes.every((time, index) => time.stopId === pattern.stops[index]?.id)
  );
}

/** Measure a trip from its first departure to its last arrival, including time after midnight. */
export function lineTripDurationMinutes(trip: NetworkTrip): number {
  return trip.stopTimes[trip.stopTimes.length - 1]!.arrivalMinutes - trip.stopTimes[0]!.departureMinutes;
}

/** Average the saved trips following one exact path, optionally using only trips on a selected date. */
export function linePathAverageDurationMinutes(
  trips: readonly NetworkTrip[],
  routeId: string,
  pattern: LineStopPattern,
): number | null {
  let total = 0;
  let count = 0;
  for (const trip of trips) {
    if (trip.routeId !== routeId || !followsPath(trip, pattern)) continue;
    total += lineTripDurationMinutes(trip);
    count += 1;
  }
  return count === 0 ? null : Math.round(total / count);
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

/** Build a line link for a journey's service date and exact stop sequence. */
export function datedLineUrl(
  dataset: NetworkDataset,
  route: NetworkRoute,
  trip: NetworkTrip,
  serviceDate: string,
): string {
  const patterns = lineStopPatterns(dataset, route.id);
  const pattern = patterns.find((item) => followsPath(trip, item));
  if (pattern === undefined) throw new Error(`Trip ${trip.id} has no ordered path on line ${route.id}.`);
  const parameters = new URLSearchParams({ path: linePathAlias(dataset, pattern, patterns), date: serviceDate });
  return `${lineUrl(route, dataset.routes)}?${parameters.toString()}`;
}

/** List runs that start this exact stop sequence on the selected service date. */
export function datedLineTrips(
  dataset: NetworkDataset,
  routeId: string,
  pattern: LineStopPattern,
  date: string,
): DatedLineTrip[] {
  if (!isCalendarDate(date) || date < dataset.coverage.startDate || date > dataset.coverage.endDate) return [];
  // The saved service dates already include GTFS weekday rules and calendar exceptions.
  const datesByService = new Map(dataset.serviceDates.map((service) => [service.serviceId, new Set(service.dates)]));
  const runs: DatedLineTrip[] = [];
  for (const trip of dataset.trips) {
    if (trip.routeId !== routeId || !followsPath(trip, pattern)) continue;
    if (!datesByService.get(trip.serviceId)?.has(date)) continue;
    const firstMinute = trip.stopTimes[0]!.departureMinutes;
    // A GTFS service day may contain starts after midnight; those belong to the next calendar date.
    if (firstMinute < 1440) runs.push({ trip, serviceDate: date, firstMinute });
  }
  return runs.sort(
    (first, second) => first.firstMinute - second.firstMinute || first.trip.id.localeCompare(second.trip.id),
  );
}

/** Show one stop's times in scheduled run order, including visits after midnight. */
export function lineStopTimesAtStop(
  runs: readonly DatedLineTrip[],
  stopIndex: number,
): { minute: number; item: DatedLineTrip }[] {
  return runs.map((item) => ({ minute: item.trip.stopTimes[stopIndex]!.arrivalMinutes, item }));
}

/** Keep the line URL date within the versioned snapshot while allowing historical links. */
export function lineDateFromQuery(rawDate: string | null, coverage: NetworkDataset['coverage']): string | null {
  return rawDate !== null && isCalendarDate(rawDate) && rawDate >= coverage.startDate && rawDate <= coverage.endDate
    ? rawDate
    : null;
}
