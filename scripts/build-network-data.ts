import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { parseNetworkDataset, type NetworkDataset } from '../src/data/network-schema.ts';
import { readGtfsTable, readZipTextFiles, type CsvRow } from './gtfs-archive.ts';

/** The verified upstream archive; this is used only by the explicit refresh command. */
const sourceUrl = 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip';

/** CTAN's stable identifier for the agency represented by this local snapshot. */
const bahiaAgencyId = 'CMTBC';

/** A name check prevents a reused upstream identifier from silently expanding this app's scope. */
const bahiaAgencyName = 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz';

/** The ignored archive location used by the normal, offline data command. */
const defaultInputPath = resolve('data/source/ctan-gtfs.zip');

/** The reviewed static asset consumed by the browser. */
const outputPath = resolve('public/data/bahia-cadiz-network.json');

/** GTFS tables needed for the current topology-only snapshot. */
interface InputTables {
  agency: readonly CsvRow[];
  routes: readonly CsvRow[];
  stops: readonly CsvRow[];
  trips: readonly CsvRow[];
  stopTimes: readonly CsvRow[];
}

/** A Bay trip reduced to the fields needed to derive its stop pattern. */
interface SelectedTrip {
  id: string;
  routeId: string;
  directionId: string | null;
}

/** A stop occurrence whose sequence defines its position within one trip. */
interface OrderedStopTime {
  stopId: string;
  sequence: number;
}

/** Stop generation with a consistent, actionable description of an invalid upstream assumption. */
function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

/** Normalize a non-blank GTFS field while retaining the processor's established error wording. */
const requiredGtfsText = z
  .string({ error: 'is required.' })
  .trim()
  .min(1, { error: 'is required.' });

/** Normalize absent and blank optional GTFS fields to the nulls used by the snapshot contract. */
const optionalGtfsText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .optional()
  .transform((value) => value ?? null);

/** Parse the number formats the processor already accepted for GTFS integer fields. */
const requiredGtfsInteger = requiredGtfsText
  .transform(Number)
  .refine(Number.isInteger, { error: 'must be an integer.' });

/** Parse a finite coordinate before it reaches the app-facing data contract. */
const requiredGtfsCoordinate = requiredGtfsText
  .transform(Number)
  .refine(Number.isFinite, { error: 'must be a finite number.' });

/** Schema for the consumed agency fields; other GTFS columns intentionally remain out of scope. */
const agencyRowSchema = z.object({
  agency_id: optionalGtfsText,
  agency_name: requiredGtfsText,
});

/** Schema for the consumed route fields; the processor does not interpret other route metadata. */
const routeRowSchema = z.object({
  agency_id: optionalGtfsText,
  route_id: requiredGtfsText,
  route_short_name: optionalGtfsText,
  route_long_name: optionalGtfsText,
  route_type: requiredGtfsInteger,
  route_color: optionalGtfsText,
  route_text_color: optionalGtfsText,
});

/** Schema for the route relationship and identifiers needed to form a selected trip. */
const tripRowSchema = z.object({
  route_id: requiredGtfsText,
  trip_id: requiredGtfsText,
  direction_id: optionalGtfsText,
});

/** Schema for the stop-time relationship and order used to form a trip pattern. */
const stopTimeRowSchema = z.object({
  trip_id: requiredGtfsText,
  stop_id: requiredGtfsText,
  stop_sequence: requiredGtfsInteger,
});

/** Schema for the physical-stop fields exposed in the local topology snapshot. */
const stopRowSchema = z.object({
  stop_id: requiredGtfsText,
  stop_name: requiredGtfsText,
  stop_lat: requiredGtfsCoordinate,
  stop_lon: requiredGtfsCoordinate,
  parent_station: optionalGtfsText,
});

/** Parse the narrow field subset needed to select an agency without validating unrelated rows. */
const agencyIdSchema = agencyRowSchema.pick({ agency_id: true });

/** Parse the narrow field subset needed to select a route without validating unrelated rows. */
const routeAgencyIdSchema = routeRowSchema.pick({ agency_id: true });

/** Parse the optional route relationship needed to select a trip without validating unrelated rows. */
const tripRouteIdSchema = z.object({ route_id: optionalGtfsText });

/** Parse the optional trip relationship needed to select stop times without validating unrelated rows. */
const stopTimeTripIdSchema = z.object({ trip_id: optionalGtfsText });

