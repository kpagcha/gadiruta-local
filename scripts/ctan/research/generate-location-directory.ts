/**
 * Builds the reviewed CTAN location file from a matching GTFS ZIP and saved CTAN replies.
 * A developer runs this command after or during a location probe. It checks the saved replies,
 * assigns selected stops to official places, derives area points, and updates the tracked file
 * only when its place data changes.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { z } from 'zod';
import type { NetworkDataset } from '../../../src/data/network-schema.ts';
import { readGtfsTables } from '../archive.ts';
import { createNetworkDataset } from '../convert.ts';
import { locationDirectorySchema, type LocationDirectory } from '../location-directory.ts';
import {
  createCtanLocationProbeReport,
  getCtanStopId,
  isMissingCtanStopResponse,
  parseCtanLineStops,
  parseCtanLocalAreas,
  parseCtanMunicipalities,
  parseCtanStop,
  parseCtanStops,
  type CtanLocationProbeReport,
} from './ctan-location-crosswalk.ts';
import { deriveLocationCoordinates } from './derive-location-coordinates.ts';
import { probeCtanLocations } from './probe-ctan-locations.ts';

const defaultInputPath = resolve('data/source/ctan/gtfs.zip');
const reviewedPath = resolve('data/reviewed/ctan/location-directory.json');
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  gtfsArchiveSha256: hashSchema,
  responses: z.array(
    z.object({ path: z.string().min(1), sha256: hashSchema, url: z.string().url(), status: z.number().int() }),
  ),
});
const reportSchema = z.object({
  status: z.enum(['verified', 'incomplete']),
  gtfsStopCount: z.number().int(),
  municipalityCount: z.number().int(),
  localAreaCount: z.number().int(),
  ctanStopCount: z.number().int(),
  matchedGtfsStopCount: z.number().int(),
  unmatchedGtfsStopIds: z.array(z.string()),
  lineFallbacks: z.array(z.object({ gtfsStopId: z.string(), municipalityId: z.string() })),
  unresolvedLocalAreaGtfsStopIds: z.array(z.string()),
});

/** One saved reply with the HTTP status needed to distinguish a missing stop from bad data. */
interface SavedResponse {
  status: number;
  text: string;
}

/** All evidence the offline conversion needs from one probe run. */
export interface LocationCapture {
  retrievedAt: string;
  responses: ReadonlyMap<string, SavedResponse>;
  report: CtanLocationProbeReport;
}

/** Stop on missing or contradictory evidence before the tracked file can be changed. */
function fail(message: string): never {
  throw new Error(`CTAN location generation error: ${message}`);
}

/** Sort provider IDs as text so each run produces the same reviewed JSON order. */
function compareIds(first: string, second: string): number {
  return first.localeCompare(second, 'en');
}

/** Parse one saved successful reply and identify the source file when it is malformed. */
function successfulJson(capture: LocationCapture, filename: string): unknown {
  const response = capture.responses.get(filename);
  if (response === undefined || response.status < 200 || response.status >= 300) {
    fail(`${filename} is missing or was not successful.`);
  }
  try {
    return JSON.parse(response.text) as unknown;
  } catch {
    fail(`${filename} is not valid JSON.`);
  }
}

/** Read every captured reply and verify its bytes and source archive against the probe manifest. */
export async function readLocationCapture(capturePath: string, archiveSha256: string): Promise<LocationCapture> {
  const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(capturePath, 'manifest.json'), 'utf8')));
  if (manifest.gtfsArchiveSha256 !== archiveSha256) fail('the probe and GTFS ZIP have different SHA-256 hashes.');

  const responses = new Map<string, SavedResponse>();
  for (const entry of manifest.responses) {
    // Use only the captured filename: the manifest stores an absolute path that can become stale.
    const filename = basename(entry.path);
    if (responses.has(filename)) fail(`duplicate captured response ${filename}.`);
    const bytes = await readFile(resolve(capturePath, filename));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      fail(`${filename} differs from its probe manifest hash.`);
    }
    responses.set(filename, { status: entry.status, text: bytes.toString('utf8') });
  }
  const report = reportSchema.parse(JSON.parse(await readFile(resolve(capturePath, 'report.json'), 'utf8')));
  return { retrievedAt: manifest.retrievedAt, responses, report };
}

