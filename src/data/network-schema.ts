/**
 * Defines the JSON contract shared by the static-data builder and browser loader.
 * Shapes are parsed once at those boundaries; explicit checks then verify transit relationships.
 * TypeScript types come from the same schemas, so field definitions cannot drift apart.
 */
import { z } from 'zod';
import { isCalendarDate, shiftCalendarDate } from './calendar-date.ts';
import { places } from './places.ts';
import { stopUrlToken } from './stop-url.ts';

const name = z.string().refine((value) => value.trim() !== '', 'must be a non-empty string');
const date = z.string().refine(isCalendarDate, 'must be a valid YYYY-MM-DD date');
const minute = z.number().int().min(0).max(143999);
const permission = z.number().refine((value) => [0, 1, 2, 3].includes(value), 'invalid pickup or drop-off value');

/** Decimal coordinates used by stops and reviewed area reference points. */
export const coordinateSchema = z.object({
  latitude: z.number().min(-90, 'invalid reference coordinates').max(90, 'invalid reference coordinates'),
  longitude: z.number().min(-180, 'invalid reference coordinates').max(180, 'invalid reference coordinates'),
});
/** A reviewed municipality, reused when reading the builder's location input. */
export const municipalitySchema = z.object({ id: name, name });
const localAreaSchema = municipalitySchema.extend({
  municipalityId: name,
  referencePoint: coordinateSchema.nullable(),
});
const stopSchema = coordinateSchema.extend({
  id: name,
  name,
  parentStationId: name.nullable(),
  placeId: name.nullable(),
  municipalityId: name.nullable(),
  localAreaId: name.nullable(),
});
const stopTimeSchema = z
  .object({
    stopId: name,
    arrivalMinutes: minute,
    departureMinutes: minute,
    pickupType: permission,
    dropOffType: permission,
  })
  .refine((time) => time.arrivalMinutes <= time.departureMinutes, 'invalid arrival or departure values');
const tripSchema = z.object({
  id: name,
  routeId: name,
  serviceId: name,
  stopTimes: z
    .array(stopTimeSchema)
    .min(2)
    .refine(
      (times) => times.every((time, index) => index === 0 || time.arrivalMinutes >= times[index - 1]!.departureMinutes),
      'stopTimes must be ordered',
    ),
});
const calendarSchema = z
  .object({
    serviceId: name,
    startDate: date,
    endDate: date,
    weekdays: z.array(z.boolean()).length(7),
  })
  .refine((calendar) => calendar.startDate <= calendar.endDate, 'invalid calendar dates');
const datasetSchema = z.object({
  formatVersion: z.literal(5, { error: 'formatVersion must be 5' }),
  source: z.object({
    url: name,
    generatedAt: name.refine((value) => !Number.isNaN(Date.parse(value)), 'invalid generation date-time'),
    archiveSha256: z.string().regex(/^[a-f0-9]{64}$/, 'must be a lowercase SHA-256 hash'),
  }),
  agencies: z.array(z.object({ id: name, name })).min(1),
  routes: z
    .array(
      z.object({
        id: name,
        agencyId: name,
        shortName: name.nullable(),
        longName: name.nullable(),
        type: z.number(),
        color: name.nullable(),
        textColor: name.nullable(),
      }),
    )
    .min(1),
  municipalities: z.array(municipalitySchema),
  localAreas: z.array(localAreaSchema),
  stops: z.array(stopSchema).min(1),
  patterns: z
    .array(
      z.object({
        routeId: name,
        directionId: name.nullable(),
        stopIds: z.array(name).min(1),
      }),
    )
    .min(1),
  trips: z.array(tripSchema).min(1),
  calendars: z.array(calendarSchema).min(1),
  calendarExceptions: z.array(z.object({ serviceId: name, date, type: z.literal([1, 2]) })),
  coverage: z
    .object({ startDate: date, endDate: date })
    .refine((coverage) => coverage.startDate <= coverage.endDate, 'coverage has reversed dates'),
});

