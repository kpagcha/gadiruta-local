/**
 * Builds browser-only choices from the reviewed place list and network snapshot, then finds
 * matching places, local areas, and physical stops. No search requests leave the browser.
 */
import { MIN_LOCATION_QUERY_LENGTH } from '../config.ts';
import { locationAliasGroups } from './location-search-aliases.ts';
import { getRouteLabel } from './network.ts';
import type { NetworkDataset } from './network-schema.ts';
import type { Place } from './places.ts';

/** A selectable place or physical stop, with hierarchy details used only by suggestions. */
export type LocationOption =
  | {
      kind: 'place';
      id: string;
      name: string;
      searchAliases?: readonly string[];
      municipalityId?: string;
      localAreaId?: string;
      parentMunicipalityId?: string;
      parentName?: string;
      townAreaId?: string | null;
      isTown?: boolean;
      isBroad?: boolean;
    }
  | {
      kind: 'stop';
      id: string;
      name: string;
      searchAliases?: readonly string[];
      routeLabels: string[];
      municipalityId?: string | null;
      localAreaId?: string | null;
      areaName?: string | null;
    };

/** One served municipality and its narrower choices in the place picker. */
export interface LocationMunicipality {
  id: string;
  name: string;
  choice: Extract<LocationOption, { kind: 'place' }>;
  areas: {
    id: string;
    name: string;
    choice: Extract<LocationOption, { kind: 'place' }>;
  }[];
}

/** Reject only the same selected choice; a town and its wider municipality remain distinct. */
export function isSameLocationChoice(origin: LocationOption | null, destination: LocationOption | null): boolean {
  return origin !== null && destination !== null && origin.kind === destination.kind && origin.id === destination.id;
}

/** Results stay grouped so each kind can be revealed independently in the picker. */
export interface LocationResults {
  places: LocationOption[];
  areas: LocationOption[];
  stops: LocationOption[];
}

/** Fold accents, case, and repeated spaces for name comparisons. */
function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
}

/** Keep short or whitespace-only input from opening a location search. */
export function hasMinimumLocationQuery(query: string): boolean {
  return [...normalizeSearchText(query).replaceAll(' ', '')].length >= MIN_LOCATION_QUERY_LENGTH;
}

/** Find the unique same-named or shortened town area within one municipality. */
export function townLocalAreaId(dataset: NetworkDataset, municipalityId: string): string | null {
  const municipality = dataset.municipalities.find((item) => item.id === municipalityId);
  if (municipality === undefined) return null;
  const name = normalizeSearchText(municipality.name);
  const localAreas = dataset.localAreas.filter((area) => area.municipalityId === municipalityId);
  const exact = localAreas.filter((area) => normalizeSearchText(area.name) === name);
  if (exact.length > 0) return exact.length === 1 ? exact[0]!.id : null;
  const shorter = localAreas.filter((area) => name.startsWith(`${normalizeSearchText(area.name)} `));
  return shorter.length === 1 ? shorter[0]!.id : null;
}