/** Ensure each municipality-only fallback is supported by a captured line serving that GTFS stop. */
function verifyLineFallback(
  capture: LocationCapture,
  dataset: NetworkDataset,
  stopId: string,
  municipalityId: string,
): void {
  const ctanStopId = getCtanStopId(stopId);
  if (ctanStopId === null) fail(`stop ${stopId} has no CTAN identifier.`);
  const routes = new Set(
    dataset.trips.filter((trip) => trip.stopTimes.some((time) => time.stopId === stopId)).map((trip) => trip.routeId),
  );
  for (const routeId of routes) {
    if (!/^2_\d+$/.test(routeId)) continue;
    const filename = `linea-${routeId.slice(2)}-paradas.json`;
    const response = capture.responses.get(filename);
    if (response === undefined || response.status < 200 || response.status >= 300) continue;
    if (
      parseCtanLineStops(successfulJson(capture, filename)).some(
        (stop) => stop.id === ctanStopId && stop.municipalityId === municipalityId,
      )
    )
      return;
  }
  fail(`stop ${stopId} has no captured line proving municipality ${municipalityId}.`);
}

/** Turn a verified probe into the complete location file without reading the old file. */
export function createReviewedLocationDirectory(dataset: NetworkDataset, capture: LocationCapture): LocationDirectory {
  // The provider's hierarchy supplies names and IDs; the GTFS selection defines which stops matter.
  const municipalities = parseCtanMunicipalities(successfulJson(capture, 'municipios.json')).sort((a, b) =>
    compareIds(a.id, b.id),
  );
  const localAreas = municipalities
    .flatMap((municipality) => {
      const filename = `municipio-${municipality.id}-nucleos.json`;
      const areas = parseCtanLocalAreas(successfulJson(capture, filename));
      if (areas.some((area) => area.municipalityId !== municipality.id)) {
        fail(`${filename} contains an area from another municipality.`);
      }
      return areas;
    })
    .sort((a, b) => compareIds(a.id, b.id));
  const stops = parseCtanStops(successfulJson(capture, 'paradas.json'));
  const selectedIds = dataset.stops.map((stop) => stop.id);
  const collectionIds = new Set(stops.map((stop) => `2_${stop.id}`));

  // The main stop list is incomplete. Read each individual reply that the probe saved for a gap.
  for (const stopId of selectedIds) {
    if (collectionIds.has(stopId)) continue;
    const ctanStopId = getCtanStopId(stopId);
    if (ctanStopId === null) fail(`stop ${stopId} has no CTAN identifier.`);
    const filename = `parada-${ctanStopId}.json`;
    const response = capture.responses.get(filename);
    if (response === undefined) fail(`${filename} is missing from the probe.`);
    if (isMissingCtanStopResponse(response.status, response.text)) continue;
    const stop = parseCtanStop(successfulJson(capture, filename));
    if (stop.id !== ctanStopId) fail(`${filename} returned stop ${stop.id}.`);
    stops.push(stop);
  }

  // Recompute the probe report to catch stale or inconsistent saved evidence.
  const report = createCtanLocationProbeReport(
    { municipalities, localAreas, stops },
    selectedIds,
    capture.report.lineFallbacks,
  );
  if (!isDeepStrictEqual(report, capture.report))
    fail('the saved probe report disagrees with its replies or GTFS ZIP.');
  if (report.unmatchedGtfsStopIds.length > 0) {
    fail(`no reliable municipality for ${report.unmatchedGtfsStopIds.join(', ')}.`);
  }

  const stopsById = new Map(stops.map((stop) => [`2_${stop.id}`, stop]));
  const fallbackById = new Map(report.lineFallbacks.map((fallback) => [fallback.gtfsStopId, fallback]));
  const stopLocations: LocationDirectory['stopLocations'] = {};
  for (const stopId of selectedIds.sort(compareIds)) {
    const stop = stopsById.get(stopId);
    if (stop !== undefined) {
      stopLocations[stopId] = { municipalityId: stop.municipalityId, localAreaId: stop.localAreaId };
      continue;
    }
    const fallback = fallbackById.get(stopId);
    if (fallback === undefined) fail(`stop ${stopId} has no CTAN location.`);
    verifyLineFallback(capture, dataset, stopId, fallback.municipalityId);
    stopLocations[stopId] = { municipalityId: fallback.municipalityId, localAreaId: null };
  }

  const base: LocationDirectory = {
    retrievedAt: capture.retrievedAt,
    municipalities,
    localAreas,
    stopLocations,
  };
  locationDirectorySchema.parse(base);
  const withLocations: NetworkDataset = {
    ...dataset,
    municipalities: base.municipalities,
    localAreas: base.localAreas.map((area) => ({ ...area, referencePoint: null })),
    stops: dataset.stops.map((stop) => ({ ...stop, ...base.stopLocations[stop.id] })),
  };
  const generated = deriveLocationCoordinates(base, withLocations);
  locationDirectorySchema.parse(generated);
  return generated;
}

