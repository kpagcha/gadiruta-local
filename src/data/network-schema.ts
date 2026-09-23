/**
 * Describes the local network and timetable JSON and checks its fields and references.
 *
 * The data-building script uses the same checks before writing the file, and the browser checks it
 * again after loading it. This catches bad data before search code tries to use it.
 */
import { places } from './places.ts';
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
  placeId: string | null;
}

/** One stop visit with GTFS minutes measured from the trip's service date. */
export interface NetworkStopTime {
  stopId: string;
  arrivalMinutes: number;
  departureMinutes: number;
  pickupType: number;
  dropOffType: number;
}

/** One scheduled vehicle journey, including its ordered stop visits. */
export interface NetworkTrip {
  id: string;
  routeId: string;
  serviceId: string;
  stopTimes: NetworkStopTime[];
}

/** GTFS weekdays run Monday through Sunday. */
export interface NetworkCalendar {
  serviceId: string;
  startDate: string;
  endDate: string;
  weekdays: boolean[];
}

/** An added or removed service on one specific date. */
export interface NetworkCalendarException {
  serviceId: string;
  date: string;
  type: 1 | 2;
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

/** The version-two local network and timetable contract. */
export interface NetworkDataset {
  formatVersion: 2;
  source: NetworkSource;
  agencies: NetworkAgency[];
  routes: NetworkRoute[];
  stops: NetworkStop[];
  patterns: RoutePattern[];
  trips: NetworkTrip[];
  calendars: NetworkCalendar[];
  calendarExceptions: NetworkCalendarException[];
  coverage: { startDate: string; endDate: string };
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

/** Require an integer within GTFS's supported non-negative minute range. */
function requiredMinute(value: unknown, label: string): number {
  const minute = requiredNumber(value, label);
  if (!Number.isInteger(minute) || minute < 0 || minute > 143999) {
    throw new NetworkDataError(`${label} must be a non-negative integer minute.`);
  }
  return minute;
}

/** Check date spelling and real Gregorian dates before lexical date comparisons. */
function requiredDate(value: unknown, label: string): string {
  const date = requiredString(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  ) {
    throw new NetworkDataError(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return date;
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
    placeId: optionalString(record.placeId, `stops[${index}].placeId`),
  };
}

/** Validate one trip and the timetable at each ordered stop visit. */
function parseTrip(value: unknown, index: number): NetworkTrip {
  const record = requiredRecord(value, `trips[${index}]`);
  const stopTimes = requiredArray(record.stopTimes, `trips[${index}].stopTimes`).map((value, stopIndex) => {
    const label = `trips[${index}].stopTimes[${stopIndex}]`;
    const time = requiredRecord(value, label);
    const arrivalMinutes = requiredMinute(time.arrivalMinutes, `${label}.arrivalMinutes`);
    const departureMinutes = requiredMinute(time.departureMinutes, `${label}.departureMinutes`);
    const pickupType = requiredNumber(time.pickupType, `${label}.pickupType`);
    const dropOffType = requiredNumber(time.dropOffType, `${label}.dropOffType`);
    if (
      arrivalMinutes > departureMinutes ||
      ![0, 1, 2, 3].includes(pickupType) ||
      ![0, 1, 2, 3].includes(dropOffType)
    ) {
      throw new NetworkDataError(`${label} has invalid arrival, departure, pickup, or drop-off values.`);
    }
    return {
      stopId: requiredString(time.stopId, `${label}.stopId`),
      arrivalMinutes,
      departureMinutes,
      pickupType,
      dropOffType,
    };
  });
  if (
    stopTimes.length < 2 ||
    stopTimes.some(
      (time, timeIndex) => timeIndex > 0 && time.arrivalMinutes < stopTimes[timeIndex - 1]!.departureMinutes,
    )
  ) {
    throw new NetworkDataError(`trips[${index}].stopTimes must be ordered and contain at least two stops.`);
  }
  return {
    id: requiredString(record.id, `trips[${index}].id`),
    routeId: requiredString(record.routeId, `trips[${index}].routeId`),
    serviceId: requiredString(record.serviceId, `trips[${index}].serviceId`),
    stopTimes,
  };
}

/** Validate the weekly service span and its seven weekday switches. */
function parseCalendar(value: unknown, index: number): NetworkCalendar {
  const record = requiredRecord(value, `calendars[${index}]`);
  const startDate = requiredDate(record.startDate, `calendars[${index}].startDate`);
  const endDate = requiredDate(record.endDate, `calendars[${index}].endDate`);
  const weekdays = requiredArray(record.weekdays, `calendars[${index}].weekdays`);
  if (startDate > endDate || weekdays.length !== 7 || weekdays.some((day) => typeof day !== 'boolean')) {
    throw new NetworkDataError(`calendars[${index}] has invalid dates or weekdays.`);
  }
  return {
    serviceId: requiredString(record.serviceId, `calendars[${index}].serviceId`),
    startDate,
    endDate,
    weekdays: weekdays as boolean[],
  };
}

/** Validate one GTFS added or removed service exception. */
function parseCalendarException(value: unknown, index: number): NetworkCalendarException {
  const record = requiredRecord(value, `calendarExceptions[${index}]`);
  if (record.type !== 1 && record.type !== 2) {
    throw new NetworkDataError(`calendarExceptions[${index}].type must be 1 or 2.`);
  }
  return {
    serviceId: requiredString(record.serviceId, `calendarExceptions[${index}].serviceId`),
    date: requiredDate(record.date, `calendarExceptions[${index}].date`),
    type: record.type,
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

  if (record.formatVersion !== 2) {
    throw new NetworkDataError('dataset.formatVersion must be 2.');
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
  const trips = requiredArray(record.trips, 'dataset.trips').map(parseTrip);
  const calendars = requiredArray(record.calendars, 'dataset.calendars').map(parseCalendar);
  const calendarExceptions = requiredArray(record.calendarExceptions, 'dataset.calendarExceptions').map(
    parseCalendarException,
  );
  const coverageRecord = requiredRecord(record.coverage, 'dataset.coverage');
  const coverage = {
    startDate: requiredDate(coverageRecord.startDate, 'dataset.coverage.startDate'),
    endDate: requiredDate(coverageRecord.endDate, 'dataset.coverage.endDate'),
  };
  if (coverage.startDate > coverage.endDate) {
    throw new NetworkDataError('dataset.coverage has reversed dates.');
  }

  if (
    agencies.length === 0 ||
    routes.length === 0 ||
    stops.length === 0 ||
    patterns.length === 0 ||
    trips.length === 0 ||
    calendars.length === 0
  ) {
    throw new NetworkDataError('dataset must contain agencies, routes, stops, patterns, trips, and calendars.');
  }

  // Build lookup sets once; the following loops validate every cross-reference in the snapshot.
  const agencyIds = uniqueIds(agencies, 'dataset.agencies');
  const routeIds = uniqueIds(routes, 'dataset.routes');
  const stopIds = uniqueIds(stops, 'dataset.stops');
  const tripIds = uniqueIds(trips, 'dataset.trips');
  const serviceIds = new Set(calendars.map((calendar) => calendar.serviceId));
  if (tripIds.size !== trips.length || serviceIds.size !== calendars.length) {
    throw new NetworkDataError('dataset contains duplicate trips or calendars.');
  }
  const placeIds = new Set(places.map((place) => place.id));
  if (
    calendars.some((calendar) => calendar.startDate < coverage.startDate || calendar.endDate > coverage.endDate) ||
    calendarExceptions.some(
      (exception) => exception.type === 1 && (exception.date < coverage.startDate || exception.date > coverage.endDate),
    )
  ) {
    throw new NetworkDataError('dataset.coverage does not include its service dates.');
  }

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
    if (stop.placeId !== null && !placeIds.has(stop.placeId)) {
      throw new NetworkDataError(`stop ${stop.id} references an unknown place.`);
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

  for (const trip of trips) {
    if (
      !routeIds.has(trip.routeId) ||
      !serviceIds.has(trip.serviceId) ||
      trip.stopTimes.some((time) => !stopIds.has(time.stopId))
    ) {
      throw new NetworkDataError(`trip ${trip.id} references an unknown route, service, or stop.`);
    }
  }
  const exceptionKeys = new Set<string>();
  for (const exception of calendarExceptions) {
    const key = `${exception.serviceId}:${exception.date}`;
    if (!serviceIds.has(exception.serviceId) || exceptionKeys.has(key)) {
      throw new NetworkDataError(`calendar exception ${key} is invalid or duplicated.`);
    }
    exceptionKeys.add(key);
  }

  return {
    formatVersion: 2,
    source,
    agencies,
    routes,
    stops,
    patterns,
    trips,
    calendars,
    calendarExceptions,
    coverage,
  };
}
