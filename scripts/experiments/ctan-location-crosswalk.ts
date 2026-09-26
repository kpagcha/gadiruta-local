/**
 * Reads CTAN municipality, area, and stop replies and checks whether their IDs match GTFS stop IDs.
 *
 * These checks are kept separate from the network-requesting probe so they can be tested with
 * saved examples and do not need a live connection to CTAN.
 */
import { z } from 'zod';

// CTAN IDs must be decimal strings before they can become URLs or capture filenames.
const identifier = z.string().regex(/^\d+$/, 'must be a non-empty decimal identifier');
const municipalityResponse = z.object({ idMunicipio: identifier });
const localAreaResponse = z.object({ idNucleo: identifier, idMunicipio: identifier });
const stopResponse = z.object({ idParada: identifier, idMunicipio: identifier, idNucleo: identifier });
const lineStopResponse = z.object({ idParada: identifier, idNucleo: identifier });

/** One municipality reduced to its authoritative identifier. */
export type CtanMunicipality = ReturnType<typeof parseCtanMunicipalities>[number];
/** One local area's declared municipality relationship. */
export type CtanLocalArea = ReturnType<typeof parseCtanLocalAreas>[number];
/** A physical stop's declared location relationship. */
export type CtanStop = ReturnType<typeof parseCtanStop>;
/** The municipality identified by CTAN's mislabeled line-stop field. */
export type CtanLineStop = ReturnType<typeof parseCtanLineStops>[number];

/** One exact GTFS stop match resolved by CTAN's line itinerary endpoint. */
export interface CtanLineFallback {
  gtfsStopId: string;
  municipalityId: string;
}

/** CTAN location records reduced to the identifiers needed to prove the GTFS relation. */
export interface CtanLocationDirectory {
  municipalities: readonly CtanMunicipality[];
  localAreas: readonly CtanLocalArea[];
  stops: readonly CtanStop[];
}

/** The persisted result of a CTAN-to-GTFS location crosswalk probe. */
export interface CtanLocationProbeReport {
  status: 'verified' | 'incomplete';
  gtfsStopCount: number;
  municipalityCount: number;
  localAreaCount: number;
  ctanStopCount: number;
  matchedGtfsStopCount: number;
  unmatchedGtfsStopIds: string[];
  lineFallbacks: CtanLineFallback[];
  unresolvedLocalAreaGtfsStopIds: string[];
}

/** Reject an upstream or command-line condition with a distinct, actionable error prefix. */
function fail(message: string): never {
  throw new Error(`CTAN location probe error: ${message}`);
}

/** Narrow unknown JSON to an object before accessing a CTAN response property. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse a municipality reply once and discard fields irrelevant to the crosswalk. */
export function parseCtanMunicipalities(value: unknown) {
  const { municipios } = z.object({ municipios: z.array(municipalityResponse) }).parse(value);
  return municipios.map((item) => ({ id: item.idMunicipio }));
}

/** Read the explicit municipality relationship in a local-area collection. */
export function parseCtanLocalAreas(value: unknown) {
  const { nucleos } = z.object({ nucleos: z.array(localAreaResponse) }).parse(value);
  return nucleos.map((item) => ({ id: item.idNucleo, municipalityId: item.idMunicipio }));
}

/** Read the hierarchy declared by CTAN's all-stops collection. */
export function parseCtanStops(value: unknown) {
  const { paradas } = z.object({ paradas: z.array(stopResponse) }).parse(value);
  return paradas.map((item) => ({ id: item.idParada, municipalityId: item.idMunicipio, localAreaId: item.idNucleo }));
}

/** Read a detail response before it supplements an incomplete collection. */
export function parseCtanStop(value: unknown) {
  const item = stopResponse.parse(value);
  return { id: item.idParada, municipalityId: item.idMunicipio, localAreaId: item.idNucleo };
}

/**
 * Treat line-stop idNucleo as a municipality ID, never as evidence of local-area membership.
 * The source audit found 1,493 comparable rows matching idMunicipio and none matching only idNucleo.
 */
export function parseCtanLineStops(value: unknown) {
  const { paradas } = z.object({ paradas: z.array(lineStopResponse) }).parse(value);
  return paradas.map((item) => ({ id: item.idParada, municipalityId: item.idNucleo }));
}

/** Index identifiers and reject duplicates that would make a location membership ambiguous. */
function uniqueById<T extends { id: string }>(items: readonly T[], label: string): Map<string, T> {
  const itemsById = new Map<string, T>();

  for (const item of items) {
    if (itemsById.has(item.id)) {
      fail(`${label} contains duplicate ID ${item.id}.`);
    }
    itemsById.set(item.id, item);
  }

  return itemsById;
}

/** Index line-itinerary stops while rejecting a CTAN stop that claims two municipality IDs. */
export function indexCtanLineStops(stops: readonly CtanLineStop[]): Map<string, CtanLineStop> {
  const stopsById = new Map<string, CtanLineStop>();

  for (const stop of stops) {
    const existing = stopsById.get(stop.id);
    if (existing !== undefined && existing.municipalityId !== stop.municipalityId) {
      fail(`line itinerary gives stop ${stop.id} conflicting municipality IDs.`);
    }
    stopsById.set(stop.id, stop);
  }

  return stopsById;
}

/** Convert CTAN's consortium-scoped stop identifier into its matching raw GTFS stop identifier. */
export function getGtfsStopId(ctanStopId: string): string {
  return `2_${ctanStopId}`;
}

/** Recover CTAN's numeric stop identifier only from the verified Bahia GTFS ID namespace. */
export function getCtanStopId(gtfsStopId: string): string | null {
  const match = /^2_(\d+)$/.exec(gtfsStopId);
  return match?.[1] ?? null;
}

