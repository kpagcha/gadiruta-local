/**
 * Checks that browsing keeps saved line paths in travel order and distinguishes a whole
 * municipality from one of its local areas.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLocationOptions } from '../../../src/data/location-search.ts';
import { lineFromUrl, lineUrl, validateLineUrls } from '../../../src/data/line-url.ts';
import {
  filterLineStopPatterns,
  linesForStops,
  lineStopPatterns,
  matchesBrowseQuery,
  stopLocality,
  stopsForPlace,
} from '../../../src/data/network-browse.ts';
import type { NetworkDataset } from '../../../src/data/network-schema.ts';
import { originSearchUrl, resolveSearchUrl } from '../../../src/data/search-url.ts';

const dataset: NetworkDataset = {
  formatVersion: 7,
  source: { url: 'saved', generatedAt: '2026-09-26T12:00:00Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'agency', name: 'Agency' }],
  routes: [
    { id: 'line', agencyId: 'agency', shortName: 'M-1', longName: 'Cádiz–Rota', type: 3, color: null, textColor: null },
  ],
  municipalities: [
    { id: 'cadiz', name: 'Cádiz' },
    { id: 'rota', name: 'Rota' },
  ],
  localAreas: [
    { id: 'town', name: 'Cádiz', municipalityId: 'cadiz', referencePoint: null },
    { id: 'beach', name: 'Playa', municipalityId: 'cadiz', referencePoint: null },
  ],
  stops: [
    {
      id: 'a',
      name: 'Avenida',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'cadiz',
      localAreaId: 'town',
    },
    {
      id: 'b',
      name: 'Playa',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'cadiz',
      localAreaId: 'beach',
    },
    {
      id: 'c',
      name: 'Rota',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'rota',
      localAreaId: null,
    },
  ],
  trips: [
    {
      id: 'outbound',
      routeId: 'line',
      serviceId: 'daily',
      stopTimes: [
        { stopId: 'a', arrivalMinutes: 600, departureMinutes: 600, pickupType: 0, dropOffType: 0 },
        { stopId: 'b', arrivalMinutes: 620, departureMinutes: 620, pickupType: 0, dropOffType: 0 },
        { stopId: 'c', arrivalMinutes: 650, departureMinutes: 650, pickupType: 0, dropOffType: 0 },
      ],
    },
    {
      id: 'variant',
      routeId: 'line',
      serviceId: 'daily',
      stopTimes: [
        { stopId: 'a', arrivalMinutes: 700, departureMinutes: 700, pickupType: 0, dropOffType: 0 },
        { stopId: 'c', arrivalMinutes: 750, departureMinutes: 750, pickupType: 0, dropOffType: 0 },
      ],
    },
  ],
  serviceDates: [{ serviceId: 'daily', dates: ['2026-09-26'] }],
  coverage: { startDate: '2026-09-26', endDate: '2026-09-26' },
};

const options = createLocationOptions(
  [
    { id: 'cadiz', name: 'Cádiz', municipalityId: 'cadiz' },
    { id: 'cadiz-town', name: 'Cádiz', localAreaId: 'town' },
    { id: 'playa', name: 'Playa', localAreaId: 'beach' },
  ],
  dataset,
);

test('a broad place includes child stops while one area keeps its narrower scope', () => {
  const broad = options.find((option) => option.kind === 'place' && option.id === 'cadiz');
  const beach = options.find((option) => option.kind === 'place' && option.id === 'playa');
  assert.equal(broad?.kind, 'place');
  assert.equal(beach?.kind, 'place');
  if (broad?.kind !== 'place' || beach?.kind !== 'place') return;
  assert.deepEqual(
    stopsForPlace(dataset, broad).map((stop) => stop.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    stopsForPlace(dataset, beach).map((stop) => stop.id),
    ['b'],
  );
  assert.deepEqual(
    linesForStops(dataset, stopsForPlace(dataset, broad)).map((route) => route.id),
    ['line'],
  );
});

test('a line keeps directions and variants as ordered paths while grouping repeated trips', () => {
  const repeatedTrip = { ...dataset.trips[0]!, id: 'repeated' };
  const reverseTrip = {
    ...dataset.trips[0]!,
    id: 'reverse',
    stopTimes: [...dataset.trips[0]!.stopTimes].reverse().map((time, index) => ({
      ...time,
      arrivalMinutes: 800 + index * 10,
      departureMinutes: 800 + index * 10,
    })),
  };
  const paths = lineStopPatterns({ ...dataset, trips: [...dataset.trips, repeatedTrip, reverseTrip] }, 'line');
  assert.deepEqual(
    paths.map((path) => ({ stops: path.stops.map((stop) => stop.id), tripCount: path.tripCount })),
    [
      { stops: ['a', 'b', 'c'], tripCount: 2 },
      { stops: ['a', 'c'], tripCount: 1 },
      { stops: ['c', 'b', 'a'], tripCount: 1 },
    ],
  );
  assert.deepEqual(
    filterLineStopPatterns(dataset, paths, 'Pláya').map((path) => path.stops.map((stop) => stop.id)),
    [
      ['a', 'b', 'c'],
      ['c', 'b', 'a'],
    ],
  );
  assert.equal(filterLineStopPatterns(dataset, paths, '').length, 3);
  assert.equal(stopLocality(dataset, dataset.stops[2]!), 'Rota');
  assert.equal(matchesBrowseQuery('Cádiz–Rota', 'cadiz'), true);
});

test('line links use the label alone and do not accept source IDs or old tokens', () => {
  const line = { ...dataset.routes[0]!, id: '2_6', shortName: 'M-030' };
  assert.equal(lineUrl(line, [line]), '/explore/lines/m-030');
  assert.equal(lineFromUrl([line], 'm-030')?.id, line.id);
  assert.equal(lineFromUrl([line], '2_6'), undefined);
  assert.equal(lineFromUrl([line], 'm-030-zcxr61w8'), undefined);
  assert.equal(
    lineUrl({ ...line, shortName: null, longName: null }, [{ ...line, shortName: null, longName: null }]),
    '/explore/lines/line',
  );
});

test('repeated line labels use distinct official descriptions', () => {
  const first = { ...dataset.routes[0]!, id: 'one', shortName: 'M-030', longName: 'Cádiz–Hospital' };
  const second = { ...first, id: 'two', longName: 'Cádiz–Campus' };
  const routes = [first, second];
  assert.equal(lineUrl(first, routes), '/explore/lines/m-030-cadiz-hospital');
  assert.equal(lineUrl(second, routes), '/explore/lines/m-030-cadiz-campus');
  assert.equal(lineFromUrl(routes, 'm-030-cadiz-campus')?.id, 'two');
  assert.doesNotThrow(() => validateLineUrls(routes));
  assert.throws(
    () => validateLineUrls([first, { ...second, longName: first.longName }]),
    /distinct route descriptions/,
  );
});

test('the reviewed network snapshot has distinct readable line paths', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../../../public/data/bahia-cadiz-network.json', import.meta.url), 'utf8'),
  ) as NetworkDataset;
  assert.doesNotThrow(() => validateLineUrls(snapshot.routes));
});

test('browse links prefill the existing search without running an incomplete journey', () => {
  const broad = options.find((option) => option.kind === 'place' && option.id === 'cadiz');
  assert.equal(broad?.kind, 'place');
  if (broad?.kind !== 'place') return;
  const placeUrl = originSearchUrl(broad);
  assert.equal(placeUrl, '/?from=cadiz/all');
  const stopUrl = originSearchUrl({ kind: 'stop', id: 'a', name: 'Avenida' });
  assert.equal(
    resolveSearchUrl(new URL(placeUrl, 'https://example.test').search, options, dataset.coverage, '2026-09-26').origin
      ?.id,
    'cadiz',
  );
  const restoredStop = resolveSearchUrl(
    new URL(stopUrl, 'https://example.test').search,
    options,
    dataset.coverage,
    '2026-09-26',
  );
  assert.equal(restoredStop.origin?.id, 'a');
  assert.equal(restoredStop.complete, false);
});
