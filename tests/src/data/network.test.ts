/**
 * Checks that the browser data loader requests the website's local timetable JSON and rejects
 * files that do not match the expected format.
 *
 * The tests replace the browser fetch function with saved responses, so they use no network.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadNetworkDataset } from '../../../src/data/network.ts';

const dataset = {
  formatVersion: 7,
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
  municipalities: [],
  localAreas: [],
  stops: [
    {
      id: 'cadiz',
      name: 'Cádiz',
      latitude: 36.53,
      longitude: -6.29,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
    {
      id: 'rota',
      name: 'Rota',
      latitude: 36.62,
      longitude: -6.35,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
  ],
  trips: [
    {
      id: 'sample',
      routeId: '2_13',
      serviceId: 'daily',
      stopTimes: [
        { stopId: 'cadiz', arrivalMinutes: 480, departureMinutes: 480, pickupType: 0, dropOffType: 0 },
        { stopId: 'rota', arrivalMinutes: 540, departureMinutes: 540, pickupType: 0, dropOffType: 0 },
      ],
    },
  ],
  serviceDates: [{ serviceId: 'daily', dates: ['2026-09-26'] }],
  coverage: { startDate: '2026-09-01', endDate: '2026-12-31' },
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

test('distinguishes malformed JSON from a rejected dataset and forwards cancellation', async (context) => {
  const controller = new AbortController();
  const fetchMock = context.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    assert.equal(init?.signal, controller.signal);
    return new Response('{broken');
  });
  await assert.rejects(loadNetworkDataset(controller.signal), /not valid JSON/);
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ ...dataset, stops: [] })));
  await assert.rejects(loadNetworkDataset(), /stops/);
});
