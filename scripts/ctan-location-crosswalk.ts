/**
 * Reads CTAN municipality, area, and stop replies and checks whether their IDs match GTFS stop IDs.
 *
 * These checks are kept separate from the network-requesting probe so they can be tested with
 * saved examples and do not need a live connection to CTAN.
 */
/** One municipality listed by CTAN's Bahia de Cadiz location API. */
export interface CtanMunicipality {
  id: string;
}

/** One population nucleus listed beneath a CTAN municipality. */
export interface CtanNucleus {
  id: string;
  municipalityId: string;
}

/** One CTAN boarding location with the hierarchy it declares. */
export interface CtanStop {
  id: string;
  municipalityId: string;
  nucleusId: string;
}

/** One line-itinerary stop with CTAN's municipality value carried in its mislabeled field. */
export interface CtanLineStop {
  id: string;
  municipalityId: string;
}

/** One exact GTFS stop match resolved by CTAN's line itinerary endpoint. */
export interface CtanLineFallback {
  gtfsStopId: string;
  municipalityId: string;
}

/** CTAN location records reduced to the identifiers needed to prove the GTFS relation. */
export interface CtanLocationDirectory {
  municipalities: readonly CtanMunicipality[];
  nuclei: readonly CtanNucleus[];
  stops: readonly CtanStop[];
}

/** The persisted result of a CTAN-to-GTFS location crosswalk probe. */
export interface CtanLocationProbeReport {
  status: 'verified' | 'incomplete';
  gtfsStopCount: number;
  municipalityCount: number;
  nucleusCount: number;
  ctanStopCount: number;
  matchedGtfsStopCount: number;
  unmatchedGtfsStopIds: string[];
  lineFallbacks: CtanLineFallback[];
  unresolvedNucleusGtfsStopIds: string[];
}

/** Reject an upstream or command-line condition with a distinct, actionable error prefix. */
function fail(message: string): never {
  throw new Error(`CTAN location probe error: ${message}`);
}

/** Narrow unknown JSON to an object before accessing a CTAN response property. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Require a non-empty decimal CTAN identifier so it remains safe in URLs and capture filenames. */
function requiredIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    fail(`${label} must be a non-empty decimal identifier.`);
  }

  return value;
}

/** Require a response array while retaining unknown records for its specific parser. */
function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }

  return value;
}

/** Require a JSON object with a source-specific label for diagnostics. */
function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(`${label} must be an object.`);
  }

  return value;
}

/** Parse CTAN's municipality-list response without relying on names for the crosswalk. */
export function parseCtanMunicipalities(value: unknown): CtanMunicipality[] {
  const record = requiredRecord(value, 'municipalities response');
  return requiredArray(record.municipios, 'municipalities response.municipios').map((item, index) => {
    const municipality = requiredRecord(item, `municipalities[${index}]`);
    return { id: requiredIdentifier(municipality.idMunicipio, `municipalities[${index}].idMunicipio`) };
  });
}

/** Parse CTAN's nuclei-list response and retain its explicit municipality relationship. */
export function parseCtanNuclei(value: unknown): CtanNucleus[] {
  const record = requiredRecord(value, 'nuclei response');
  return requiredArray(record.nucleos, 'nuclei response.nucleos').map((item, index) => {
    const nucleus = requiredRecord(item, `nuclei[${index}]`);
    return {
      id: requiredIdentifier(nucleus.idNucleo, `nuclei[${index}].idNucleo`),
      municipalityId: requiredIdentifier(nucleus.idMunicipio, `nuclei[${index}].idMunicipio`),
    };
  });
}

/** Parse CTAN's consortium-wide stops response and retain only authoritative hierarchy IDs. */
export function parseCtanStops(value: unknown): CtanStop[] {
  const record = requiredRecord(value, 'stops response');
  return requiredArray(record.paradas, 'stops response.paradas').map((item, index) =>
    parseCtanStop(item, `stops[${index}]`),
  );
}

/** Parse a single CTAN stop response before it supplements an incomplete collection response. */
export function parseCtanStop(value: unknown, label = 'stop response'): CtanStop {
  const stop = requiredRecord(value, label);
  return {
    id: requiredIdentifier(stop.idParada, `${label}.idParada`),
    municipalityId: requiredIdentifier(stop.idMunicipio, `${label}.idMunicipio`),
    nucleusId: requiredIdentifier(stop.idNucleo, `${label}.idNucleo`),
  };
}

/**
 * Parse CTAN line stops, treating its `idNucleo` field as a municipality ID.
 *
 * The current Bahia API was checked across all selected line itineraries: 1,493 comparable stop
 * rows matched their directory `idMunicipio` and none matched only `idNucleo`.
 */
export function parseCtanLineStops(value: unknown): CtanLineStop[] {
  const record = requiredRecord(value, 'line stops response');
  return requiredArray(record.paradas, 'line stops response.paradas').map((item, index) => {
    const stop = requiredRecord(item, `line stops[${index}]`);
    return {
      id: requiredIdentifier(stop.idParada, `line stops[${index}].idParada`),
      municipalityId: requiredIdentifier(stop.idNucleo, `line stops[${index}].idNucleo`),
    };
  });
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
  const nucleiById = uniqueById(directory.nuclei, 'nuclei');
  const stopsById = uniqueById(directory.stops, 'stops');

  // A núcleo cannot be useful to the crosswalk unless its parent municipality is present.
  for (const nucleus of directory.nuclei) {
    if (!municipalitiesById.has(nucleus.municipalityId)) {
      fail(`nucleus ${nucleus.id} references unknown municipality ${nucleus.municipalityId}.`);
    }
  }

  // Every stop must point to a known núcleo that agrees about the enclosing municipality.
  for (const stop of directory.stops) {
    const nucleus = nucleiById.get(stop.nucleusId);
    if (nucleus === undefined) {
      fail(`stop ${stop.id} references unknown nucleus ${stop.nucleusId}.`);
    }
    if (nucleus.municipalityId !== stop.municipalityId) {
      fail(`stop ${stop.id} disagrees with nucleus ${stop.nucleusId} about its municipality.`);
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

  // A line itinerary proves both the exact stop and municipality; the núcleo remains unknown.
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

  // These IDs remain evidence that CTAN did not supply a usable municipality -> núcleo relation.
  const unresolvedNucleusGtfsStopIds = [...resolvedByLineFallback.keys()].sort(compareText);

  // This final difference is the user-facing evidence of stop IDs CTAN did not supply by any source.
  const unmatchedGtfsStopIds = [...uniqueGtfsStopIds]
    .filter((stopId) => !matchedGtfsStopIds.has(stopId))
    .sort(compareText);

  return {
    status: unmatchedGtfsStopIds.length === 0 && unresolvedNucleusGtfsStopIds.length === 0 ? 'verified' : 'incomplete',
    gtfsStopCount: uniqueGtfsStopIds.size,
    municipalityCount: municipalitiesById.size,
    nucleusCount: nucleiById.size,
    ctanStopCount: stopsById.size,
    matchedGtfsStopCount: matchedGtfsStopIds.size,
    unmatchedGtfsStopIds,
    lineFallbacks: [...resolvedByLineFallback.values()].sort((first, second) =>
      compareText(first.gtfsStopId, second.gtfsStopId),
    ),
    unresolvedNucleusGtfsStopIds,
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