/** Count keys added, removed, or given a different reviewed value. */
function changedKeys<T>(before: ReadonlyMap<string, T>, after: ReadonlyMap<string, T>): number {
  return [...new Set([...before.keys(), ...after.keys()])].filter(
    (id) => !isDeepStrictEqual(before.get(id), after.get(id)),
  ).length;
}

/** Summarize place changes while leaving the full detail to the Git diff. */
function describeChanges(before: LocationDirectory | null, after: LocationDirectory): string {
  if (before === null) return 'Created reviewed location directory.';
  const municipalities = changedKeys(
    new Map(before.municipalities.map((item) => [item.id, item])),
    new Map(after.municipalities.map((item) => [item.id, item])),
  );
  const areas = changedKeys(
    new Map(before.localAreas.map((item) => [item.id, item])),
    new Map(after.localAreas.map((item) => [item.id, item])),
  );
  const stops = changedKeys(
    new Map(Object.entries(before.stopLocations)),
    new Map(Object.entries(after.stopLocations)),
  );
  return `Updated reviewed locations: ${municipalities} municipalities, ${areas} areas, ${stops} stops changed. Review the Git diff.`;
}

/** Download or reuse a probe, then write the reviewed file only after every check passes. */
export async function generateLocationDirectory(
  inputPath = defaultInputPath,
  capturePath?: string,
  outputPath = reviewedPath,
): Promise<{ changed: boolean; message: string; capturePath: string }> {
  const archive = await readFile(inputPath);
  const sha256 = createHash('sha256').update(archive).digest('hex');
  const tables = await readGtfsTables(archive);
  const dataset = createNetworkDataset(tables, sha256);
  const savedPath = capturePath ?? (await probeCtanLocations(['--input', inputPath])).outputPath;
  const capture = await readLocationCapture(savedPath, sha256);
  const generated = createReviewedLocationDirectory(dataset, capture);

  let before: LocationDirectory | null = null;
  try {
    before = locationDirectorySchema.parse(JSON.parse(await readFile(outputPath, 'utf8')));
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (before !== null && isDeepStrictEqual({ ...before, retrievedAt: '' }, { ...generated, retrievedAt: '' })) {
    return { changed: false, message: 'Reviewed locations are already current.', capturePath: savedPath };
  }
  await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
  return { changed: true, message: describeChanges(before, generated), capturePath: savedPath };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  void (async () => {
    const { values } = parseArgs({
      options: { input: { type: 'string' }, capture: { type: 'string' } },
      strict: true,
      allowPositionals: false,
    });
    const result = await generateLocationDirectory(
      values.input === undefined ? defaultInputPath : resolve(values.input),
      values.capture === undefined ? undefined : resolve(values.capture),
    );
    console.log(`${result.message} Probe replies: ${result.capturePath}`);
  })().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
