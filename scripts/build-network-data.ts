import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { parseNetworkDataset, type NetworkDataset } from '../src/data/network-schema.ts';

const sourceUrl = 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip';
const bahiaAgencyId = 'CMTBC';
const bahiaAgencyName = 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz';
const defaultInputPath = resolve('data/source/ctan-gtfs.zip');
const outputPath = resolve('public/data/bahia-cadiz-network.json');

type CsvRow = Record<string, string>;

interface InputTables {
  agency: readonly CsvRow[];
  routes: readonly CsvRow[];
  stops: readonly CsvRow[];
  trips: readonly CsvRow[];
  stopTimes: readonly CsvRow[];
}

interface SelectedTrip {
  id: string;
  routeId: string;
  directionId: string | null;
}

interface OrderedStopTime {
  stopId: string;
  sequence: number;
}

function fail(message: string): never {
  throw new Error(`GTFS data error: ${message}`);
}

function requiredValue(row: CsvRow, column: string, table: string): string {
  const value = row[column]?.trim();
  if (value === undefined || value === '') {
    fail(`${table}.${column} is required.`);
  }

  return value;
}

function optionalValue(row: CsvRow, column: string): string | null {
  const value = row[column]?.trim();
  return value === undefined || value === '' ? null : value;
}

function requiredInteger(row: CsvRow, column: string, table: string): number {
  const value = Number(requiredValue(row, column, table));
  if (!Number.isInteger(value)) {
    fail(`${table}.${column} must be an integer.`);
  }

  return value;
}

function requiredCoordinate(row: CsvRow, column: string): number {
  const value = Number(requiredValue(row, column, 'stops'));
  if (!Number.isFinite(value)) {
    fail(`stops.${column} must be a finite number.`);
  }

  return value;
}

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

function compareText(first: string, second: string): number {
  return first.localeCompare(second, 'en');
}

/** Parse GTFS CSV, including CTAN stop names that contain unescaped quotation marks. */
export function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let sawContent = false;

  const addField = () => {
    row.push(field);
    field = '';
  };

  const addRow = () => {
    addField();
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
    row = [];
    sawContent = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (
          text[index + 1] === undefined ||
          text[index + 1] === ',' ||
          text[index + 1] === '\r' ||
          text[index + 1] === '\n'
        ) {
          quoted = false;
        } else {
          // CTAN currently has labels such as `"Oasis " Viveros " (V)"`.
          // Treat an interior quote as display text until a field boundary closes the value.
          field += '"';
        }
      } else if (character === '\r' && text[index + 1] === '\n') {
        field += '\n';
        index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field !== '') {
        fail(`unexpected quote in CSV field near character ${index}.`);
      }
      quoted = true;
      sawContent = true;
    } else if (character === ',') {
      addField();
      sawContent = true;
    } else if (character === '\n') {
      addRow();
    } else if (character === '\r') {
      if (text[index + 1] !== '\n') {
        addRow();
      }
    } else {
      field += character;
      sawContent = true;
    }
  }

  if (quoted) {
    fail('unterminated quoted CSV field.');
  }
  if (sawContent || field !== '' || row.length > 0) {
    addRow();
  }

  const [header, ...values] = rows;
  if (header === undefined || header.length === 0) {
    fail('CSV table has no header.');
  }

  const columns = header.map((column) => column.replace(/^\uFEFF/, '').trim());
  if (new Set(columns).size !== columns.length || columns.some((column) => column === '')) {
    fail('CSV header contains duplicate or empty columns.');
  }

  return values.map((valuesRow, rowIndex) => {
    if (valuesRow.length !== columns.length) {
      fail(`CSV row ${rowIndex + 2} has ${valuesRow.length} fields; expected ${columns.length}.`);
    }

    return Object.fromEntries(
      columns.map((column, columnIndex) => [column, valuesRow[columnIndex] ?? '']),
    );
  });
}

function unsigned16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

function unsigned32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const earliestOffset = Math.max(0, bytes.length - 65_557);

  for (let offset = bytes.length - 22; offset >= earliestOffset; offset -= 1) {
    if (unsigned32(bytes, offset) === 0x06054b50) {
      return offset;
    }
  }

  fail('ZIP archive has no end-of-central-directory record.');
}

/** Read stored and deflated UTF-8 files from the flat GTFS ZIP archive. */
export function readZipTextFiles(bytes: Uint8Array): Map<string, string> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = unsigned16(bytes, endOffset + 10);
  let offset = unsigned32(bytes, endOffset + 16);
  const files = new Map<string, string>();

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (unsigned32(bytes, offset) !== 0x02014b50) {
      fail('ZIP archive has an invalid central-directory record.');
    }

    const compression = unsigned16(bytes, offset + 10);
    const compressedSize = unsigned32(bytes, offset + 20);
    const uncompressedSize = unsigned32(bytes, offset + 24);
    const filenameLength = unsigned16(bytes, offset + 28);
    const extraLength = unsigned16(bytes, offset + 30);
    const commentLength = unsigned16(bytes, offset + 32);
    const localOffset = unsigned32(bytes, offset + 42);
    const nameStart = offset + 46;
    const filename = decoder.decode(bytes.subarray(nameStart, nameStart + filenameLength));

    if (unsigned32(bytes, localOffset) !== 0x04034b50) {
      fail(`ZIP entry ${filename} has an invalid local-file record.`);
    }

    const localFilenameLength = unsigned16(bytes, localOffset + 26);
    const localExtraLength = unsigned16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localFilenameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    const contents =
      compression === 0
        ? compressed
        : compression === 8
          ? inflateRawSync(compressed)
          : fail(`ZIP entry ${filename} uses unsupported compression method ${compression}.`);

    if (contents.byteLength !== uncompressedSize) {
      fail(`ZIP entry ${filename} has an unexpected uncompressed size.`);
    }
    if (files.has(filename)) {
      fail(`ZIP archive contains duplicate entry ${filename}.`);
    }

    files.set(filename, decoder.decode(contents));
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return files;
}

function table(files: ReadonlyMap<string, string>, filename: string): CsvRow[] {
  const contents = files.get(filename);
  if (contents === undefined) {
    fail(`archive does not contain ${filename}.`);
  }

  try {
    return parseCsv(contents);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${filename}: ${message}`, { cause: error });
  }
}

/** Build the deliberately limited, app-facing Bahía network topology from parsed GTFS tables. */
export function createNetworkDataset(tables: InputTables, archiveSha256: string): NetworkDataset {
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
    const id = requiredValue(row, 'stop_id', 'stops');
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

    const parentStationId = optionalValue(stop, 'parent_station');
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

function parseArguments(arguments_: readonly string[]): { inputPath: string; download: boolean } {
  let download = false;
  let inputPath = defaultInputPath;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--download') {
      download = true;
    } else if (argument === '--input') {
      const input = arguments_[index + 1];
      if (input === undefined) {
        fail('--input requires a path.');
      }
      inputPath = resolve(input);
      index += 1;
    } else {
      fail(`unknown argument ${argument}.`);
    }
  }

  return { inputPath, download };
}

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

/** Generate and write the checked-in local network snapshot. */
export async function buildNetworkData(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const { inputPath, download } = parseArguments(arguments_);
  const archive = download ? await downloadArchive(inputPath) : await readFile(inputPath);
  const files = readZipTextFiles(archive);
  const tables: InputTables = {
    agency: table(files, 'agency.txt'),
    routes: table(files, 'routes.txt'),
    stops: table(files, 'stops.txt'),
    trips: table(files, 'trips.txt'),
    stopTimes: table(files, 'stop_times.txt'),
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
