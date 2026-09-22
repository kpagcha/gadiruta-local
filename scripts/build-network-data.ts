import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
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

/**
 * Build the deliberately limited, app-facing Bahía network topology from parsed GTFS tables.
 *
 * This boundary intentionally excludes schedules, calendars, shapes, and every other GTFS table
 * until a user-facing feature requires them. It also checks references before emitting a snapshot
 * so the browser never receives a topology that cannot be queried reliably.
 */
export function createNetworkDataset(tables: InputTables, archiveSha256: string): NetworkDataset {
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
    .map(
      (row) =>
        ({
          id: requiredValue(row, 'trip_id', 'trips'),
          routeId: requiredValue(row, 'route_id', 'trips'),
          directionId: optionalValue(row, 'direction_id'),
        }) satisfies SelectedTrip,
    );
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
    });
    stopTimesByTrip.set(tripId, stopTimes);
  }

  // Different trips with the same route, direction, and stops become one reusable route pattern.
  const patternsByKey = new Map<string, NetworkDataset['patterns'][number]>();
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

      return {
        id: stopId,
        name: requiredValue(stop, 'stop_name', 'stops'),
        latitude: requiredCoordinate(stop, 'stop_lat'),
        longitude: requiredCoordinate(stop, 'stop_lon'),
        parentStationId: optionalValue(stop, 'parent_station'),
      };
    })
    .sort((first, second) => compareText(first.id, second.id));

  const patterns = [...patternsByKey.values()].sort((first, second) => {
    const firstKey = [first.routeId, first.directionId ?? '', ...first.stopIds].join('\u001f');
    const secondKey = [second.routeId, second.directionId ?? '', ...second.stopIds].join('\u001f');
    return compareText(firstKey, secondKey);
  });

  // Validate the generated shape through the same boundary the browser uses before returning it.
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
export async function buildNetworkData(arguments_: readonly string[] = process.argv.slice(2)): Promise<void> {
  // Normal runs read an existing local input; only the explicit flag authorizes a network download.
  const { inputPath, download } = parseArguments(arguments_);
  const archive = download ? await downloadArchive(inputPath) : await readFile(inputPath);

  // Extract just the five GTFS tables needed for the current topology-only browser snapshot.
  const files = await readZipTextFiles(archive);
  const tables: InputTables = {
    agency: readGtfsTable(files, 'agency.txt'),
    routes: readGtfsTable(files, 'routes.txt'),
    stops: readGtfsTable(files, 'stops.txt'),
    trips: readGtfsTable(files, 'trips.txt'),
    stopTimes: readGtfsTable(files, 'stop_times.txt'),
  };

  // Record input provenance, then build and validate the reduced app-facing dataset.
  const archiveSha256 = createHash('sha256').update(archive).digest('hex');
  const dataset = createNetworkDataset(tables, archiveSha256);

  // Only this reviewed JSON file becomes browser-visible; the downloaded ZIP remains ignored source data.
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  const inputStats = await stat(inputPath);
  console.log(
    `Built ${outputPath} from ${inputPath} (${inputStats.size} bytes): ${dataset.routes.length} routes, ${dataset.stops.length} stops, ${dataset.patterns.length} patterns.`,
  );
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  // Permit importing this module in tests without also executing the command-line workflow.
  void buildNetworkData().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
