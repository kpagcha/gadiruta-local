/**
 * Checks whether CTAN's location lists can match GTFS stops to municipalities and smaller areas.
 *
 * A developer runs this investigation with `just locations-probe`. It contacts CTAN and saves the
 * replies and a coverage report under ignored `data/source/ctan-location-probe/`; it never changes
 * the JSON used by the website.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createNetworkDataset } from '../gtfs/network-dataset.ts';
import {
  createCtanLocationProbeReport,
  getCtanLineId,
  getCtanStopId,
  indexCtanLineStops,
  isMissingCtanStopResponse,
  parseCtanLineStops,
  parseCtanMunicipalities,
  parseCtanLocalAreas,
  parseCtanStop,
  parseCtanStops,
  type CtanLineFallback,
  type CtanLineStop,
  type CtanLocationProbeReport,
  type CtanLocalArea,
} from './ctan-location-crosswalk.ts';
import { readGtfsTables } from '../gtfs/archive.ts';

/** CTAN's stable API root for the Bahia de Cadiz consortium. */
const ctanApiRoot = 'http://api.ctan.es/v1/Consorcios/2/';

/** The ignored GTFS input that the probe compares with CTAN's location directory. */
const defaultInputPath = resolve('data/source/ctan-gtfs.zip');

/** The ignored parent directory for timestamped, reproducible CTAN API captures. */
const defaultOutputParentPath = resolve('data/source/ctan-location-probe');

/** The ignored root that contains every source-data file written by this developer-only command. */
const sourceDataPath = resolve('data/source');

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

/** Fetch one JSON endpoint while retaining its raw response for source-data review. */
async function fetchJson(url: string): Promise<CapturedResponse> {
  // Non-success responses from required directory endpoints invalidate the entire probe run.
  const response = await fetch(url);
  if (!response.ok) {
    fail(`could not load ${url} (${response.status}).`);
  }

  return { url, text: await response.text() };
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

/** Sort route identifiers deterministically before choosing which CTAN line endpoint to query. */
function compareText(first: string, second: string): number {
  return first.localeCompare(second, 'en');
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
  const dataset = createNetworkDataset(
    await readGtfsTables(archive),
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

  const localAreas: CtanLocalArea[] = [];
  for (const municipality of municipalities) {
    // This endpoint is scoped to one municipality; verify CTAN did not return a mismatched child.
    const response = await fetchJson(getCtanUrl(`municipios/${municipality.id}/nucleos`));
    await writeCapture(resolve(outputPath, `municipio-${municipality.id}-nucleos.json`), response, manifest);
    const municipalityLocalAreas = parseCtanLocalAreas(parseCapturedJson(response));
    for (const localArea of municipalityLocalAreas) {
      if (localArea.municipalityId !== municipality.id) {
        fail(`municipality ${municipality.id} returned local area ${localArea.id} for ${localArea.municipalityId}.`);
      }
      localAreas.push(localArea);
    }
  }

  // Start with CTAN's all-stops directory, which is faster but known to be incomplete.
  const stopsResponse = await fetchJson(getCtanUrl('paradas'));
  await writeCapture(resolve(outputPath, 'paradas.json'), stopsResponse, manifest);
  const stops = parseCtanStops(parseCapturedJson(stopsResponse));

  // Use the first report only to identify which GTFS IDs need a direct CTAN stop lookup.
  const collectionReport = createCtanLocationProbeReport({ municipalities, localAreas, stops }, stopIds);
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
  const detailReport = createCtanLocationProbeReport({ municipalities, localAreas, stops }, stopIds);
  const lineStopsByLineId = new Map<string, Map<string, CtanLineStop>>();
  const lineFallbacksByGtfsStopId = new Map<string, CtanLineFallback>();
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

      let lineStops = lineStopsByLineId.get(ctanLineId);
      if (lineStops === undefined) {
        const response = await fetchOptionalCtanJson(getCtanUrl(`lineas/${ctanLineId}/paradas`));
        await writeCapture(resolve(outputPath, `linea-${ctanLineId}-paradas.json`), response, manifest);
        lineStops = response.isMissing
          ? new Map<string, CtanLineStop>()
          : indexCtanLineStops(parseCtanLineStops(parseCapturedJson(response)));
        lineStopsByLineId.set(ctanLineId, lineStops);
      }

      const lineStop = lineStops.get(ctanStopId);
      if (lineStop !== undefined) {
        lineFallbacksByGtfsStopId.set(gtfsStopId, {
          gtfsStopId,
          municipalityId: lineStop.municipalityId,
        });
        break;
      }
    }
  }

  // The final report separates all-source stop coverage from verified place membership.
  const report = createCtanLocationProbeReport({ municipalities, localAreas, stops }, stopIds, [
    ...lineFallbacksByGtfsStopId.values(),
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
