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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new NetworkDataError(`${label} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  return requiredString(value, label);
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new NetworkDataError(`${label} must be a finite number.`);
  }

  return value;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new NetworkDataError(`${label} must be an array.`);
  }

  return value;
}

function requiredRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new NetworkDataError(`${label} must be an object.`);
  }

  return value;
}

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

function parseAgency(value: unknown, index: number): NetworkAgency {
  const record = requiredRecord(value, `agencies[${index}]`);
  return {
    id: requiredString(record.id, `agencies[${index}].id`),
    name: requiredString(record.name, `agencies[${index}].name`),
  };
}

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

function parseStop(value: unknown, index: number): NetworkStop {
  const record = requiredRecord(value, `stops[${index}]`);
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

function parsePattern(value: unknown, index: number): RoutePattern {
  const record = requiredRecord(value, `patterns[${index}]`);
  const stopIds = requiredArray(record.stopIds, `patterns[${index}].stopIds`).map(
    (stopId, stopIndex) => requiredString(stopId, `patterns[${index}].stopIds[${stopIndex}]`),
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
  const record = requiredRecord(value, 'dataset');

  if (record.formatVersion !== 1) {
    throw new NetworkDataError('dataset.formatVersion must be 1.');
  }

  const sourceRecord = requiredRecord(record.source, 'dataset.source');
  const source = {
    url: requiredString(sourceRecord.url, 'dataset.source.url'),
    generatedAt: requiredString(sourceRecord.generatedAt, 'dataset.source.generatedAt'),
    archiveSha256: requiredString(sourceRecord.archiveSha256, 'dataset.source.archiveSha256'),
  };

  if (Number.isNaN(Date.parse(source.generatedAt))) {
    throw new NetworkDataError('dataset.source.generatedAt must be an ISO date-time.');
  }

  const agencies = requiredArray(record.agencies, 'dataset.agencies').map(parseAgency);
  const routes = requiredArray(record.routes, 'dataset.routes').map(parseRoute);
  const stops = requiredArray(record.stops, 'dataset.stops').map(parseStop);
  const patterns = requiredArray(record.patterns, 'dataset.patterns').map(parsePattern);

  if (agencies.length === 0 || routes.length === 0 || stops.length === 0 || patterns.length === 0) {
    throw new NetworkDataError('dataset must contain agencies, routes, stops, and patterns.');
  }

  const agencyIds = uniqueIds(agencies, 'dataset.agencies');
  const routeIds = uniqueIds(routes, 'dataset.routes');
  const stopIds = uniqueIds(stops, 'dataset.stops');

  for (const route of routes) {
    if (!agencyIds.has(route.agencyId)) {
      throw new NetworkDataError(`route ${route.id} references an unknown agency.`);
    }
  }

  for (const stop of stops) {
    if (stop.parentStationId !== null && !stopIds.has(stop.parentStationId)) {
      throw new NetworkDataError(`stop ${stop.id} references an unknown parent station.`);
    }
  }

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
