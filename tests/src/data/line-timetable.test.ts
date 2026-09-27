/** Check that shared line links select one exact path and use calendar dates across midnight. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { datedLineTrips, datedLineUrl, lineDateFromQuery, linePathAlias } from '../../../src/data/line-timetable.ts';
import { lineStopPatterns } from '../../../src/data/network-browse.ts';
import type { NetworkDataset, NetworkTrip } from '../../../src/data/network-schema.ts';

/** Make one exact scheduled stop visit for the small timetable fixture. */
const stopTime = (stopId: string, minute: number): NetworkTrip['stopTimes'][number] => ({
  stopId,
  arrivalMinutes: minute,
  departureMinutes: minute,
  pickupType: 0,
  dropOffType: 0,
});

const dataset: NetworkDataset = {
  formatVersion: 7,
  source: { url: 'saved', generatedAt: '2026-09-26T12:00:00Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'agency', name: 'Agency' }],
  routes: [{ id: 'line', agencyId: 'agency', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  municipalities: [
    { id: 'cadiz', name: 'Cádiz' },
    { id: 'rota', name: 'Rota' },
  ],
  localAreas: [],
  stops: [
    {
      id: 'a',
      name: 'Origin',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'cadiz',
      localAreaId: null,
    },
    {
      id: 'b',
      name: 'Middle',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'cadiz',
      localAreaId: null,
    },
    {
      id: 'c',
      name: 'Terminus',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: 'rota',
      localAreaId: null,
    },
  ],
  trips: [
    {
      id: 'day',
      routeId: 'line',
      serviceId: 'day',
      stopTimes: [stopTime('a', 540), stopTime('b', 560), stopTime('c', 580)],
    },
    { id: 'variant', routeId: 'line', serviceId: 'day', stopTimes: [stopTime('a', 600), stopTime('c', 630)] },
    {
      id: 'night',
      routeId: 'line',
      serviceId: 'night',
      stopTimes: [stopTime('a', 1425), stopTime('b', 1445), stopTime('c', 1470)],
    },
  ],
  serviceDates: [
    { serviceId: 'day', dates: ['2026-09-27'] },
    { serviceId: 'night', dates: ['2026-09-26'] },
  ],
  coverage: { startDate: '2026-09-27', endDate: '2026-09-27' },
};

test('a dated line link names the trip’s exact ordered path', () => {
  const patterns = lineStopPatterns(dataset, 'line');
  const alias = linePathAlias(
    dataset,
    patterns.find((pattern) => pattern.stops.length === 3)!,
    patterns,
  );
  assert.equal(alias, 'cadiz-to-rota-3-stops');
  assert.equal(
    datedLineUrl(dataset, dataset.routes[0]!, dataset.trips[0]!, '2026-09-27'),
    '/explore/lines/m-1?path=cadiz-to-rota-3-stops&date=2026-09-27',
  );
});

test('the selected calendar day includes its own exact trips and overnight arrivals from yesterday', () => {
  const pattern = lineStopPatterns(dataset, 'line').find((item) => item.stops.length === 3)!;
  const runs = datedLineTrips(dataset, 'line', pattern, '2026-09-27');
  assert.deepEqual(
    runs.map((run) => [run.trip.id, run.firstMinute]),
    [
      ['night', 5],
      ['day', 540],
    ],
  );
  assert.equal(lineDateFromQuery('2026-09-26', dataset.coverage), null);
});

test('every reviewed line path has a distinct readable alias', () => {
  const snapshot = JSON.parse(readFileSync('public/data/bahia-cadiz-network.json', 'utf8')) as NetworkDataset;
  for (const route of snapshot.routes) {
    const patterns = lineStopPatterns(snapshot, route.id);
    const aliases = patterns.map((pattern) => linePathAlias(snapshot, pattern, patterns));
    assert.equal(new Set(aliases).size, aliases.length, route.id);
  }
});
