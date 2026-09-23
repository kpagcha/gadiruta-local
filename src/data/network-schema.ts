/**
 * Describes the routes-and-stops JSON format and checks that a loaded file has the expected fields
 * and references.
 *
 * The data-building script uses the same checks before writing the file, and the browser checks it
 * again after loading it. This catches bad data before search code tries to use it.
 */
/** App-facing topology stored in Gadiruta Local's static network snapshot. */
export interface NetworkAgency {
  id: string;
  name: string;
}

/** A public route in the locally bundled network. */
export interface NetworkRoute {
  id: string;
  agencyId: string;
  shortName: string | null;
  longName: string | null;
  type: number;
  color: string | null;
  textColor: string | null;
}

/** A physical boarding location, kept distinct from a future user-facing place. */
export interface NetworkStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  parentStationId: string | null;
}

/** One unique ordered stop sequence used by a route and direction. */
export interface RoutePattern {
  routeId: string;
  directionId: string | null;
  stopIds: string[];
}

/** Provenance recorded for a generated local snapshot. */
export interface NetworkSource {
  url: string;
  generatedAt: string;
  archiveSha256: string;
}

/** The version-one local network topology contract. */
export interface NetworkDataset {
  formatVersion: 1;
  source: NetworkSource;
  agencies: NetworkAgency[];
  routes: NetworkRoute[];
  stops: NetworkStop[];
  patterns: RoutePattern[];
}

/** Describe a malformed local-data file without exposing an implementation-specific exception. */
export class NetworkDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkDataError';
  }
}

/** A JSON object before its individual properties have been validated. */
type UnknownRecord = Record<string, unknown>;

/** Narrow unknown JSON to a non-array object before reading named properties from it. */
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Require a non-blank string so source identifiers cannot be replaced by empty display values. */
function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new NetworkDataError(`${label} must be a non-empty string.`);
  }

  return value;
}

/** Accept null for an optional field, otherwise apply the same non-blank string invariant. */
function optionalString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  return requiredString(value, label);
}

/** Require a finite JSON number before it can be used as a coordinate or GTFS route type. */
function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NetworkDataError(`${label} must be a finite number.`);
  }

  return value;
}

/** Require an array while retaining unknown elements for each shape-specific parser. */
function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new NetworkDataError(`${label} must be an array.`);
  }

  return value;
}

/** Require a JSON object before a parser reads its contract-defined fields. */
function requiredRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new NetworkDataError(`${label} must be an object.`);
  }

  return value;
}

/** Collect stable IDs and reject duplicates that would make cross-reference validation ambiguous. */
function uniqueIds(items: readonly { id: string }[], label: string): Set<string> {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new NetworkDataError(`${label} contains duplicate ID ${item.id}.`);
    }
    ids.add(item.id);
  }

  return ids;
}

/** Validate an agency record at its source-array position for a precise error message. */
function parseAgency(value: unknown, index: number): NetworkAgency {
  const record = requiredRecord(value, `agencies[${index}]`);
  return {
    id: requiredString(record.id, `agencies[${index}].id`),
    name: requiredString(record.name, `agencies[${index}].name`),
  };
}

/** Validate a route record without letting raw GTFS field names leak into UI-facing data. */
function parseRoute(value: unknown, index: number): NetworkRoute {
  const record = requiredRecord(value, `routes[${index}]`);
  return {
    id: requiredString(record.id, `routes[${index}].id`),
    agencyId: requiredString(record.agencyId, `routes[${index}].agencyId`),
    shortName: optionalString(record.shortName, `routes[${index}].shortName`),
    longName: optionalString(record.longName, `routes[${index}].longName`),
    type: requiredNumber(record.type, `routes[${index}].type`),
    color: optionalString(record.color, `routes[${index}].color`),
    textColor: optionalString(record.textColor, `routes[${index}].textColor`),
  };
}

/** Validate a physical stop and reject impossible coordinates before map features consume them. */
function parseStop(value: unknown, index: number): NetworkStop {
  const record = requiredRecord(value, `stops[${index}]`);

  // Parse coordinates separately because their geographic bounds need a second validation step.
  const latitude = requiredNumber(record.latitude, `stops[${index}].latitude`);
  const longitude = requiredNumber(record.longitude, `stops[${index}].longitude`);

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new NetworkDataError(`stops[${index}] has invalid coordinates.`);
  }

  return {
    id: requiredString(record.id, `stops[${index}].id`),
    name: requiredString(record.name, `stops[${index}].name`),
    latitude,
    longitude,
    parentStationId: optionalString(record.parentStationId, `stops[${index}].parentStationId`),
  };
}

