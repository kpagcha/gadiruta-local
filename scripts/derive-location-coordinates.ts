/**
 * Derives candidate local-area coordinates from the stops in the checked-in network snapshot.
 * Developers run this offline to update the reviewed CTAN location directory. The snapshot
 * builder later copies each representative stop's point into the browser data.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseNetworkDataset, type NetworkDataset, type NetworkStop } from '../src/data/network-schema.ts';

/** A geographic point in decimal degrees. */
interface Coordinate {
  latitude: number;
  longitude: number;
}

/** Two candidate points and the number of stops used to derive them. */
interface DerivedCoordinates {
  stopCount: number;
  average: Coordinate;
  representativeStop: Coordinate & { stopId: string };
}

/** The reviewed hierarchy, including older municipality points that the tool removes. */
export interface LocationDirectory {
  retrievedAt: string;
  municipalities: (NetworkDataset['municipalities'][number] & { derivedCoordinates?: DerivedCoordinates })[];
  nuclei: (Omit<NetworkDataset['nuclei'][number], 'referencePoint'> & { derivedCoordinates?: DerivedCoordinates })[];
  stopLocations: Record<string, { municipalityId: string; nucleusId: string | null }>;
}

/** Round a coordinate to roughly 10 cm so generated JSON stays compact and stable. */
function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

/** Measure straight-line distance between two nearby or distant points on Earth. */
function distanceKilometers(first: Coordinate, second: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

/** Return both the arithmetic average and the stop nearest to all other stops overall. */
function coordinatesFromStops(stops: readonly NetworkStop[]): DerivedCoordinates | undefined {
  if (stops.length === 0) return undefined;

  // Stable stop order makes floating-point sums and medoid ties reproducible.
  const ordered = [...stops].sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
  const average = {
    latitude: roundCoordinate(ordered.reduce((sum, stop) => sum + stop.latitude, 0) / ordered.length),
    longitude: roundCoordinate(ordered.reduce((sum, stop) => sum + stop.longitude, 0) / ordered.length),
  };

  let representative = ordered[0]!;
  let shortestTotalDistance = Infinity;
  for (const candidate of ordered) {
    const totalDistance = ordered.reduce((sum, stop) => sum + distanceKilometers(candidate, stop), 0);
    if (totalDistance < shortestTotalDistance - 1e-9) {
      shortestTotalDistance = totalDistance;
      representative = candidate;
    }
  }

  return {
    stopCount: ordered.length,
    average,
    representativeStop: {
      stopId: representative.id,
      latitude: roundCoordinate(representative.latitude),
      longitude: roundCoordinate(representative.longitude),
    },
  };
}

/** Refuse to write points when the reviewed directory and network snapshot disagree. */
function validateDirectory(directory: LocationDirectory, dataset: NetworkDataset): void {
  if (
    !Array.isArray(directory.municipalities) ||
    !Array.isArray(directory.nuclei) ||
    typeof directory.stopLocations !== 'object' ||
    directory.stopLocations === null
  ) {
    throw new Error('The reviewed location directory is missing its hierarchy or stop relationships.');
  }

  const municipalities = new Map(directory.municipalities.map((item) => [item.id, item]));
  const nuclei = new Map(directory.nuclei.map((item) => [item.id, item]));
  if (municipalities.size !== dataset.municipalities.length || nuclei.size !== dataset.nuclei.length) {
    throw new Error('The reviewed location directory and network snapshot have different location sets.');
  }
  for (const municipality of dataset.municipalities) {
    if (municipalities.get(municipality.id)?.name !== municipality.name) {
      throw new Error(`Municipality ${municipality.id} differs between the directory and snapshot.`);
    }
  }
  for (const nucleus of dataset.nuclei) {
    const reviewed = nuclei.get(nucleus.id);
    if (reviewed?.name !== nucleus.name || reviewed.municipalityId !== nucleus.municipalityId) {
      throw new Error(`Local area ${nucleus.id} differs between the directory and snapshot.`);
    }
  }
  for (const stop of dataset.stops) {
    const reviewed = directory.stopLocations[stop.id];
    if (
      reviewed === undefined ||
      reviewed.municipalityId !== stop.municipalityId ||
      reviewed.nucleusId !== stop.nucleusId
    ) {
      throw new Error(`Stop ${stop.id} differs between the directory and snapshot.`);
    }
  }
}

/** Add candidates to local areas with stops and remove all municipality candidates. */
export function deriveLocationCoordinates(directory: LocationDirectory, dataset: NetworkDataset): LocationDirectory {
  validateDirectory(directory, dataset);
  const stopsByNucleus = new Map<string, NetworkStop[]>();

  // Only resolved local areas receive a point; a municipality search can use its town area's point.
  for (const stop of dataset.stops) {
    if (stop.nucleusId !== null) {
      const nucleusStops = stopsByNucleus.get(stop.nucleusId) ?? [];
      nucleusStops.push(stop);
      stopsByNucleus.set(stop.nucleusId, nucleusStops);
    }
  }

  return {
    ...directory,
    municipalities: directory.municipalities.map((municipality) => {
      const next = { ...municipality };
      delete next.derivedCoordinates;
      return next;
    }),
    nuclei: directory.nuclei.map((nucleus) => {
      const next = { ...nucleus };
      const coordinates = coordinatesFromStops(stopsByNucleus.get(nucleus.id) ?? []);
      if (coordinates === undefined) delete next.derivedCoordinates;
      else next.derivedCoordinates = coordinates;
      return next;
    }),
  };
}

/** Read the checked-in snapshot and update only the reviewed directory when its contents change. */
export async function writeDerivedLocationCoordinates(): Promise<{ localAreas: number; changed: boolean }> {
  const snapshotPath = resolve('public/data/bahia-cadiz-network.json');
  const directoryPath = resolve('scripts/ctan-location-directory.json');
  const dataset = parseNetworkDataset(JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown);
  const before = await readFile(directoryPath, 'utf8');
  const directory = JSON.parse(before) as LocationDirectory;
  const updated = deriveLocationCoordinates(directory, dataset);
  const after = `${JSON.stringify(updated, null, 2)}\n`;
  if (after !== before) await writeFile(directoryPath, after);
  return {
    localAreas: updated.nuclei.filter((item) => item.derivedCoordinates !== undefined).length,
    changed: after !== before,
  };
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  void writeDerivedLocationCoordinates()
    .then(({ localAreas, changed }) => {
      console.log(`${changed ? 'Updated' : 'Already current'} reviewed coordinates: ${localAreas} local areas.`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
