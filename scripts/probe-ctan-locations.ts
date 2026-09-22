import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createNetworkDataset } from './build-network-data.ts';
import { readGtfsTable, readZipTextFiles, type CsvRow } from './gtfs-archive.ts';

/** CTAN's stable API root for the Bahia de Cadiz consortium. */
const ctanApiRoot = 'http://api.ctan.es/v1/Consorcios/2/';

/** The ignored GTFS input that the probe compares with CTAN's location directory. */
const defaultInputPath = resolve('data/source/ctan-gtfs.zip');

/** The ignored parent directory for timestamped, reproducible CTAN API captures. */
const defaultOutputParentPath = resolve('data/source/ctan-location-probe');

/** The ignored root that contains every source-data file written by this developer-only command. */
const sourceDataPath = resolve('data/source');

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
  lineFallbackGtfsStopIds: string[];
  unresolvedLocationGtfsStopIds: string[];
}

/** Parsed command-line settings for one explicit, developer-only probe run. */
interface ProbeArguments {
  inputPath: string;
  outputParentPath: string;
}

/** A fetched API response retained exactly as an ignored source-data capture. */
interface CapturedResponse {
  url: string;
  text: string;
}

/** One captured optional CTAN response, including an ordinary no-data response. */
interface CtanOptionalResponse extends CapturedResponse {
  isMissing: boolean;
}

/** The GTFS stop coverage and route membership needed for one CTAN location probe. */
interface BahiaGtfsProbeInput {
  archiveSha256: string;
  stopIds: string[];
  routeIdsByStopId: ReadonlyMap<string, readonly string[]>;
}

