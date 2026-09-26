/**
 * Converts parsed GTFS tables into the Bahía application snapshot, including service-date clipping.
 * Runs only in data tooling. It has no file, CLI, or network side effects and validates the selected
 * source once before filtering its date range. The browser consumes its output, never GTFS rows.
 */
import { isCalendarDate, shiftCalendarDate } from '../../src/data/calendar-date.ts';
import { parseNetworkDataset, type NetworkDataset, type NetworkStopTime } from '../../src/data/network-schema.ts';
import { places } from '../../src/data/places.ts';
import type { LocationDirectory } from '../reviewed/location-directory.ts';
import type { CsvRow, GtfsTables } from './archive.ts';

/** Source used only by the explicit refresh command and snapshot provenance. */
export const sourceUrl = 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip';

const bahiaAgencyId = 'CMTBC';
const bahiaAgencyName = 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz';

/** A selected GTFS visit before stop_sequence has established its trip order. */
type OrderedStopTime = NetworkStopTime & { sequence: number };

/** Inclusive dates the generated browser snapshot is allowed to show. */
export type SnapshotDateRange = NetworkDataset['coverage'];

/** Read GTFS HH:MM:SS, including times later than 24:00 on the service's following day. */
function gtfsMinutes(value: string, label: string): number {
  const match = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value);
  if (match === null || match[3] !== '00') {
    fail(`${label} must be an HH:MM:00 GTFS time.`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Convert GTFS YYYYMMDD to the ISO calendar date used by the browser. */
function gtfsDate(value: string, label: string): string {
  if (!/^\d{8}$/.test(value)) {
    fail(`${label} must be a YYYYMMDD date.`);
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

/** GTFS uses zero for ordinary boarding/alighting and one for a prohibited action. */
function gtfsStopPermission(row: CsvRow, column: string): number {
  const value = optionalValue(row, column) ?? '0';
  if (!/^[0-3]$/.test(value)) {
    fail(`stop_times.${column} must be 0, 1, 2, or 3.`);
  }
  return Number(value);
}

/** Stop generation with a consistent, actionable description of an invalid upstream assumption. */
function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

/** Read a required GTFS value after trimming transport-feed whitespace at the boundary. */
function requiredValue(row: CsvRow, column: string, table: string): string {
  const value = row[column]?.trim();
  if (value === undefined || value === '') {
    fail(`${table}.${column} is required.`);
  }

  return value;
}

/** Convert an absent or blank optional GTFS field to the snapshot's explicit null value. */
function optionalValue(row: CsvRow, column: string): string | null {
  const value = row[column]?.trim();
  return value === undefined || value === '' ? null : value;
}

/** Parse a required integer without accepting a malformed GTFS identifier or sequence value. */
function requiredInteger(row: CsvRow, column: string, table: string): number {
  const value = Number(requiredValue(row, column, table));
  if (!Number.isInteger(value)) {
    fail(`${table}.${column} must be an integer.`);
  }

  return value;
}

/** Parse a finite stop coordinate before it reaches the app-facing data contract. */
function requiredCoordinate(row: CsvRow, column: string): number {
  const value = Number(requiredValue(row, column, 'stops'));
  if (!Number.isFinite(value)) {
    fail(`stops.${column} must be a finite number.`);
  }

  return value;
}

/** Index external IDs while rejecting ambiguity that would invalidate reference checks. */
function uniqueById<T extends { id: string }>(items: readonly T[], label: string): Map<string, T> {
  const result = new Map<string, T>();

  for (const item of items) {
    if (result.has(item.id)) {
      fail(`${label} contains duplicate ID ${item.id}.`);
    }
    result.set(item.id, item);
  }

  return result;
}

/** Keep generated JSON deterministic so meaningful source-data changes remain reviewable. */
function compareText(first: string, second: string): number {
  return first.localeCompare(second, 'en');
}

/** Keep only services usable in a requested window and the topology those services reference. */
function limitNetworkDataset(dataset: NetworkDataset, requested: SnapshotDateRange): NetworkDataset {
  if (
    !isCalendarDate(requested.startDate) ||
    !isCalendarDate(requested.endDate) ||
    requested.startDate > requested.endDate
  ) {
    fail('the requested date range must contain two ordered YYYY-MM-DD dates.');
  }

  const coverage = {
    startDate: requested.startDate > dataset.coverage.startDate ? requested.startDate : dataset.coverage.startDate,
    endDate: requested.endDate < dataset.coverage.endDate ? requested.endDate : dataset.coverage.endDate,
  };
  if (coverage.startDate > coverage.endDate) {
    fail(`requested dates ${requested.startDate} to ${requested.endDate} do not overlap the Cádiz feed.`);
  }

  // Yesterday's service may board after midnight on the first visible date.
  const serviceStart = shiftCalendarDate(coverage.startDate, -1);
  const overnightServiceIds = new Set(
    dataset.trips
      .filter((trip) => trip.stopTimes.some((time) => time.departureMinutes >= 1440))
      .map((trip) => trip.serviceId),
  );
  /** Only an overnight service needs its preceding day in the snapshot. */
  function firstServiceDate(serviceId: string): string {
    return overnightServiceIds.has(serviceId) ? serviceStart : coverage.startDate;
  }
  const additions = new Set(
    dataset.calendarExceptions
      .filter(
        (exception) =>
          exception.type === 1 &&
          exception.date >= firstServiceDate(exception.serviceId) &&
          exception.date <= coverage.endDate,
      )
      .map((exception) => exception.serviceId),
  );
  const calendars = dataset.calendars.flatMap((calendar) => {
    const firstDate = firstServiceDate(calendar.serviceId);
    const weeklyOverlap = calendar.endDate >= firstDate && calendar.startDate <= coverage.endDate;
    if (!weeklyOverlap && !additions.has(calendar.serviceId)) return [];
    const startDate = calendar.startDate > firstDate ? calendar.startDate : firstDate;
    const endDate = calendar.endDate < coverage.endDate ? calendar.endDate : coverage.endDate;
    return [
      {
        ...calendar,
        startDate: weeklyOverlap ? startDate : coverage.startDate,
        endDate: weeklyOverlap ? endDate : coverage.startDate,
        weekdays: weeklyOverlap ? calendar.weekdays : [false, false, false, false, false, false, false],
      },
    ];
  });
  const serviceIds = new Set(calendars.map((calendar) => calendar.serviceId));
  const calendarExceptions = dataset.calendarExceptions.filter(
    (exception) =>
      serviceIds.has(exception.serviceId) &&
      exception.date >= firstServiceDate(exception.serviceId) &&
      exception.date <= coverage.endDate,
  );
  const trips = dataset.trips.filter((trip) => serviceIds.has(trip.serviceId));
  if (
    trips.length === 0 ||
    (!calendars.some(
      (calendar) =>
        calendar.startDate <= coverage.endDate &&
        calendar.endDate >= coverage.startDate &&
        calendar.weekdays.some(Boolean),
    ) &&
      !calendarExceptions.some((exception) => exception.type === 1 && exception.date >= coverage.startDate))
  ) {
    fail(`requested dates ${requested.startDate} to ${requested.endDate} contain no Cádiz service.`);
  }

  // A range can remove entire services, so remove their unused route and stop records too.
  const routeIds = new Set(trips.map((trip) => trip.routeId));
  const patternKeys = new Set(
    trips.map((trip) => [trip.routeId, ...trip.stopTimes.map((time) => time.stopId)].join('\u001f')),
  );
  const patterns = dataset.patterns.filter((pattern) =>
    patternKeys.has([pattern.routeId, ...pattern.stopIds].join('\u001f')),
  );
  const stopIds = new Set(trips.flatMap((trip) => trip.stopTimes.map((time) => time.stopId)));
  for (const stop of dataset.stops) {
    if (stopIds.has(stop.id) && stop.parentStationId !== null) stopIds.add(stop.parentStationId);
  }

  return {
    ...dataset,
    routes: dataset.routes.filter((route) => routeIds.has(route.id)),
    stops: dataset.stops.filter((stop) => stopIds.has(stop.id)),
    patterns,
    trips,
    calendars,
    calendarExceptions,
    coverage,
  };
}

/**
 * Build the deliberately limited, app-facing Bahía network and timetable from parsed GTFS tables.
 *
 * This boundary excludes shapes, fares, and every other unused GTFS table. It checks references
 * before emitting a snapshot so the browser never receives a timetable it cannot query reliably.
 * An optional date range clips the source calendar without extending it beyond known service.
 */
export function createNetworkDataset(
  tables: GtfsTables,
  archiveSha256: string,
  placeAssignments: Record<string, string> = {},
  dateRange?: SnapshotDateRange,
  locationDirectory?: LocationDirectory,
): NetworkDataset {
  // First lock the snapshot to the one agency this application is allowed to represent.
  const agency = tables.agency.find((row) => optionalValue(row, 'agency_id') === bahiaAgencyId);
  if (agency === undefined) {
    fail(`agency ${bahiaAgencyId} is not present.`);
  }
  if (requiredValue(agency, 'agency_name', 'agency') !== bahiaAgencyName) {
    fail(`agency ${bahiaAgencyId} no longer identifies Bahía de Cádiz.`);
  }

  const agencies = [
    {
      id: bahiaAgencyId,
      name: bahiaAgencyName,
    },
  ];

  // Keep only that agency's routes and sort by stable source ID for a reviewable generated file.
  const routes = tables.routes
    .filter((row) => optionalValue(row, 'agency_id') === bahiaAgencyId)
    .map((row) => ({
      id: requiredValue(row, 'route_id', 'routes'),
      agencyId: bahiaAgencyId,
      shortName: optionalValue(row, 'route_short_name'),
      longName: optionalValue(row, 'route_long_name'),
      type: requiredInteger(row, 'route_type', 'routes'),
      color: optionalValue(row, 'route_color'),
      textColor: optionalValue(row, 'route_text_color'),
    }))
    .sort((first, second) => compareText(first.id, second.id));
  const routeById = uniqueById(routes, 'routes');
  if (routes.length === 0) {
    fail(`agency ${bahiaAgencyId} has no routes.`);
  }

  // Trips are the link between a route and its ordered `stop_times` rows.
  const trips = tables.trips
    .filter((row) => routeById.has(optionalValue(row, 'route_id') ?? ''))
    .map((row) => ({
      id: requiredValue(row, 'trip_id', 'trips'),
      routeId: requiredValue(row, 'route_id', 'trips'),
      directionId: optionalValue(row, 'direction_id'),
      serviceId: requiredValue(row, 'service_id', 'trips'),
    }));
  const tripById = uniqueById(trips, 'trips');
  if (trips.length === 0) {
    fail('Bahía routes have no trips.');
  }

  // Group the relevant stop times once so each trip can later build its ordered stop sequence.
  const stopTimesByTrip = new Map<string, OrderedStopTime[]>();
  for (const row of tables.stopTimes) {
    const tripId = optionalValue(row, 'trip_id');
    if (tripId === null || !tripById.has(tripId)) {
      continue;
    }

    const stopTimes = stopTimesByTrip.get(tripId) ?? [];
    stopTimes.push({
      stopId: requiredValue(row, 'stop_id', 'stop_times'),
      sequence: requiredInteger(row, 'stop_sequence', 'stop_times'),
      arrivalMinutes: gtfsMinutes(requiredValue(row, 'arrival_time', 'stop_times'), 'stop_times.arrival_time'),
      departureMinutes: gtfsMinutes(requiredValue(row, 'departure_time', 'stop_times'), 'stop_times.departure_time'),
      pickupType: gtfsStopPermission(row, 'pickup_type'),
      dropOffType: gtfsStopPermission(row, 'drop_off_type'),
    });
    stopTimesByTrip.set(tripId, stopTimes);
  }

  // Different trips with the same route, direction, and stops become one reusable route pattern.
  const patternsByKey = new Map<string, NetworkDataset['patterns'][number]>();
  const scheduledTrips: NetworkDataset['trips'] = [];
  const referencedStopIds = new Set<string>();
  for (const trip of trips) {
    const stopTimes = stopTimesByTrip.get(trip.id);
    if (stopTimes === undefined || stopTimes.length === 0) {
      fail(`trip ${trip.id} has no stop times.`);
    }

    // GTFS stores stop times as rows; their sequence field restores the route traversal order.
    stopTimes.sort((first, second) => first.sequence - second.sequence);
    for (let index = 1; index < stopTimes.length; index += 1) {
      if (stopTimes[index - 1]?.sequence === stopTimes[index]?.sequence) {
        fail(`trip ${trip.id} repeats a stop sequence.`);
      }
    }

    const stopIds = stopTimes.map((stopTime) => stopTime.stopId);
    scheduledTrips.push({
      id: trip.id,
      routeId: trip.routeId,
      serviceId: trip.serviceId,
      stopTimes: stopTimes.map(({ stopId, arrivalMinutes, departureMinutes, pickupType, dropOffType }) => ({
        stopId,
        arrivalMinutes,
        departureMinutes,
        pickupType,
        dropOffType,
      })),
    });
    stopIds.forEach((stopId) => referencedStopIds.add(stopId));
    const key = [trip.routeId, trip.directionId ?? '', ...stopIds].join('\u001f');
    patternsByKey.set(key, {
      routeId: trip.routeId,
      directionId: trip.directionId,
      stopIds,
    });
  }

  // Index all source stops before resolving the IDs referenced by selected trips.
  const stopById = new Map<string, CsvRow>();
  for (const row of tables.stops) {
    const id = requiredValue(row, 'stop_id', 'stops');
    if (stopById.has(id)) {
      fail(`stops contains duplicate ID ${id}.`);
    }
    stopById.set(id, row);
  }

  // Include a referenced stop's parent station too, so the local graph keeps that valid relationship.
  const selectedStopIds = new Set(referencedStopIds);
  for (const stopId of referencedStopIds) {
    const stop = stopById.get(stopId);
    if (stop === undefined) {
      fail(`selected trip references missing stop ${stopId}.`);
    }

    const parentStationId = optionalValue(stop, 'parent_station');
    if (parentStationId !== null) {
      selectedStopIds.add(parentStationId);
    }
  }

  // Convert only selected source rows into the small application-facing stop contract.
  const stops = [...selectedStopIds]
    .map((stopId) => {
      const stop = stopById.get(stopId);
      if (stop === undefined) {
        fail(`stop ${stopId} references a missing parent station.`);
      }

      const location = locationDirectory?.stopLocations[stopId];
      if (locationDirectory !== undefined && location === undefined) {
        fail(`stop ${stopId} has no reviewed CTAN location.`);
      }
      return {
        id: stopId,
        name: requiredValue(stop, 'stop_name', 'stops'),
        latitude: requiredCoordinate(stop, 'stop_lat'),
        longitude: requiredCoordinate(stop, 'stop_lon'),
        parentStationId: optionalValue(stop, 'parent_station'),
        placeId: placeAssignments[stopId] ?? null,
        municipalityId: location?.municipalityId ?? null,
        localAreaId: location?.localAreaId ?? null,
      };
    })
    .sort((first, second) => compareText(first.id, second.id));

  const patterns = [...patternsByKey.values()].sort((first, second) => {
    const firstKey = [first.routeId, first.directionId ?? '', ...first.stopIds].join('\u001f');
    const secondKey = [second.routeId, second.directionId ?? '', ...second.stopIds].join('\u001f');
    return compareText(firstKey, secondKey);
  });

  // Calendars and exceptions are selected through trip service IDs, never by geographic guesswork.
  const usedServiceIds = new Set(trips.map((trip) => trip.serviceId));
  const calendars = tables.calendar
    .filter((row) => usedServiceIds.has(optionalValue(row, 'service_id') ?? ''))
    .map((row) => ({
      serviceId: requiredValue(row, 'service_id', 'calendar'),
      startDate: gtfsDate(requiredValue(row, 'start_date', 'calendar'), 'calendar.start_date'),
      endDate: gtfsDate(requiredValue(row, 'end_date', 'calendar'), 'calendar.end_date'),
      weekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
        const value = requiredValue(row, day, 'calendar');
        if (value !== '0' && value !== '1') fail(`calendar.${day} must be 0 or 1.`);
        return value === '1';
      }),
    }))
    .sort((a, b) => compareText(a.serviceId, b.serviceId));
  const calendarExceptions = tables.calendarDates
    .filter((row) => usedServiceIds.has(optionalValue(row, 'service_id') ?? ''))
    .map((row) => {
      const type = requiredInteger(row, 'exception_type', 'calendar_dates');
      if (type !== 1 && type !== 2) fail('calendar_dates.exception_type must be 1 or 2.');
      return {
        serviceId: requiredValue(row, 'service_id', 'calendar_dates'),
        date: gtfsDate(requiredValue(row, 'date', 'calendar_dates'), 'calendar_dates.date'),
        type: type as 1 | 2,
      };
    })
    .sort((a, b) => compareText(`${a.serviceId}:${a.date}`, `${b.serviceId}:${b.date}`));
  if (calendars.length === 0) fail('selected trips have no service calendars.');
  const knownPlaceIds = new Set(places.map((place) => place.id));
  for (const [stopId, placeId] of Object.entries(placeAssignments)) {
    if (!selectedStopIds.has(stopId) || !knownPlaceIds.has(placeId))
      fail(`place assignment ${stopId} -> ${placeId} is invalid.`);
  }
  const activeDates = [
    ...calendars.flatMap((calendar) => [calendar.startDate, calendar.endDate]),
    ...calendarExceptions.filter((exception) => exception.type === 1).map((exception) => exception.date),
  ];
  const coverage = {
    startDate: activeDates.reduce((a, b) => (a < b ? a : b)),
    endDate: activeDates.reduce((a, b) => (a > b ? a : b)),
  };

  // Validate the generated shape through the same boundary the browser uses before returning it.
  const dataset = parseNetworkDataset({
    formatVersion: 5,
    source: {
      url: sourceUrl,
      generatedAt: new Date().toISOString(),
      archiveSha256,
    },
    agencies,
    routes,
    municipalities: locationDirectory?.municipalities ?? [],
    localAreas:
      locationDirectory?.localAreas.map((localArea) => {
        const representative = localArea.derivedCoordinates?.representativeStop;
        if (
          representative !== undefined &&
          locationDirectory.stopLocations[representative.stopId]?.localAreaId !== localArea.id
        ) {
          fail(`local area ${localArea.id} has a representative stop outside its own area.`);
        }
        return {
          id: localArea.id,
          municipalityId: localArea.municipalityId,
          name: localArea.name,
          referencePoint:
            representative === undefined
              ? null
              : { latitude: representative.latitude, longitude: representative.longitude },
        };
      }) ?? [],
    stops,
    patterns,
    trips: scheduledTrips.sort((a, b) => compareText(a.id, b.id)),
    calendars,
    calendarExceptions,
    coverage,
  });
  return dateRange === undefined ? dataset : limitNetworkDataset(dataset, dateRange);
}
