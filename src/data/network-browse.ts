/**
 * Builds place and line summaries from the checked-in network after it loads in the browser.
 * These lookups describe the saved network, not which trips run on a particular date.
 */
import { getRouteLabel } from './network.ts';
import type { LocationOption } from './location-search.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from './network-schema.ts';

/** Fold accents and letter case for browsing without changing displayed official names. */
function foldBrowseText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
}

/** Match names without making accents or letter case important to browse filtering. */
export function matchesBrowseQuery(value: string, query: string): boolean {
  return foldBrowseText(value).includes(foldBrowseText(query));
}

/** Keep browse lists predictable when names repeat or include line numbers. */
function byName(first: { id: string; name: string }, second: { id: string; name: string }): number {
  return (
    first.name.localeCompare(second.name, 'es', { sensitivity: 'base', numeric: true }) ||
    first.id.localeCompare(second.id)
  );
}

/** Return the physical stops within the selected municipality or local area. */
export function stopsForPlace(
  dataset: NetworkDataset,
  place: Extract<LocationOption, { kind: 'place' }>,
): NetworkStop[] {
  return dataset.stops
    .filter((stop) =>
      place.municipalityId !== undefined
        ? stop.municipalityId === place.municipalityId
        : stop.localAreaId === place.localAreaId,
    )
    .sort(byName);
}

/** List routes with saved trips that visit any of the supplied stops, once per route. */
export function linesForStops(dataset: NetworkDataset, stops: readonly NetworkStop[]): NetworkRoute[] {
  const stopIds = new Set(stops.map((stop) => stop.id));
  const routeIds = new Set(
    dataset.trips.filter((trip) => trip.stopTimes.some((time) => stopIds.has(time.stopId))).map((trip) => trip.routeId),
  );
  return dataset.routes
    .filter((route) => routeIds.has(route.id))
    .sort(
      (first, second) =>
        getRouteLabel(first).localeCompare(getRouteLabel(second), 'es', { sensitivity: 'base', numeric: true }) ||
        first.id.localeCompare(second.id),
    );
}

/** List each physical stop visited by any saved trip on a line, without implying one travel order. */
export function stopsForLine(dataset: NetworkDataset, routeId: string): NetworkStop[] {
  const stopIds = new Set(
    dataset.trips
      .filter((trip) => trip.routeId === routeId)
      .flatMap((trip) => trip.stopTimes.map((time) => time.stopId)),
  );
  return dataset.stops.filter((stop) => stopIds.has(stop.id)).sort(byName);
}

/** Use the most specific reviewed area name available for a stop. */
export function stopLocality(dataset: NetworkDataset, stop: NetworkStop): string | null {
  if (stop.localAreaId !== null) {
    const area = dataset.localAreas.find((item) => item.id === stop.localAreaId);
    if (area !== undefined) return area.name;
  }
  return dataset.municipalities.find((item) => item.id === stop.municipalityId)?.name ?? null;
}