/** Metadata recorded beside raw responses so a report can be audited after the fact. */
interface CaptureManifest {
  retrievedAt: string;
  gtfsArchiveSha256: string;
  responses: Array<{ path: string; sha256: string; url: string }>;
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

/** Parse the stop IDs from a CTAN line itinerary without trusting its inconsistent hierarchy field. */
export function parseCtanLineStopIds(value: unknown): string[] {
  const record = requiredRecord(value, 'line stops response');
  return requiredArray(record.paradas, 'line stops response.paradas').map((item, index) => {
    const stop = requiredRecord(item, `line stops[${index}]`);
    return requiredIdentifier(stop.idParada, `line stops[${index}].idParada`);
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
  lineFallbackGtfsStopIds: readonly string[] = [],
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

  // A line itinerary can prove an exact stop ID but not its place membership, so keep both facts.
  const resolvedByLineFallback = new Set<string>();
  for (const gtfsStopId of lineFallbackGtfsStopIds) {
    if (uniqueGtfsStopIds.has(gtfsStopId) && !matchedGtfsStopIds.has(gtfsStopId)) {
      matchedGtfsStopIds.add(gtfsStopId);
      resolvedByLineFallback.add(gtfsStopId);
    }
  }

  // These IDs remain evidence that CTAN did not supply a usable municipality -> núcleo relation.
  const unresolvedLocationGtfsStopIds = [...resolvedByLineFallback].sort(compareText);

  // This final difference is the user-facing evidence of stop IDs CTAN did not supply by any source.
  const unmatchedGtfsStopIds = [...uniqueGtfsStopIds]
    .filter((stopId) => !matchedGtfsStopIds.has(stopId))
    .sort(compareText);

  return {
    status: unmatchedGtfsStopIds.length === 0 && unresolvedLocationGtfsStopIds.length === 0 ? 'verified' : 'incomplete',
    gtfsStopCount: uniqueGtfsStopIds.size,
    municipalityCount: municipalitiesById.size,
    nucleusCount: nucleiById.size,
    ctanStopCount: stopsById.size,
    matchedGtfsStopCount: matchedGtfsStopIds.size,
    unmatchedGtfsStopIds,
    lineFallbackGtfsStopIds: unresolvedLocationGtfsStopIds,
    unresolvedLocationGtfsStopIds,
  };
}

/** Fetch one JSON endpoint while retaining its raw response for source-data review. */
async function fetchJson(url: string): Promise<CapturedResponse> {
  // Non-success responses from required directory endpoints invalidate the entire probe run.
  const response = await fetch(url);
  if (!response.ok) {
    fail(`could not load ${url} (${response.status}).`);
  }

  return { url, text: await response.text() };
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

/** Fetch and retain an optional response whose absence is unresolved-stop evidence, not a crash. */
async function fetchOptionalCtanJson(url: string): Promise<CtanOptionalResponse> {
  // Read the body before deciding whether it is a tolerated absence so it can always be captured.
  const response = await fetch(url);
  const text = await response.text();
  const isMissing = isMissingCtanStopResponse(response.status, text);
  if (!response.ok && !isMissing) {
    fail(`could not load ${url} (${response.status}).`);
  }

  return { url, text, isMissing };
}

/** Parse one captured response as JSON without losing the original text written to disk. */
function parseCapturedJson(response: CapturedResponse): unknown {
  try {
    // Keep JSON parsing separate from fetching so the raw body is available for audit on disk.
    return JSON.parse(response.text) as unknown;
  } catch {
    fail(`${response.url} did not return valid JSON.`);
  }
}

/** Build one CTAN API URL from the fixed Bahia root and an identifier-safe relative path. */
function getCtanUrl(path: string): string {
  return new URL(path, ctanApiRoot).toString();
}

/** Index each selected GTFS stop by the routes that actually include it in a route pattern. */
function createRouteIdsByStopId(
  patterns: readonly { routeId: string; stopIds: readonly string[] }[],
): Map<string, readonly string[]> {
  const routeIdsByStopId = new Map<string, Set<string>>();

  for (const pattern of patterns) {
    for (const stopId of pattern.stopIds) {
      const routeIds = routeIdsByStopId.get(stopId) ?? new Set<string>();
      routeIds.add(pattern.routeId);
      routeIdsByStopId.set(stopId, routeIds);
    }
  }

  return new Map([...routeIdsByStopId].map(([stopId, routeIds]) => [stopId, [...routeIds].sort(compareText)]));
}

/** Read the selected GTFS stop slice and its route membership without rewriting the browser asset. */
async function loadBahiaGtfsProbeInput(inputPath: string): Promise<BahiaGtfsProbeInput> {
  // Reuse the snapshot generator's selection rules rather than creating a subtly different GTFS slice.
  const archive = await readFile(inputPath);
  const files = await readZipTextFiles(archive);
  const dataset = createNetworkDataset(
    {
      agency: readGtfsTable(files, 'agency.txt'),
      routes: readGtfsTable(files, 'routes.txt'),
      stops: readGtfsTable(files, 'stops.txt'),
      trips: readGtfsTable(files, 'trips.txt'),
      stopTimes: readGtfsTable(files, 'stop_times.txt'),
    } satisfies {
      agency: readonly CsvRow[];
      routes: readonly CsvRow[];
      stops: readonly CsvRow[];
      trips: readonly CsvRow[];
      stopTimes: readonly CsvRow[];
    },
    createHash('sha256').update(archive).digest('hex'),
  );

  // The resulting browser dataset contains precisely the stops and lines the CTAN crosswalk can query.
  return {
    archiveSha256: dataset.source.archiveSha256,
    stopIds: dataset.stops.map((stop) => stop.id),
    routeIdsByStopId: createRouteIdsByStopId(dataset.patterns),
  };
}

/** Make a timestamped directory name that is portable on Windows and unambiguous in source-data review. */
function getCaptureDirectoryName(now: Date): string {
  return now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

/** Keep generated API evidence under ignored source data, even when a developer chooses a custom path. */
function isSourceDataPath(path: string): boolean {
  // A relative path beginning with `..` would escape the ignored source-data boundary.
  const relativePath = relative(sourceDataPath, path);
  return (
    relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath))
  );
}

/** Persist one raw API response and append its integrity metadata to the capture manifest. */
async function writeCapture(outputPath: string, response: CapturedResponse, manifest: CaptureManifest): Promise<void> {
  // Write the exact body first, then record enough metadata to verify it later without recontacting CTAN.
  await writeFile(outputPath, response.text);
  manifest.responses.push({
    path: outputPath,
    sha256: createHash('sha256').update(response.text).digest('hex'),
    url: response.url,
  });
}

/** Parse strict command-line arguments without accidentally accepting an unknown option. */
function parseProbeArguments(arguments_: readonly string[]): ProbeArguments {
  try {
    const { values } = parseArgs({
      args: [...arguments_],
      options: {
        input: { type: 'string' },
        output: { type: 'string' },
      },
      strict: true,
      allowPositionals: false,
    });
    const outputParentPath = values.output === undefined ? defaultOutputParentPath : resolve(values.output);

    // This command is investigative only; prevent a custom option from writing into application assets.
    if (!isSourceDataPath(outputParentPath)) {
      fail('--output must stay within data/source.');
    }

    return { inputPath: values.input === undefined ? defaultInputPath : resolve(values.input), outputParentPath };
  } catch (error: unknown) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Capture CTAN's official location directory and report whether it fully covers selected GTFS stops.
 *
 * CTAN's `/paradas` collection can omit records available at `/paradas/<idParada>`, so candidates
 * absent from the collection receive one exact detail lookup. A remaining candidate can be verified
 * through its GTFS route's `/lineas/<idLinea>/paradas` itinerary, but that endpoint does not provide
 * a reliable location hierarchy and therefore cannot complete the place crosswalk.
 * This is intentionally separate from `just data-refresh`: it downloads evidence only into ignored
 * source data and never changes the reviewed browser dataset.
 */
export async function probeCtanLocations(
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<{ outputPath: string; report: CtanLocationProbeReport }> {
  // The local GTFS archive defines the exact stop IDs that this probe must account for.
  const { inputPath, outputParentPath } = parseProbeArguments(arguments_);
  const { archiveSha256, stopIds, routeIdsByStopId } = await loadBahiaGtfsProbeInput(inputPath);

  // Each run has its own ignored evidence directory, so it cannot alter the browser's data snapshot.
  const outputPath = resolve(outputParentPath, getCaptureDirectoryName(new Date()));
  await mkdir(outputPath, { recursive: true });

  // The manifest ties the captured API files back to this specific GTFS archive.
  const manifest: CaptureManifest = {
    retrievedAt: new Date().toISOString(),
    gtfsArchiveSha256: archiveSha256,
    responses: [],
  };

  // CTAN exposes the hierarchy from the top down: municipalities, then their núcleos, then stops.
  const municipalitiesResponse = await fetchJson(getCtanUrl('municipios'));
  await writeCapture(resolve(outputPath, 'municipios.json'), municipalitiesResponse, manifest);
  const municipalities = parseCtanMunicipalities(parseCapturedJson(municipalitiesResponse));

  const nuclei: CtanNucleus[] = [];
  for (const municipality of municipalities) {
    // This endpoint is scoped to one municipality; verify CTAN did not return a mismatched child.
    const response = await fetchJson(getCtanUrl(`municipios/${municipality.id}/nucleos`));
    await writeCapture(resolve(outputPath, `municipio-${municipality.id}-nucleos.json`), response, manifest);
    const municipalityNuclei = parseCtanNuclei(parseCapturedJson(response));
    for (const nucleus of municipalityNuclei) {
      if (nucleus.municipalityId !== municipality.id) {
        fail(`municipality ${municipality.id} returned nucleus ${nucleus.id} for ${nucleus.municipalityId}.`);
      }
      nuclei.push(nucleus);
    }
  }

  // Start with CTAN's all-stops directory, which is faster but known to be incomplete.
  const stopsResponse = await fetchJson(getCtanUrl('paradas'));
  await writeCapture(resolve(outputPath, 'paradas.json'), stopsResponse, manifest);
  const stops = parseCtanStops(parseCapturedJson(stopsResponse));

  // Use the first report only to identify which GTFS IDs need a direct CTAN stop lookup.
  const collectionReport = createCtanLocationProbeReport({ municipalities, nuclei, stops }, stopIds);
  for (const gtfsStopId of collectionReport.unmatchedGtfsStopIds) {
    // The identifier rule is reversible: GTFS "2_91" corresponds to CTAN stop "91".
    const ctanStopId = getCtanStopId(gtfsStopId);
    if (ctanStopId === null) {
      continue;
    }

    // Preserve both a found detail record and CTAN's ordinary no-data response as evidence.
    const response = await fetchOptionalCtanJson(getCtanUrl(`paradas/${ctanStopId}`));
    await writeCapture(resolve(outputPath, `parada-${ctanStopId}.json`), response, manifest);
    if (response.isMissing) {
      continue;
    }

    // A detail response must name the requested stop before it can supplement the collection.
    const stop = parseCtanStop(parseCapturedJson(response));
    if (stop.id !== ctanStopId) {
      fail(`stop detail ${ctanStopId} returned ${stop.id}.`);
    }
    stops.push(stop);
  }

  // Query each relevant line once for stop IDs absent from both stop-directory endpoints.
  const detailReport = createCtanLocationProbeReport({ municipalities, nuclei, stops }, stopIds);
  const lineStopIdsByLineId = new Map<string, Set<string>>();
  const lineFallbackGtfsStopIds = new Set<string>();
  for (const gtfsStopId of detailReport.unmatchedGtfsStopIds) {
    const ctanStopId = getCtanStopId(gtfsStopId);
    if (ctanStopId === null) {
      continue;
    }

    for (const gtfsRouteId of routeIdsByStopId.get(gtfsStopId) ?? []) {
      const ctanLineId = getCtanLineId(gtfsRouteId);
      if (ctanLineId === null) {
        continue;
      }

      let lineStopIds = lineStopIdsByLineId.get(ctanLineId);
      if (lineStopIds === undefined) {
        const response = await fetchOptionalCtanJson(getCtanUrl(`lineas/${ctanLineId}/paradas`));
        await writeCapture(resolve(outputPath, `linea-${ctanLineId}-paradas.json`), response, manifest);
        lineStopIds = response.isMissing
          ? new Set<string>()
          : new Set(parseCtanLineStopIds(parseCapturedJson(response)));
        lineStopIdsByLineId.set(ctanLineId, lineStopIds);
      }

      if (lineStopIds.has(ctanStopId)) {
        lineFallbackGtfsStopIds.add(gtfsStopId);
        break;
      }
    }
  }

  // The final report separates all-source stop coverage from verified place membership.
  const report = createCtanLocationProbeReport({ municipalities, nuclei, stops }, stopIds, [
    ...lineFallbackGtfsStopIds,
  ]);

  // Write the reproducible audit trail only after every request and validation has completed.
  await writeFile(resolve(outputPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(outputPath, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

  return { outputPath, report };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  // Permit importing parser and report helpers in offline tests without triggering live API calls.
  void probeCtanLocations()
    .then(({ outputPath, report }) => {
      console.log(
        `Captured CTAN location evidence in ${outputPath}: ${report.matchedGtfsStopCount}/${report.gtfsStopCount} GTFS stops matched.`,
      );
      if (report.status !== 'verified') {
        console.error(`CTAN location crosswalk is incomplete; see ${resolve(outputPath, 'report.json')}.`);
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
