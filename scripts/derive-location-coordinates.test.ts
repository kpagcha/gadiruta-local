/** Checks offline coordinate derivation without changing the reviewed directory or contacting CTAN. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { NetworkDataset, NetworkStop } from '../src/data/network-schema.ts';
import { deriveLocationCoordinates, type LocationDirectory } from './derive-location-coordinates.ts';

/** Make one coordinate-bearing stop with no unrelated timetable data. */
function stop(
  id: string,
  municipalityId: string,
  localAreaId: string | null,
  latitude: number,
  longitude: number,
): NetworkStop {
  return {
    id,
    name: id,
    latitude,
    longitude,
    parentStationId: null,
    placeId: null,
    municipalityId,
    localAreaId,
  };
}

const dataset: NetworkDataset = {
  formatVersion: 5,
  source: { url: 'source', generatedAt: '2026-09-25T00:00:00.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [],
  routes: [],
  municipalities: [
    { id: 'a', name: 'Town A' },
    { id: 'b', name: 'Town B' },
    { id: 'empty', name: 'No stops' },
  ],
  localAreas: [
    { id: 'a-town', municipalityId: 'a', name: 'Town A', referencePoint: null },
    { id: 'b-town', municipalityId: 'b', name: 'Town B', referencePoint: null },
    { id: 'empty-area', municipalityId: 'empty', name: 'No stops', referencePoint: null },
  ],
  stops: [
    stop('a-1', 'a', 'a-town', 0, 0),
    stop('a-2', 'a', 'a-town', 0, 2),
    stop('a-3', 'a', 'a-town', 0, 10),
    stop('b-1', 'b', 'b-town', 1, 1),
    stop('b-unresolved', 'b', null, 3, 3),
  ],
  patterns: [],
  trips: [],
  calendars: [],
  calendarExceptions: [],
  coverage: { startDate: '2026-01-01', endDate: '2026-12-31' },
};

/** Give a fixture dataset the same reviewed location relationships as its stops. */
function directoryFor(network: NetworkDataset): LocationDirectory {
  return {
    retrievedAt: '2026-09-22T00:00:00.000Z',
    municipalities: network.municipalities.map((municipality) => ({ ...municipality })),
    localAreas: network.localAreas.map(({ id, municipalityId, name }) => ({ id, municipalityId, name })),
    stopLocations: Object.fromEntries(
      network.stops.map((item) => [item.id, { municipalityId: item.municipalityId!, localAreaId: item.localAreaId }]),
    ),
  };
}

test('writes average and representative coordinates only for resolved local areas', () => {
  const result = deriveLocationCoordinates(directoryFor(dataset), dataset);
  assert.deepEqual(result.localAreas[0]?.derivedCoordinates, {
    stopCount: 3,
    average: { latitude: 0, longitude: 4 },
    representativeStop: { stopId: 'a-2', latitude: 0, longitude: 2 },
  });
  assert.deepEqual(result.localAreas[1]?.derivedCoordinates, {
    stopCount: 1,
    average: { latitude: 1, longitude: 1 },
    representativeStop: { stopId: 'b-1', latitude: 1, longitude: 1 },
  });
  assert.ok(result.municipalities.every((municipality) => municipality.derivedCoordinates === undefined));
});

test('removes municipality and empty-area points and produces the same JSON on a second run', () => {
  const directory = directoryFor(dataset);
  const stale = {
    stopCount: 1,
    average: { latitude: 9, longitude: 9 },
    representativeStop: { stopId: 'old', latitude: 9, longitude: 9 },
  };
  directory.municipalities[0]!.derivedCoordinates = stale;
  directory.localAreas[2]!.derivedCoordinates = stale;
  const first = deriveLocationCoordinates(directory, dataset);
  assert.equal(first.municipalities[0]?.derivedCoordinates, undefined);
  assert.equal(first.localAreas[2]?.derivedCoordinates, undefined);
  assert.equal(JSON.stringify(deriveLocationCoordinates(first, dataset)), JSON.stringify(first));
});

test('breaks equally representative stop ties by stable stop ID', () => {
  const twoStops: NetworkDataset = {
    ...dataset,
    stops: [stop('z', 'a', 'a-town', 0, 2), stop('a', 'a', 'a-town', 0, 0)],
  };
  const result = deriveLocationCoordinates(directoryFor(twoStops), twoStops);
  assert.deepEqual(result.localAreas[0]?.derivedCoordinates, {
    stopCount: 2,
    average: { latitude: 0, longitude: 1 },
    representativeStop: { stopId: 'a', latitude: 0, longitude: 0 },
  });
});

test('refuses a stale stop relationship before deriving any coordinates', () => {
  const directory = directoryFor(dataset);
  directory.stopLocations['a-1'] = { municipalityId: 'b', localAreaId: 'a-town' };
  assert.throws(() => deriveLocationCoordinates(directory, dataset), /Stop a-1 differs/);
});