/** Build selectable choices, omitting empty local areas and redundant broad town choices. */
export function createLocationOptions(places: readonly Place[], dataset: NetworkDataset): LocationOption[] {
  const routeLabelsById = new Map(dataset.routes.map((route) => [route.id, getRouteLabel(route)]));
  const routeIdsByStopId = new Map<string, Set<string>>();
  const aliasesByPlaceId = new Map<string, readonly string[]>();
  const aliasesByStopId = new Map<string, readonly string[]>();
  for (const group of locationAliasGroups) {
    for (const id of group.placeIds ?? []) aliasesByPlaceId.set(id, group.aliases);
    for (const id of group.stopIds ?? []) aliasesByStopId.set(id, group.aliases);
  }
  const servedAreaIds = new Set(dataset.stops.map((stop) => stop.localAreaId).filter((id) => id !== null));
  const areaById = new Map(dataset.localAreas.map((area) => [area.id, area]));
  const municipalityById = new Map(dataset.municipalities.map((municipality) => [municipality.id, municipality]));
  const townByMunicipality = new Map(
    dataset.municipalities.map((municipality) => [municipality.id, townLocalAreaId(dataset, municipality.id)]),
  );
  const hasOtherStops = new Set(
    dataset.stops
      .filter(
        (stop) => stop.municipalityId !== null && stop.localAreaId !== townByMunicipality.get(stop.municipalityId),
      )
      .map((stop) => stop.municipalityId),
  );

  // A pattern is a route traversal; several patterns may use the same stop and route.
  for (const pattern of dataset.patterns) {
    for (const stopId of pattern.stopIds) {
      const routeIds = routeIdsByStopId.get(stopId) ?? new Set<string>();
      routeIds.add(pattern.routeId);
      routeIdsByStopId.set(stopId, routeIds);
    }
  }

  const placeOptions: LocationOption[] = places.flatMap((place) => {
    if (place.localAreaId !== undefined) {
      const area = areaById.get(place.localAreaId);
      if (area === undefined || !servedAreaIds.has(area.id)) return [];
      const townId = townByMunicipality.get(area.municipalityId);
      const isTown = townId === area.id;
      // A municipality with only town stops needs one choice with its existing URL identity.
      if (isTown && !hasOtherStops.has(area.municipalityId)) return [];
      const parentName = municipalityById.get(area.municipalityId)?.name;
      return [
        {
          kind: 'place',
          ...place,
          searchAliases: aliasesByPlaceId.get(place.id),
          name: isTown ? (parentName ?? place.name) : place.name,
          parentMunicipalityId: area.municipalityId,
          parentName,
          isTown,
        },
      ];
    }
    if (place.municipalityId !== undefined) {
      return [
        {
          kind: 'place',
          ...place,
          searchAliases: aliasesByPlaceId.get(place.id),
          townAreaId: townByMunicipality.get(place.municipalityId) ?? null,
          isBroad: hasOtherStops.has(place.municipalityId),
        },
      ];
    }
    return [{ kind: 'place', ...place, searchAliases: aliasesByPlaceId.get(place.id) }];
  });
  const stopOptions: LocationOption[] = dataset.stops.map((stop) => ({
    kind: 'stop',
    id: stop.id,
    name: stop.name,
    searchAliases: aliasesByStopId.get(stop.id),
    municipalityId: stop.municipalityId,
    localAreaId: stop.localAreaId,
    areaName:
      (stop.localAreaId === null ? null : areaById.get(stop.localAreaId)?.name) ??
      (stop.municipalityId === null ? null : municipalityById.get(stop.municipalityId)?.name) ??
      null,
    routeLabels: [...(routeIdsByStopId.get(stop.id) ?? [])]
      .map((routeId) => routeLabelsById.get(routeId) ?? routeId)
      .sort((first, second) => first.localeCompare(second, 'es', { numeric: true })),
  }));
  return [...placeOptions, ...stopOptions];
}

/** Pair served feed locations with the existing place choices used by search and URLs. */
export function createLocationMunicipalities(
  options: readonly LocationOption[],
  dataset: NetworkDataset,
): LocationMunicipality[] {
  const placeOptions = options.filter(
    (option): option is Extract<LocationOption, { kind: 'place' }> => option.kind === 'place',
  );
  const municipalitiesById = new Map(
    placeOptions
      .filter((option) => option.municipalityId !== undefined)
      .map((option) => [option.municipalityId, option]),
  );
  const areasById = new Map(
    placeOptions.filter((option) => option.localAreaId !== undefined).map((option) => [option.localAreaId, option]),
  );
  const servedMunicipalities = new Set(dataset.stops.map((stop) => stop.municipalityId).filter((id) => id !== null));
  const servedAreas = new Set(dataset.stops.map((stop) => stop.localAreaId).filter((id) => id !== null));
  const byName = (first: { id: string; name: string }, second: { id: string; name: string }) =>
    first.name.localeCompare(second.name, 'es', { sensitivity: 'base' }) || first.id.localeCompare(second.id, 'en');

  return dataset.municipalities
    .flatMap((municipality) => {
      const choice = municipalitiesById.get(municipality.id);
      if (!servedMunicipalities.has(municipality.id) || choice === undefined) return [];
      // A town with the same scope as its municipality has no separate place ID to select.
      const areas = dataset.localAreas
        .filter((area) => area.municipalityId === municipality.id && servedAreas.has(area.id))
        .flatMap((area) => {
          const areaChoice = areasById.get(area.id);
          return areaChoice === undefined ? [] : [{ id: area.id, name: area.name, choice: areaChoice }];
        })
        .sort(byName);
      return [{ id: municipality.id, name: municipality.name, choice, areas }];
    })
    .sort(byName);
}

/** Give broad and child-area choices labels that distinguish their selectable scope. */
export function locationLabel(option: LocationOption, allStopsLabel: string): string {
  if (option.kind === 'stop') return option.name;
  if (option.isBroad) return `${option.name} (${allStopsLabel})`;
  if (
    !option.isTown &&
    option.parentName &&
    !normalizeSearchText(option.name).includes(normalizeSearchText(option.parentName))
  ) {
    return `${option.name} (${option.parentName})`;
  }
  return option.name;
}