/** Version-five application data after shape and relationship checks. */
export type NetworkDataset = z.infer<typeof datasetSchema>;
/** A route's official labels and transport mode. */
export type NetworkRoute = NetworkDataset['routes'][number];
/** A physical stop, including reviewed place membership. */
export type NetworkStop = z.infer<typeof stopSchema>;
/** One visit; minutes may extend into the following calendar day. */
export type NetworkStopTime = z.infer<typeof stopTimeSchema>;
/** Ordered visits belonging to one scheduled service. */
export type NetworkTrip = z.infer<typeof tripSchema>;

/** Identify rejected static assets independently of the schema library's error representation. */
export class NetworkDataError extends Error {
  /** Preserve a useful field or relationship diagnostic for tooling and loader callers. */
  constructor(message: string) {
    super(message);
    this.name = 'NetworkDataError';
  }
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

/** Parse an untrusted static asset and reject broken references before local queries use it. */
export function parseNetworkDataset(value: unknown): NetworkDataset {
  const parsed = datasetSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new NetworkDataError('dataset.' + issue.path.join('.') + ': ' + issue.message);
  }
  const dataset = parsed.data;
  const {
    agencies,
    routes,
    municipalities,
    localAreas,
    stops,
    patterns,
    trips,
    calendars,
    calendarExceptions,
    coverage,
  } = dataset;
  // Build lookup sets once; the following loops validate every cross-reference in the snapshot.
  const agencyIds = uniqueIds(agencies, 'dataset.agencies');
  const routeIds = uniqueIds(routes, 'dataset.routes');
  const municipalityIds = uniqueIds(municipalities, 'dataset.municipalities');
  uniqueIds(localAreas, 'dataset.localAreas');
  const localAreasById = new Map(localAreas.map((localArea) => [localArea.id, localArea]));
  const stopIds = uniqueIds(stops, 'dataset.stops');
  const stopUrlTokens = new Set<string>();
  for (const stop of stops) {
    const token = stopUrlToken(stop.id);
    if (stopUrlTokens.has(token)) {
      throw new NetworkDataError(`dataset.stops has a duplicate URL token: ${token}.`);
    }
    stopUrlTokens.add(token);
  }
  uniqueIds(trips, 'dataset.trips');
  const serviceIds = new Set(calendars.map((calendar) => calendar.serviceId));
  if (serviceIds.size !== calendars.length) {
    throw new NetworkDataError('dataset contains duplicate calendars.');
  }
  const placeIds = new Set(places.map((place) => place.id));
  // A service dated yesterday can still board just after midnight on the first visible day.
  const earliestServiceDate = shiftCalendarDate(coverage.startDate, -1);
  if (
    calendars.some((calendar) => calendar.startDate < earliestServiceDate || calendar.endDate > coverage.endDate) ||
    calendarExceptions.some(
      (exception) =>
        exception.type === 1 && (exception.date < earliestServiceDate || exception.date > coverage.endDate),
    )
  ) {
    throw new NetworkDataError('dataset.coverage does not include its service dates.');
  }

  for (const route of routes) {
    if (!agencyIds.has(route.agencyId)) {
      throw new NetworkDataError(`route ${route.id} references an unknown agency.`);
    }
  }

  for (const localArea of localAreas) {
    if (!municipalityIds.has(localArea.municipalityId)) {
      throw new NetworkDataError(`local area ${localArea.id} references an unknown municipality.`);
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
    if (stop.municipalityId !== null && !municipalityIds.has(stop.municipalityId)) {
      throw new NetworkDataError(`stop ${stop.id} references an unknown municipality.`);
    }
    if (stop.localAreaId !== null && localAreasById.get(stop.localAreaId)?.municipalityId !== stop.municipalityId) {
      throw new NetworkDataError(`stop ${stop.id} references a local area outside its municipality.`);
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

  return dataset;
}
