/**
 * Reads the downloaded CTAN bus data and writes the reviewed JSON for local Bay journey search.
 *
 * This script runs when a developer builds or refreshes the local data. It does not run in the
 * browser. The generated JSON is saved at `public/data/bahia-cadiz-network.json`.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { isCalendarDate } from '../../src/data/calendar-date.ts';
import { z } from 'zod';
import { readGtfsTables } from './archive.ts';
import { createNetworkDataset, sourceUrl, type SnapshotDateRange } from './convert.ts';
import { locationDirectorySchema } from './location-directory.ts';

const defaultInputPath = resolve('data/source/ctan/gtfs.zip');
const outputPath = resolve('public/data/bahia-cadiz-network.json');
const placeAssignmentsPath = resolve('data/reviewed/ctan/place-stop-assignments.json');
const locationDirectoryPath = resolve('data/reviewed/ctan/location-directory.json');

/** Stop before doing IO when command options contradict the supported build workflow. */
function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

/** Resolve the current calendar year in Cádiz even when the build host uses another time zone. */
function madridYear(now: Date): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Madrid' }).format(now));
}

/** Parse the optional date range and the deliberately small archive command interface. */
function parseArguments(arguments_: readonly string[]): {
  inputPath: string;
  download: boolean;
  dateRange?: SnapshotDateRange;
} {
  let values: {
    download?: boolean;
    input?: string;
    'start-date'?: string;
    'end-date'?: string;
    'current-and-next-year'?: boolean;
  };
  try {
    values = parseArgs({
      args: [...arguments_],
      options: {
        download: { type: 'boolean' },
        input: { type: 'string' },
        'start-date': { type: 'string' },
        'end-date': { type: 'string' },
        'current-and-next-year': { type: 'boolean' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const startDate = values['start-date'];
  const endDate = values['end-date'];
  const rolling = values['current-and-next-year'] ?? false;
  if (rolling && (startDate !== undefined || endDate !== undefined)) {
    fail('use either --current-and-next-year or explicit --start-date and --end-date.');
  }
  if ((startDate === undefined) !== (endDate === undefined)) {
    fail('--start-date and --end-date must be provided together.');
  }
  if (
    startDate !== undefined &&
    endDate !== undefined &&
    (!isCalendarDate(startDate) || !isCalendarDate(endDate) || startDate > endDate)
  ) {
    fail('--start-date and --end-date must be ordered YYYY-MM-DD dates.');
  }
  const year = madridYear(new Date());
  const dateRange = rolling
    ? { startDate: `${year}-01-01`, endDate: `${year + 1}-12-31` }
    : startDate !== undefined && endDate !== undefined
      ? { startDate, endDate }
      : undefined;
  return {
    inputPath: values.input === undefined ? defaultInputPath : resolve(values.input),
    download: values.download ?? false,
    dateRange,
  };
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
  const { inputPath, download, dateRange } = parseArguments(arguments_);
  const archive = download ? await downloadArchive(inputPath) : await readFile(inputPath);

  // Extract the seven GTFS tables needed for the current direct-journey snapshot.
  const tables = await readGtfsTables(archive);

  // Record input provenance, then build and validate the reduced app-facing dataset.
  const archiveSha256 = createHash('sha256').update(archive).digest('hex');
  const placeAssignments = z
    .record(z.string().min(1), z.string().min(1))
    .parse(JSON.parse(await readFile(placeAssignmentsPath, 'utf8')));
  const locationDirectory = locationDirectorySchema.parse(JSON.parse(await readFile(locationDirectoryPath, 'utf8')));
  const dataset = createNetworkDataset(tables, archiveSha256, placeAssignments, dateRange, locationDirectory);

  // Only this reviewed JSON file becomes browser-visible; the downloaded ZIP remains ignored source data.
  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  const inputStats = await stat(inputPath);
  console.log(
    `Built ${outputPath} from ${inputPath} (${inputStats.size} bytes): ${dataset.routes.length} routes, ${dataset.stops.length} stops, ${dataset.patterns.length} patterns; coverage ${dataset.coverage.startDate} to ${dataset.coverage.endDate}.`,
  );
  if (dateRange !== undefined && dataset.coverage.endDate < dateRange.endDate) {
    console.warn(
      `CTAN's Cádiz service ends before the requested ${dateRange.endDate}; no later journeys were generated.`,
    );
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  // Permit importing this module in tests without also executing the command-line workflow.
  void buildNetworkData().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