/** Rank direct name hits; every query word may appear in a different order. */
function matchRank(name: string, query: string): number {
  const normalized = normalizeSearchText(name);
  if (normalized === query) return 0;
  if (normalized.startsWith(query)) return 1;
  if (normalized.includes(query)) return 2;
  return query.split(' ').every((word) => normalized.includes(word)) ? 3 : Infinity;
}

/** Match a parent-plus-area query only when it names something specific to that area. */
function parentAreaRank(option: LocationOption, query: string): number {
  if (option.kind !== 'place' || option.localAreaId === undefined || option.isTown || !option.parentName) {
    return Infinity;
  }
  const parent = normalizeSearchText(option.parentName);
  const area = normalizeSearchText(option.name);
  const words = query.split(' ');
  if (
    !words.some((word) => parent.includes(word)) ||
    !words.some((word) => area.includes(word) && !parent.includes(word))
  ) {
    return Infinity;
  }
  return matchRank(`${option.parentName} ${option.name}`, query);
}

/** Keep official names ahead of search aliases while preserving the usual matching rules. */
function optionMatchRank(option: LocationOption, query: string): number {
  let rank = Math.min(matchRank(option.name, query), parentAreaRank(option, query));
  for (const alias of option.searchAliases ?? []) {
    rank = Math.min(rank, matchRank(alias, query) + 4);
  }
  return rank;
}

/** Find direct place hits, their child areas, and stops within the matched town or local areas. */
export function searchLocations(options: readonly LocationOption[], query: string): LocationResults {
  const empty = { places: [], areas: [], stops: [] };
  const normalizedQuery = normalizeSearchText(query);
  if (!hasMinimumLocationQuery(normalizedQuery)) return empty;
  const ranked = options.map((option) => ({
    option,
    rank: optionMatchRank(option, normalizedQuery),
  }));
  const byRank = (first: { option: LocationOption; rank: number }, second: { option: LocationOption; rank: number }) =>
    first.rank - second.rank ||
    first.option.name.localeCompare(second.option.name, 'es', { sensitivity: 'base', numeric: true }) ||
    first.option.id.localeCompare(second.option.id, 'en');
  const directPlaces = ranked.filter(({ option, rank }) => option.kind === 'place' && rank < Infinity);
  const matchedMunicipalities = new Set(
    directPlaces.flatMap(({ option }) =>
      option.kind === 'place' && option.municipalityId ? [option.municipalityId] : [],
    ),
  );
  const matchedAreaIds = new Set(
    directPlaces.flatMap(({ option }) => {
      if (option.kind !== 'place') return [];
      if (matchedMunicipalities.size > 0) return option.townAreaId ? [option.townAreaId] : [];
      return option.localAreaId ? [option.localAreaId] : [];
    }),
  );

  // A municipality hit reveals its served child areas, but only its town stops.
  const areas = ranked
    .filter(
      ({ option, rank }) =>
        option.kind === 'place' &&
        option.localAreaId !== undefined &&
        !option.isTown &&
        (rank < Infinity ||
          (option.parentMunicipalityId !== undefined && matchedMunicipalities.has(option.parentMunicipalityId))),
    )
    .sort(byRank)
    .map(({ option }) => option);
  const places = directPlaces
    .filter(({ option }) => option.kind === 'place' && (option.municipalityId !== undefined || option.isTown))
    .sort((first, second) => {
      if (first.rank !== second.rank) return first.rank - second.rank;
      if (first.option.name === second.option.name) {
        const firstBroad = first.option.kind === 'place' && first.option.isBroad ? 1 : 0;
        const secondBroad = second.option.kind === 'place' && second.option.isBroad ? 1 : 0;
        if (firstBroad !== secondBroad) return firstBroad - secondBroad;
      }
      return byRank(first, second);
    })
    .map(({ option }) => option);
  const stops = ranked
    .filter(({ option, rank }) => {
      if (option.kind !== 'stop') return false;
      if (directPlaces.length === 0) return rank < Infinity;
      return option.localAreaId !== undefined && option.localAreaId !== null && matchedAreaIds.has(option.localAreaId);
    })
    .sort((first, second) => {
      const firstDirect = first.rank < Infinity ? 0 : 1;
      const secondDirect = second.rank < Infinity ? 0 : 1;
      return firstDirect - secondDirect || byRank(first, second);
    })
    .map(({ option }) => option);
  return { places, areas, stops };
}
