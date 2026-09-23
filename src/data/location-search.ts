/**
 * Combines the project's place names with bus stops from the loaded JSON to make origin and
 * destination search choices.
 *
 * It also matches what a person types against those names and adds the bus route names served by
 * each stop. All of this work happens in the browser using local data.
 */
import { getRouteLabel } from './network.ts';
import type { NetworkDataset } from './network-schema.ts';
import type { Place } from './places.ts';

/** One selectable place or exact physical stop in the shared origin/destination search. */
export type LocationOption =
  { kind: 'place'; id: string; name: string } | { kind: 'stop'; id: string; name: string; routeLabels: string[] };

/** Fold accents, case, and repeated spaces for forgiving local name searches. */
function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
}

/** Build searchable choices and stop line context from one already validated network snapshot. */
export function createLocationOptions(places: readonly Place[], dataset: NetworkDataset): LocationOption[] {
  const routeLabelsById = new Map(dataset.routes.map((route) => [route.id, getRouteLabel(route)]));
  const routeIdsByStopId = new Map<string, Set<string>>();

  // A pattern is a route traversal; several patterns may use the same stop and route.
  for (const pattern of dataset.patterns) {
    for (const stopId of pattern.stopIds) {
      const routeIds = routeIdsByStopId.get(stopId) ?? new Set<string>();
      routeIds.add(pattern.routeId);
      routeIdsByStopId.set(stopId, routeIds);
    }
  }

  const placeOptions: LocationOption[] = places.map((place) => ({ kind: 'place', id: place.id, name: place.name }));
  const stopOptions: LocationOption[] = dataset.stops.map((stop) => ({
    kind: 'stop',
    id: stop.id,
    name: stop.name,
    routeLabels: [...(routeIdsByStopId.get(stop.id) ?? [])]
      .map((routeId) => routeLabelsById.get(routeId) ?? routeId)
      .sort((first, second) => first.localeCompare(second, 'es', { numeric: true })),
  }));

  return [...placeOptions, ...stopOptions];
}

/** Return up to eight local results, ranking exact and prefix matches before other name matches. */
export function searchLocations(options: readonly LocationOption[], query: string, limit = 8): LocationOption[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery === '' || limit <= 0) {
    return [];
  }

  return options
    .map((option) => {
      const name = normalizeSearchText(option.name);
      const rank =
        name === normalizedQuery ? 0 : name.startsWith(normalizedQuery) ? 1 : name.includes(normalizedQuery) ? 2 : 3;
      return { option, rank };
    })
    .filter(({ rank }) => rank < 3)
    .sort(
      (first, second) =>
        first.rank - second.rank ||
        (first.option.kind === second.option.kind ? 0 : first.option.kind === 'place' ? -1 : 1) ||
        first.option.name.localeCompare(second.option.name, 'es', { sensitivity: 'base', numeric: true }) ||
        first.option.id.localeCompare(second.option.id, 'en'),
    )
    .slice(0, limit)
    .map(({ option }) => option);
}
