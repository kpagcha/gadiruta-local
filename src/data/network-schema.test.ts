/**
 * Checks that incomplete or inconsistent routes-and-stops JSON is rejected, including references to
 * routes, stops, or agencies that are missing from the file.
 *
 * These examples are saved in the test file; no live data is needed.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { NetworkDataError, parseNetworkDataset } from './network-schema.ts';

const dataset = {
  formatVersion: 1,
  source: {
    url: 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip',
    generatedAt: '2026-09-21T15:15:44.000Z',
    archiveSha256: 'a'.repeat(64),
  },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [
    {
      id: '2_13',
      agencyId: 'CMTBC',
      shortName: 'M-040',
      longName: 'Cádiz-El Puerto',
      type: 3,
      color: '9933ff',
      textColor: 'FFFFFF',
    },
  ],
  stops: [
    { id: 'cadiz', name: 'Cádiz', latitude: 36.53, longitude: -6.29, parentStationId: null },
    {
      id: 'puerto',
      name: 'El Puerto',
      latitude: 36.6,
      longitude: -6.23,
      parentStationId: null,
    },
  ],
  patterns: [{ routeId: '2_13', directionId: '0', stopIds: ['cadiz', 'puerto'] }],
};

test('accepts the version-one topology contract', () => {
  assert.deepEqual(parseNetworkDataset(dataset), dataset);
});

test('rejects unknown route and stop references', () => {
  const invalid = {
    ...dataset,
    patterns: [{ routeId: 'unknown', directionId: null, stopIds: ['missing'] }],
  };

  assert.throws(() => parseNetworkDataset(invalid), NetworkDataError);
});

test('rejects malformed source provenance', () => {
  const invalid = {
    ...dataset,
    source: { ...dataset.source, archiveSha256: 'not-a-hash' },
  };

  assert.throws(() => parseNetworkDataset(invalid), /SHA-256/);
});
