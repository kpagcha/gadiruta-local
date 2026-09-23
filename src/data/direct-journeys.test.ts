/** Exercises local direct journeys with small timetables, without an upstream service. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { findDirectJourneys, madridToday } from './direct-journeys.ts';
import type { NetworkDataset } from './network-schema.ts';
import type { LocationOption } from './location-search.ts';

const stop = (id: string, placeId: string | null) => ({
  id,
  name: id,
  latitude: 36.5,
  longitude: -6.2,
  parentStationId: null,
  placeId,
});
const time = (stopId: string, minute: number, pickupType = 0, dropOffType = 0) => ({
  stopId,
  arrivalMinutes: minute,
  departureMinutes: minute,
  pickupType,
  dropOffType,
});
const dataset: NetworkDataset = {
  formatVersion: 2,
  source: { url: 'source', generatedAt: '2026-09-21T15:15:44.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bay' }],
  routes: [{ id: 'line', agencyId: 'CMTBC', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  stops: [stop('a', 'cadiz'), stop('a2', 'cadiz'), stop('b', 'rota'), stop('b2', 'rota'), stop('road', null)],
  patterns: [{ routeId: 'line', directionId: '0', stopIds: ['a', 'a2', 'b', 'b2'] }],
  trips: [
    {
      id: 'morning',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a', 480), time('a2', 490), time('b', 530), time('b2', 540)],
    },
    { id: 'reverse', routeId: 'line', serviceId: 'weekday', stopTimes: [time('b', 550), time('a', 600)] },
    {
      id: 'night',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a', 1430), time('a2', 1450), time('b', 1500)],
    },
    { id: 'added', routeId: 'line', serviceId: 'added', stopTimes: [time('a', 700), time('b', 750)] },
    { id: 'no-pickup', routeId: 'line', serviceId: 'weekday', stopTimes: [time('a', 800, 1), time('b', 850)] },
  ],
  calendars: [
    {
      serviceId: 'weekday',
      startDate: '2026-09-21',
      endDate: '2026-09-27',
      weekdays: [true, true, true, true, true, false, false],
    },
    {
      serviceId: 'added',
      startDate: '2026-09-21',
      endDate: '2026-09-27',
      weekdays: [false, false, false, false, false, false, false],
    },
  ],
  calendarExceptions: [
    { serviceId: 'weekday', date: '2026-09-23', type: 2 },
    { serviceId: 'added', date: '2026-09-23', type: 1 },
  ],
  coverage: { startDate: '2026-09-21', endDate: '2026-09-27' },
};
const cadiz: LocationOption = { kind: 'place', id: 'cadiz', name: 'Cádiz' };
const rota: LocationOption = { kind: 'place', id: 'rota', name: 'Rota' };
const exactA: LocationOption = { kind: 'stop', id: 'a', name: 'A', routeLabels: [] };
const exactB: LocationOption = { kind: 'stop', id: 'b', name: 'B', routeLabels: [] };

test('returns one trip card with reachable alternatives and respects stop direction', () => {
  const journeys = findDirectJourneys(dataset, '2026-09-22', cadiz, rota);
  assert.deepEqual(
    journeys.map((journey) => journey.tripId),
    ['night', 'morning', 'night'],
  );
  assert.deepEqual(
    journeys[1]?.boardings.map((boarding) => boarding.stopId),
    ['a', 'a2'],
  );
  assert.deepEqual(
    journeys[1]?.boardings[0]?.alightings.map((choice) => choice.stopId),
    ['b', 'b2'],
  );
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', exactA, exactB).map((journey) => journey.tripId),
    ['morning', 'night'],
  );
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', exactB, exactA).map((journey) => journey.tripId),
    ['reverse'],
  );
});

test('applies exceptions and includes after-midnight boarding from yesterday', () => {
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-23', cadiz, rota).map((journey) => journey.tripId),
    ['night', 'added'],
  );
  const afterMidnight = findDirectJourneys(
    dataset,
    '2026-09-23',
    { kind: 'stop', id: 'a2', name: 'A2', routeLabels: [] },
    rota,
  );
  assert.equal(afterMidnight[0]?.boardings[0]?.departureMinute, 10);
  assert.equal(afterMidnight[0]?.boardings[0]?.alightings[0]?.arrivalMinute, 60);
});

test('handles no results, forbidden pickup, same stop, and expired coverage', () => {
  assert.deepEqual(findDirectJourneys(dataset, '2026-09-22', exactA, exactA), []);
  assert.deepEqual(findDirectJourneys(dataset, '2027-01-01', cadiz, rota), []);
  assert.deepEqual(findDirectJourneys(dataset, '2026-09-27', cadiz, rota), []);
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', { kind: 'stop', id: 'road', name: 'Road', routeLabels: [] }, rota),
    [],
  );
  assert.ok(!findDirectJourneys(dataset, '2026-09-22', cadiz, rota).some((journey) => journey.tripId === 'no-pickup'));
});

test('uses the Madrid calendar date around UTC midnight', () => {
  assert.equal(madridToday(new Date('2026-09-22T22:30:00Z')), '2026-09-23');
});
