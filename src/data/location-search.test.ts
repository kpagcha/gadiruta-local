/**
 * Checks that place names and exact bus stops appear as separate search choices, and that typed
 * searches find the expected names and route information.
 *
 * The tests use a small in-file example network and do not load data from CTAN.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocationOptions, searchLocations } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';

const dataset: NetworkDataset = {
  formatVersion: 1,
  source: { url: 'source', generatedAt: '2026-09-21T16:09:45.619Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [
    { id: '2_10', agencyId: 'CMTBC', shortName: 'M-032', longName: null, type: 3, color: null, textColor: null },
    { id: '2_11', agencyId: 'CMTBC', shortName: 'M-050', longName: null, type: 3, color: null, textColor: null },
  ],
  stops: [
    { id: '2_1', name: 'Estación de Autobuses Rota', latitude: 36.62, longitude: -6.35, parentStationId: null },
    { id: '2_2', name: 'Av. de María Auxiliadora', latitude: 36.63, longitude: -6.36, parentStationId: null },
    { id: '2_3', name: 'Hospital Puerta Del Mar', latitude: 36.5, longitude: -6.27, parentStationId: null },
    { id: '2_4', name: 'Hospital Puerta Del Mar', latitude: 36.51, longitude: -6.28, parentStationId: null },
  ],
  patterns: [
    { routeId: '2_10', directionId: '0', stopIds: ['2_1', '2_2', '2_3'] },
    { routeId: '2_10', directionId: '1', stopIds: ['2_1', '2_2', '2_3'] },
    { routeId: '2_11', directionId: '0', stopIds: ['2_4'] },
  ],
};

const options = createLocationOptions(
  [
    { id: 'rota', name: 'Rota' },
    { id: 'cadiz', name: 'Cádiz' },
  ],
  dataset,
);

test('finds a place and named stops in the same search, with exact names first', () => {
  assert.deepEqual(
    searchLocations(options, 'rota').map(({ kind, id }) => ({ kind, id })),
    [
      { kind: 'place', id: 'rota' },
      { kind: 'stop', id: '2_1' },
    ],
  );
  assert.deepEqual(
    searchLocations(options, '  MARIA   AUXILIADORA ').map(({ id }) => id),
    ['2_2'],
  );
  assert.deepEqual(
    searchLocations(options, 'cadiz').map(({ id }) => id),
    ['cadiz'],
  );
});

test('keeps same-named physical stops distinct and carries their own line context', () => {
  assert.deepEqual(
    searchLocations(options, 'Hospital Puerta del Mar').map((result) =>
      result.kind === 'stop' ? { id: result.id, routes: result.routeLabels } : result,
    ),
    [
      { id: '2_3', routes: ['M-032'] },
      { id: '2_4', routes: ['M-050'] },
    ],
  );
});

test('returns no suggestions for blank or unmatched input and respects the result limit', () => {
  assert.deepEqual(searchLocations(options, '   '), []);
  assert.deepEqual(searchLocations(options, 'nowhere'), []);
  assert.equal(searchLocations(options, 'a', 2).length, 2);
});
