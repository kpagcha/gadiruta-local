/** Exercises local direct journeys with small timetables, without an upstream service. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { madridToday } from '../../../src/data/calendar-date.ts';
import { findDirectJourneys, splitDirectJourneys } from '../../../src/data/direct-journeys.ts';
import type { NetworkDataset } from '../../../src/data/network-schema.ts';
import type { LocationOption } from '../../../src/data/location-search.ts';

const stop = (id: string, placeId: string | null) => ({
  id,
  name: id,
  latitude: 36.5,
  longitude: -6.2,
  parentStationId: null,
  placeId,
  municipalityId: null,
  localAreaId: null,
});
const time = (stopId: string, minute: number, pickupType = 0, dropOffType = 0) => ({
  stopId,
  arrivalMinutes: minute,
  departureMinutes: minute,
  pickupType,
  dropOffType,
});
const dataset: NetworkDataset = {
  formatVersion: 5,
  source: { url: 'source', generatedAt: '2026-09-21T15:15:44.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bay' }],
  routes: [{ id: 'line', agencyId: 'CMTBC', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  municipalities: [],
  localAreas: [],
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

const hierarchyDataset: NetworkDataset = {
  ...dataset,
  municipalities: [
    { id: 'a', name: 'Town A' },
    { id: 'b', name: 'Town B' },
  ],
  localAreas: [
    { id: 'a-out', municipalityId: 'a', name: 'A Outer', referencePoint: { latitude: 0, longitude: 1 } },
    { id: 'a-town', municipalityId: 'a', name: 'Town A', referencePoint: { latitude: 0, longitude: 0 } },
    { id: 'b-out', municipalityId: 'b', name: 'B Outer', referencePoint: { latitude: 0, longitude: 11 } },
    { id: 'b-town', municipalityId: 'b', name: 'Town B', referencePoint: { latitude: 0, longitude: 10 } },
  ],
  stops: [
    { ...stop('a-out', null), latitude: 0, longitude: 1, municipalityId: 'a', localAreaId: 'a-out' },
    { ...stop('a-town', null), latitude: 0, longitude: 0, municipalityId: 'a', localAreaId: 'a-town' },
    { ...stop('b-out', null), latitude: 0, longitude: 12, municipalityId: 'b', localAreaId: 'b-out' },
    { ...stop('b-town', null), latitude: 0, longitude: 10, municipalityId: 'b', localAreaId: 'b-town' },
  ],
  patterns: [{ routeId: 'line', directionId: '0', stopIds: ['a-out', 'a-town', 'b-out', 'b-town'] }],
  trips: [
    {
      id: 'conflict',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a-out', 480), time('b-town', 490), time('a-town', 500), time('b-out', 510)],
    },
    {
      id: 'both',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a-out', 600), time('a-town', 610), time('b-out', 630), time('b-town', 640)],
    },
    {
      id: 'outlying-only',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a-out', 700), time('b-out', 730)],
    },
    {
      id: 'cutoff',
      routeId: 'line',
      serviceId: 'weekday',
      stopTimes: [time('a-town', 800), time('a-out', 810), time('b-town', 840)],
    },
  ],
};
const townA: LocationOption = { kind: 'place', id: 'town-a', name: 'Town A', municipalityId: 'a' };
const townB: LocationOption = { kind: 'place', id: 'town-b', name: 'Town B', municipalityId: 'b' };

test('covers every local area and selects the nearest valid pair on each trip', () => {
  const journeys = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB);
  const { later } = splitDirectJourneys(journeys, '');
  assert.deepEqual(
    later.map(({ journey, boardingIndex, alightingIndex }) => ({
      trip: journey.tripId,
      board: journey.boardings[boardingIndex]?.stopId,
      alight: journey.boardings[boardingIndex]?.alightings.find((choice) => choice.index === alightingIndex)?.stopId,
    })),
    [
      { trip: 'conflict', board: 'a-out', alight: 'b-town' },
      { trip: 'both', board: 'a-town', alight: 'b-town' },
      { trip: 'outlying-only', board: 'a-out', alight: 'b-out' },
      { trip: 'cutoff', board: 'a-town', alight: 'b-town' },
    ],
  );
});

test('may board later for a closer pair, then returns to the earliest pair without reference points', () => {
  const withPoints = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB).find(
    (journey) => journey.tripId === 'both',
  )!;
  const closest = splitDirectJourneys([withPoints], '').later[0]!;
  assert.equal(withPoints.boardings[closest.boardingIndex]?.stopId, 'a-town');
  assert.equal(closest.departureMinute, 610);

  const withoutPoints: NetworkDataset = {
    ...hierarchyDataset,
    localAreas: hierarchyDataset.localAreas.map((localArea) => ({ ...localArea, referencePoint: null })),
  };
  const without = findDirectJourneys(withoutPoints, '2026-09-22', townA, townB).find(
    (journey) => journey.tripId === 'both',
  )!;
  const earliest = splitDirectJourneys([without], '').later[0]!;
  assert.equal(without.boardings[earliest.boardingIndex]?.stopId, 'a-out');
  assert.equal(earliest.departureMinute, 600);
});

test('matches a named local area and applies the cutoff before proximity ranking', () => {
  const localAreaB: LocationOption = { kind: 'place', id: 'b-localArea', name: 'Town B', localAreaId: 'b-town' };
  assert.deepEqual(
    findDirectJourneys(hierarchyDataset, '2026-09-22', townA, localAreaB).map((journey) => journey.tripId),
    ['conflict', 'both', 'cutoff'],
  );
  const cutoff = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB).find(
    (journey) => journey.tripId === 'cutoff',
  )!;
  const { later } = splitDirectJourneys([cutoff], '13:25');
  assert.equal(cutoff.boardings[later[0]!.boardingIndex]?.stopId, 'a-out');
  assert.equal(later[0]?.departureMinute, 810);
});

test('uses CTAN membership over an older conflicting place assignment', () => {
  const conflictingAssignment: NetworkDataset = {
    ...hierarchyDataset,
    stops: hierarchyDataset.stops.map((stop) => (stop.id === 'a-out' ? { ...stop, placeId: 'town-b' } : stop)),
  };
  const exactTownB: LocationOption = { kind: 'stop', id: 'b-town', name: 'Town B stop', routeLabels: [] };
  const journeys = findDirectJourneys(conflictingAssignment, '2026-09-22', townB, exactTownB);
  assert.equal(
    journeys.some((journey) => journey.tripId === 'conflict'),
    false,
  );
});

test('accepts a unique shortened town name and ignores a municipality with no town-area match', () => {
  const shortened: NetworkDataset = {
    ...hierarchyDataset,
    municipalities: [
      { id: 'a', name: 'Town A de la Frontera' },
      { id: 'b', name: 'Town B' },
    ],
  };
  const [conflict] = findDirectJourneys(shortened, '2026-09-22', townA, townB);
  assert.equal(conflict?.tripId, 'conflict');
  assert.equal(conflict.boardings.find((boarding) => boarding.stopId === 'a-town')?.distanceKm, 0);
  assert.ok((conflict.boardings.find((boarding) => boarding.stopId === 'a-out')?.distanceKm ?? 0) > 0);

  const unmatched: NetworkDataset = {
    ...hierarchyDataset,
    municipalities: [
      { id: 'a', name: 'Another Place' },
      { id: 'b', name: 'Town B' },
    ],
  };
  const exactOutlying: LocationOption = { kind: 'stop', id: 'b-out', name: 'B Outer', routeLabels: [] };
  const [withoutTown] = findDirectJourneys(unmatched, '2026-09-22', townA, exactOutlying);
  assert.equal(withoutTown?.tripId, 'conflict');
  assert.equal(withoutTown.boardings[splitDirectJourneys([withoutTown], '').later[0]!.boardingIndex]?.stopId, 'a-out');
  const [destinationOnly] = findDirectJourneys(unmatched, '2026-09-22', townA, townB);
  assert.equal(destinationOnly?.tripId, 'conflict');
  assert.equal(splitDirectJourneys([destinationOnly], '').later[0]?.alightingIndex, 1);

  const ambiguous: NetworkDataset = {
    ...shortened,
    localAreas: [
      ...shortened.localAreas,
      { id: 'another-prefix', municipalityId: 'a', name: 'Town', referencePoint: null },
    ],
  };
  const [withoutUniqueTown] = findDirectJourneys(ambiguous, '2026-09-22', townA, exactOutlying);
  assert.equal(withoutUniqueTown?.tripId, 'conflict');
  assert.equal(
    withoutUniqueTown.boardings[splitDirectJourneys([withoutUniqueTown], '').later[0]!.boardingIndex]?.stopId,
    'a-out',
  );
});