/** Parse IDs for duplicate checks before the processor dereferences selected stops. */
const stopIdSchema = stopRowSchema.pick({ stop_id: true });

/** Parse parent-station references before the processor expands selected physical stops. */
const stopParentStationSchema = stopRowSchema.pick({ parent_station: true });

/** Validate a consumed GTFS row and retain the established table-and-column error context. */
function parseGtfsRow<T>(row: CsvRow, table: string, schema: z.ZodType<T>): T {
  const result = schema.safeParse(row);
  if (result.success) {
    return result.data;
  }

  const issue = result.error.issues[0];
  if (issue === undefined) {
    fail(`${table} row is invalid.`);
  }

  const column = issue.path.map(String).join('.');
  fail(`${table}.${column} ${issue.message}`);
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

/**
 * Build the deliberately limited, app-facing Bahía network topology from parsed GTFS tables.
 *
 * This boundary intentionally excludes schedules, calendars, shapes, and every other GTFS table
 * until a user-facing feature requires them. It also checks references before emitting a snapshot
 * so the browser never receives a topology that cannot be queried reliably.
 */
export function createNetworkDataset(tables: InputTables, archiveSha256: string): NetworkDataset {
  const agency = tables.agency.find(
    (row) => parseGtfsRow(row, 'agency', agencyIdSchema).agency_id === bahiaAgencyId,
  );
  if (agency === undefined) {
    fail(`agency ${bahiaAgencyId} is not present.`);
  }
  if (parseGtfsRow(agency, 'agency', agencyRowSchema).agency_name !== bahiaAgencyName) {
    fail(`agency ${bahiaAgencyId} no longer identifies Bahía de Cádiz.`);
  }

  const agencies = [
    {
      id: bahiaAgencyId,
      name: bahiaAgencyName,
    },
  ];
  const routes = tables.routes
    .filter((row) => parseGtfsRow(row, 'routes', routeAgencyIdSchema).agency_id === bahiaAgencyId)
    .map((row) => {
      const route = parseGtfsRow(row, 'routes', routeRowSchema);
      return {
        id: route.route_id,
        agencyId: bahiaAgencyId,
        shortName: route.route_short_name,
        longName: route.route_long_name,
        type: route.route_type,
        color: route.route_color,
        textColor: route.route_text_color,
      };
    })
    .sort((first, second) => compareText(first.id, second.id));
  const routeById = uniqueById(routes, 'routes');
  if (routes.length === 0) {
    fail(`agency ${bahiaAgencyId} has no routes.`);
  }

  const trips = tables.trips
    .filter((row) => {
      const { route_id: routeId } = parseGtfsRow(row, 'trips', tripRouteIdSchema);
      return routeId !== null && routeById.has(routeId);
    })
    .map((row) => {
      const trip = parseGtfsRow(row, 'trips', tripRowSchema);
      return {
        id: trip.trip_id,
        routeId: trip.route_id,
        directionId: trip.direction_id,
      } satisfies SelectedTrip;
    });
  const tripById = uniqueById(trips, 'trips');
  if (trips.length === 0) {
    fail('Bahía routes have no trips.');
  }

  const stopTimesByTrip = new Map<string, OrderedStopTime[]>();
  for (const row of tables.stopTimes) {
    const { trip_id: tripId } = parseGtfsRow(row, 'stop_times', stopTimeTripIdSchema);
    if (tripId === null || !tripById.has(tripId)) {
      continue;
    }

    const stopTime = parseGtfsRow(row, 'stop_times', stopTimeRowSchema);
    const stopTimes = stopTimesByTrip.get(tripId) ?? [];
    stopTimes.push({
      stopId: stopTime.stop_id,
      sequence: stopTime.stop_sequence,
    });
    stopTimesByTrip.set(tripId, stopTimes);
  }

  const patternsByKey = new Map<string, NetworkDataset['patterns'][number]>();
  const referencedStopIds = new Set<string>();
  for (const trip of trips) {
    const stopTimes = stopTimesByTrip.get(trip.id);
    if (stopTimes === undefined || stopTimes.length === 0) {
      fail(`trip ${trip.id} has no stop times.`);
    }

    stopTimes.sort((first, second) => first.sequence - second.sequence);
    for (let index = 1; index < stopTimes.length; index += 1) {
      if (stopTimes[index - 1]?.sequence === stopTimes[index]?.sequence) {
        fail(`trip ${trip.id} repeats a stop sequence.`);
      }
    }

    const stopIds = stopTimes.map((stopTime) => stopTime.stopId);
    stopIds.forEach((stopId) => referencedStopIds.add(stopId));
    const key = [trip.routeId, trip.directionId ?? '', ...stopIds].join('\u001f');
    patternsByKey.set(key, {
      routeId: trip.routeId,
      directionId: trip.directionId,
      stopIds,
    });
  }

  const stopById = new Map<string, CsvRow>();
  for (const row of tables.stops) {
    const { stop_id: id } = parseGtfsRow(row, 'stops', stopIdSchema);
    if (stopById.has(id)) {
      fail(`stops contains duplicate ID ${id}.`);
    }
    stopById.set(id, row);
  }

  const selectedStopIds = new Set(referencedStopIds);
  for (const stopId of referencedStopIds) {
    const stop = stopById.get(stopId);
    if (stop === undefined) {
      fail(`selected trip references missing stop ${stopId}.`);
    }

    const { parent_station: parentStationId } = parseGtfsRow(
      stop,
      'stops',
      stopParentStationSchema,
    );
    if (parentStationId !== null) {
      selectedStopIds.add(parentStationId);
    }
  }

  const stops = [...selectedStopIds]
    .map((stopId) => {
      const stop = stopById.get(stopId);
      if (stop === undefined) {
        fail(`stop ${stopId} references a missing parent station.`);
      }

      const selectedStop = parseGtfsRow(stop, 'stops', stopRowSchema);
      return {
        id: stopId,
        name: selectedStop.stop_name,
        latitude: selectedStop.stop_lat,
        longitude: selectedStop.stop_lon,
        parentStationId: selectedStop.parent_station,
      };
    })
    .sort((first, second) => compareText(first.id, second.id));

  const patterns = [...patternsByKey.values()].sort((first, second) => {
    const firstKey = [first.routeId, first.directionId ?? '', ...first.stopIds].join('\u001f');
    const secondKey = [second.routeId, second.directionId ?? '', ...second.stopIds].join('\u001f');
    return compareText(firstKey, secondKey);
  });

  return parseNetworkDataset({
    formatVersion: 1,
    source: {
      url: sourceUrl,
      generatedAt: new Date().toISOString(),
      archiveSha256,
    },
    agencies,
    routes,
    stops,
    patterns,
  });
}

/** Parse the deliberately small command interface with Node's strict built-in argument parser. */
function parseArguments(arguments_: readonly string[]): { inputPath: string; download: boolean } {
  try {
    const { values } = parseArgs({
      args: [...arguments_],
      options: {
        download: { type: 'boolean' },
        input: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    return {
      inputPath: values.input === undefined ? defaultInputPath : resolve(values.input),
      download: values.download ?? false,
    };
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

/** Download the archive only for the explicit refresh command and retain it as reviewable input. */
async function downloadArchive(inputPath: string): Promise<Uint8Array> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Could not download CTAN GTFS (${response.status}).`);
  }

  const archive = new Uint8Array(await response.arrayBuffer());
  await mkdir(resolve(inputPath, '..'), { recursive: true });
  await writeFile(inputPath, archive);
  return archive;
}

/**
 * Generate the checked-in local network snapshot from a local archive or explicit download.
 *
 * Normal development reads an already-downloaded file, so application startup and tests never
 * depend on CTAN availability.
 */
export async function buildNetworkData(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const { inputPath, download } = parseArguments(arguments_);
  const archive = download ? await downloadArchive(inputPath) : await readFile(inputPath);
  const files = readZipTextFiles(archive);
  const tables: InputTables = {
    agency: readGtfsTable(files, 'agency.txt'),
    routes: readGtfsTable(files, 'routes.txt'),
    stops: readGtfsTable(files, 'stops.txt'),
    trips: readGtfsTable(files, 'trips.txt'),
    stopTimes: readGtfsTable(files, 'stop_times.txt'),
  };
  const archiveSha256 = createHash('sha256').update(archive).digest('hex');
  const dataset = createNetworkDataset(tables, archiveSha256);

  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  const inputStats = await stat(inputPath);
  console.log(
    `Built ${outputPath} from ${inputPath} (${inputStats.size} bytes): ${dataset.routes.length} routes, ${dataset.stops.length} stops, ${dataset.patterns.length} patterns.`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  void buildNetworkData().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
