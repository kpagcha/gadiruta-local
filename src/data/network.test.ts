/**
 * Checks that the browser data loader requests the website's local routes-and-stops JSON and rejects
 * files that do not match the expected format.
 *
 * The tests replace the browser fetch function with saved responses, so they use no network.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNetworkDataset } from './network.ts';

const dataset = {
  formatVersion: 1,
  source: {
    url: 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip',
    generatedAt: '2026-09-21T16:09:45.619Z',
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
      color: null,
      textColor: null,
    },
  ],
  stops: [{ id: 'cadiz', name: 'Cádiz', latitude: 36.53, longitude: -6.29, parentStationId: null }],
  patterns: [{ routeId: '2_13', directionId: '0', stopIds: ['cadiz'] }],
};

test('loads and validates the static network asset without an upstream request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(input, '/data/bahia-cadiz-network.json');
    return new Response(JSON.stringify(dataset));
  };

  try {
    assert.deepEqual(await loadNetworkDataset(), dataset);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a missing static network asset', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });

  try {
    await assert.rejects(loadNetworkDataset(), /could not be loaded/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