/** Validate an ordered route-stop sequence while preserving a nullable GTFS direction identifier. */
function parsePattern(value: unknown, index: number): RoutePattern {
  const record = requiredRecord(value, `patterns[${index}]`);

  // Preserve stop order: it represents a route traversal, not a set of stops.
  const stopIds = requiredArray(record.stopIds, `patterns[${index}].stopIds`).map((stopId, stopIndex) =>
    requiredString(stopId, `patterns[${index}].stopIds[${stopIndex}]`),
  );

  if (stopIds.length === 0) {
    throw new NetworkDataError(`patterns[${index}].stopIds must not be empty.`);
  }

  return {
    routeId: requiredString(record.routeId, `patterns[${index}].routeId`),
    directionId: optionalString(record.directionId, `patterns[${index}].directionId`),
    stopIds,
  };
}

/**
 * Validate unknown JSON before it becomes data used by the interface.
 *
 * The generated file is a deployment asset, so validating both primitive fields and references
 * makes a partial upload fail visibly instead of producing subtly broken local queries.
 */
export function parseNetworkDataset(value: unknown): NetworkDataset {
  // Validate the outer version before treating any file contents as the current contract.
  const record = requiredRecord(value, 'dataset');

  if (record.formatVersion !== 1) {
    throw new NetworkDataError('dataset.formatVersion must be 1.');
  }

  const sourceRecord = requiredRecord(record.source, 'dataset.source');

  // Provenance is shown to users and supports review, so validate it with the transit topology.
  const source = {
    url: requiredString(sourceRecord.url, 'dataset.source.url'),
    generatedAt: requiredString(sourceRecord.generatedAt, 'dataset.source.generatedAt'),
    archiveSha256: requiredString(sourceRecord.archiveSha256, 'dataset.source.archiveSha256'),
  };

  if (Number.isNaN(Date.parse(source.generatedAt))) {
    throw new NetworkDataError('dataset.source.generatedAt must be an ISO date-time.');
  }
  if (!/^[a-f0-9]{64}$/.test(source.archiveSha256)) {
    throw new NetworkDataError('dataset.source.archiveSha256 must be a lowercase SHA-256 hash.');
  }

  // Shape-check each collection before examining relationships between their IDs.
  const agencies = requiredArray(record.agencies, 'dataset.agencies').map(parseAgency);
  const routes = requiredArray(record.routes, 'dataset.routes').map(parseRoute);
  const stops = requiredArray(record.stops, 'dataset.stops').map(parseStop);
  const patterns = requiredArray(record.patterns, 'dataset.patterns').map(parsePattern);

  if (agencies.length === 0 || routes.length === 0 || stops.length === 0 || patterns.length === 0) {
    throw new NetworkDataError('dataset must contain agencies, routes, stops, and patterns.');
  }

  // Build lookup sets once; the following loops validate every cross-reference in the snapshot.
  const agencyIds = uniqueIds(agencies, 'dataset.agencies');
  const routeIds = uniqueIds(routes, 'dataset.routes');
  const stopIds = uniqueIds(stops, 'dataset.stops');

  for (const route of routes) {
    if (!agencyIds.has(route.agencyId)) {
      throw new NetworkDataError(`route ${route.id} references an unknown agency.`);
    }
  }

  // A parent station and a pattern stop must both refer to records in this same local file.
  for (const stop of stops) {
    if (stop.parentStationId !== null && !stopIds.has(stop.parentStationId)) {
      throw new NetworkDataError(`stop ${stop.id} references an unknown parent station.`);
    }
  }

  // Patterns complete the graph by connecting route IDs to their ordered stop IDs.
  for (const pattern of patterns) {
    if (!routeIds.has(pattern.routeId)) {
      throw new NetworkDataError(`a pattern references unknown route ${pattern.routeId}.`);
    }

    for (const stopId of pattern.stopIds) {
      if (!stopIds.has(stopId)) {
        throw new NetworkDataError(`a pattern references unknown stop ${stopId}.`);
      }
    }
  }

  return { formatVersion: 1, source, agencies, routes, stops, patterns };
}