/** Recover CTAN's numeric line identifier only from the verified Bahia GTFS route namespace. */
export function getCtanLineId(gtfsRouteId: string): string | null {
  const match = /^2_(\d+)$/.exec(gtfsRouteId);
  return match?.[1] ?? null;
}

/** Sort text deterministically for reports that are reviewed outside the API's response ordering. */
function compareText(first: string, second: string): number {
  return first.localeCompare(second, 'en');
}

/**
 * Verify CTAN's hierarchy and calculate whether its stop identifiers cover every selected GTFS stop.
 *
 * CTAN's API provides `idParada`; its current unified GTFS feed namespaces that exact value as
 * `2_<idParada>`, where `2` is the Bahia de Cadiz consortium identifier. Names and coordinates are
 * deliberately excluded so an incomplete official relationship cannot become an inferred one.
 */
export function createCtanLocationProbeReport(
  directory: CtanLocationDirectory,
  gtfsStopIds: readonly string[],
  lineFallbacks: readonly CtanLineFallback[] = [],
): CtanLocationProbeReport {
  // Index each CTAN level first, which both detects duplicate IDs and makes relationship checks direct.
  const municipalitiesById = uniqueById(directory.municipalities, 'municipalities');
  const localAreasById = uniqueById(directory.localAreas, 'localAreas');
  const stopsById = uniqueById(directory.stops, 'stops');

  // A local area cannot be useful to the crosswalk unless its parent municipality is present.
  for (const localArea of directory.localAreas) {
    if (!municipalitiesById.has(localArea.municipalityId)) {
      fail(`local area ${localArea.id} references unknown municipality ${localArea.municipalityId}.`);
    }
  }

  // Every stop must point to a known local area that agrees about the enclosing municipality.
  for (const stop of directory.stops) {
    const localArea = localAreasById.get(stop.localAreaId);
    if (localArea === undefined) {
      fail(`stop ${stop.id} references unknown local area ${stop.localAreaId}.`);
    }
    if (localArea.municipalityId !== stop.municipalityId) {
      fail(`stop ${stop.id} disagrees with local area ${stop.localAreaId} about its municipality.`);
    }
  }

  // The GTFS selection is the coverage target; duplicates would make the reported counts misleading.
  const uniqueGtfsStopIds = new Set(gtfsStopIds);
  if (uniqueGtfsStopIds.size !== gtfsStopIds.length) {
    fail('selected GTFS stops contain duplicate stop IDs.');
  }
  if (uniqueGtfsStopIds.size === 0) {
    fail('selected GTFS stops are empty.');
  }

  // Translate only the verified identifier relation; names and coordinates never take part in matching.
  const matchedGtfsStopIds = new Set<string>();
  for (const ctanStopId of stopsById.keys()) {
    const gtfsStopId = getGtfsStopId(ctanStopId);
    if (uniqueGtfsStopIds.has(gtfsStopId)) {
      matchedGtfsStopIds.add(gtfsStopId);
    }
  }

  // A line itinerary proves both the exact stop and municipality; the local area remains unknown.
  const resolvedByLineFallback = new Map<string, CtanLineFallback>();
  for (const fallback of lineFallbacks) {
    if (!municipalitiesById.has(fallback.municipalityId)) {
      fail(`line fallback ${fallback.gtfsStopId} references unknown municipality ${fallback.municipalityId}.`);
    }
    if (!uniqueGtfsStopIds.has(fallback.gtfsStopId)) {
      continue;
    }

    const existing = resolvedByLineFallback.get(fallback.gtfsStopId);
    if (existing !== undefined) {
      if (existing.municipalityId !== fallback.municipalityId) {
        fail(`line fallback ${fallback.gtfsStopId} gives conflicting municipality IDs.`);
      }
      continue;
    }
    if (!matchedGtfsStopIds.has(fallback.gtfsStopId)) {
      matchedGtfsStopIds.add(fallback.gtfsStopId);
      resolvedByLineFallback.set(fallback.gtfsStopId, fallback);
    }
  }

  // These IDs remain evidence that CTAN did not supply a usable municipality-to-area relation.
  const unresolvedLocalAreaGtfsStopIds = [...resolvedByLineFallback.keys()].sort(compareText);

  // This final difference is the user-facing evidence of stop IDs CTAN did not supply by any source.
  const unmatchedGtfsStopIds = [...uniqueGtfsStopIds]
    .filter((stopId) => !matchedGtfsStopIds.has(stopId))
    .sort(compareText);

  return {
    status:
      unmatchedGtfsStopIds.length === 0 && unresolvedLocalAreaGtfsStopIds.length === 0 ? 'verified' : 'incomplete',
    gtfsStopCount: uniqueGtfsStopIds.size,
    municipalityCount: municipalitiesById.size,
    localAreaCount: localAreasById.size,
    ctanStopCount: stopsById.size,
    matchedGtfsStopCount: matchedGtfsStopIds.size,
    unmatchedGtfsStopIds,
    lineFallbacks: [...resolvedByLineFallback.values()].sort((first, second) =>
      compareText(first.gtfsStopId, second.gtfsStopId),
    ),
    unresolvedLocalAreaGtfsStopIds,
  };
}

/** Identify CTAN's ordinary response for an individual stop identifier that has no record. */
export function isMissingCtanStopResponse(status: number, text: string): boolean {
  // CTAN uses both ordinary 404s and this Spanish 400 payload for a stop ID with no record.
  if (status === 404) {
    return true;
  }
  if (status !== 400) {
    return false;
  }

  try {
    // Only accept CTAN's exact no-data message; a different 400 still needs attention.
    const value: unknown = JSON.parse(text);
    return isRecord(value) && value.error === 'No se encuentran los datos';
  } catch {
    return false;
  }
}
