/** Exercises local direct journeys with small timetables, without an upstream service. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { madridToday } from '../../../src/data/calendar-date.ts';
import {
  alightableTripStopIndices,
  boardableTripStopIndices,
  findDirectJourneys,
} from '../../../src/data/direct-journeys.ts';
import type { NetworkDataset } from '../../../src/data/network-schema.ts';
import type { LocationOption } from '../../../src/data/location-search.ts';

const stop = (id: string, municipalityId: string | null = null, localAreaId: string | null = null) => ({
  id,
  name: id,
  latitude: 36.5,
  longitude: -6.2,
  parentStationId: null,
  municipalityId,
  localAreaId,
});
const time = (stopId: string, minute: number, pickupType = 0, dropOffType = 0) => ({
  stopId,
  arrivalMinutes: minute,
  departureMinutes: minute,
  pickupType,
  dropOffType,
});
const dataset: NetworkDataset = {
  formatVersion: 7,
  source: { url: 'source', generatedAt: '2026-09-21T15:15:44.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bay' }],
  routes: [{ id: 'line', agencyId: 'CMTBC', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  municipalities: [
    { id: 'cadiz', name: 'Cádiz' },
    { id: 'rota', name: 'Rota' },
  ],
  localAreas: [],
  stops: [stop('a', 'cadiz'), stop('a2', 'cadiz'), stop('b', 'rota'), stop('b2', 'rota'), stop('road')],
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
  serviceDates: [
    { serviceId: 'weekday', dates: ['2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25'] },
    { serviceId: 'added', dates: ['2026-09-23'] },
  ],
  coverage: { startDate: '2026-09-21', endDate: '2026-09-27' },
};
const cadiz: LocationOption = { kind: 'place', id: 'cadiz', name: 'Cádiz', municipalityId: 'cadiz' };
const rota: LocationOption = { kind: 'place', id: 'rota', name: 'Rota', municipalityId: 'rota' };
const exactA: LocationOption = { kind: 'stop', id: 'a', name: 'A', routeLabels: [] };
const exactB: LocationOption = { kind: 'stop', id: 'b', name: 'B', routeLabels: [] };

test('returns one trip card with reachable alternatives and respects stop direction', () => {
  const { later: journeys } = findDirectJourneys(dataset, '2026-09-22', cadiz, rota);
  assert.deepEqual(
    journeys.map((journey) => journey.trip.id),
    ['night', 'morning', 'night'],
  );
  assert.equal(journeys[1]?.trip.stopTimes[journeys[1].boardingIndex]?.stopId, 'a');
  assert.equal(journeys[1]?.trip.stopTimes[journeys[1].alightingIndex]?.stopId, 'b');
  assert.deepEqual(boardableTripStopIndices(journeys[1]!.trip), [0, 1, 2]);
  assert.deepEqual(alightableTripStopIndices(journeys[1]!.trip, 0), [1, 2, 3]);
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', exactA, exactB).later.map((journey) => journey.trip.id),
    ['morning', 'night'],
  );
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', exactB, exactA).later.map((journey) => journey.trip.id),
    ['reverse'],
  );
});

test('uses resolved service dates and includes after-midnight boarding from yesterday', () => {
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-23', cadiz, rota).later.map((journey) => journey.trip.id),
    ['night', 'added'],
  );
  const afterMidnight = findDirectJourneys(
    dataset,
    '2026-09-23',
    { kind: 'stop', id: 'a2', name: 'A2', routeLabels: [] },
    rota,
  ).later[0]!;
  assert.equal(afterMidnight.departureMinute, 10);
  assert.equal(
    afterMidnight.trip.stopTimes[afterMidnight.alightingIndex]!.arrivalMinutes + afterMidnight.minuteOffset,
    60,
  );
  assert.equal(afterMidnight.serviceDate, '2026-09-22');
});

test('handles no results, forbidden pickup, same stop, and expired coverage', () => {
  const empty = { earlier: [], later: [] };
  assert.deepEqual(findDirectJourneys(dataset, '2026-09-22', exactA, exactA), empty);
  assert.deepEqual(findDirectJourneys(dataset, '2027-01-01', cadiz, rota), empty);
  assert.deepEqual(findDirectJourneys(dataset, '2026-09-27', cadiz, rota), empty);
  assert.deepEqual(
    findDirectJourneys(dataset, '2026-09-22', { kind: 'stop', id: 'road', name: 'Road', routeLabels: [] }, rota),
    empty,
  );
  assert.ok(
    !findDirectJourneys(dataset, '2026-09-22', cadiz, rota).later.some((journey) => journey.trip.id === 'no-pickup'),
  );
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
  const { later } = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB);
  assert.deepEqual(
    later.map(({ trip, boardingIndex, alightingIndex }) => ({
      trip: trip.id,
      board: trip.stopTimes[boardingIndex]?.stopId,
      alight: trip.stopTimes[alightingIndex]?.stopId,
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
  const closest = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB).later.find(
    (journey) => journey.trip.id === 'both',
  )!;
  assert.equal(closest.trip.stopTimes[closest.boardingIndex]?.stopId, 'a-town');
  assert.equal(closest.departureMinute, 610);

  const withoutPoints: NetworkDataset = {
    ...hierarchyDataset,
    localAreas: hierarchyDataset.localAreas.map((localArea) => ({ ...localArea, referencePoint: null })),
  };
  const earliest = findDirectJourneys(withoutPoints, '2026-09-22', townA, townB).later.find(
    (journey) => journey.trip.id === 'both',
  )!;
  assert.equal(earliest.trip.stopTimes[earliest.boardingIndex]?.stopId, 'a-out');
  assert.equal(earliest.departureMinute, 600);
});

test('matches a named local area and applies the cutoff before proximity ranking', () => {
  const localAreaB: LocationOption = { kind: 'place', id: 'b-localArea', name: 'Town B', localAreaId: 'b-town' };
  assert.deepEqual(
    findDirectJourneys(hierarchyDataset, '2026-09-22', townA, localAreaB).later.map((journey) => journey.trip.id),
    ['conflict', 'both', 'cutoff'],
  );
  const results = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB, '13:30');
  assert.deepEqual(
    results.earlier.map((journey) => journey.trip.id),
    ['conflict', 'both', 'outlying-only'],
  );
  const cutoff = results.later.find((journey) => journey.trip.id === 'cutoff')!;
  assert.equal(cutoff.trip.stopTimes[cutoff.boardingIndex]?.stopId, 'a-out');
  assert.equal(cutoff.departureMinute, 810);
  const pastCutoff = findDirectJourneys(hierarchyDataset, '2026-09-22', townA, townB, '13:31');
  assert.equal(pastCutoff.later.length, 0);
  const lastEarlier = pastCutoff.earlier.at(-1)!;
  assert.equal(lastEarlier.trip.stopTimes[lastEarlier.boardingIndex]?.stopId, 'a-town');
});

test('accepts a unique shortened town name and ignores a municipality with no town-area match', () => {
  const shortened: NetworkDataset = {
    ...hierarchyDataset,
    municipalities: [
      { id: 'a', name: 'Town A de la Frontera' },
      { id: 'b', name: 'Town B' },
    ],
  };
  const shortenedJourneys = findDirectJourneys(shortened, '2026-09-22', townA, townB).later;
  assert.equal(shortenedJourneys[0]?.trip.id, 'conflict');
  const shortenedTown = shortenedJourneys.find((journey) => journey.trip.id === 'both')!;
  assert.equal(shortenedTown.trip.stopTimes[shortenedTown.boardingIndex]?.stopId, 'a-town');

  const unmatched: NetworkDataset = {
    ...hierarchyDataset,
    municipalities: [
      { id: 'a', name: 'Another Place' },
      { id: 'b', name: 'Town B' },
    ],
  };
  const exactOutlying: LocationOption = { kind: 'stop', id: 'b-out', name: 'B Outer', routeLabels: [] };
  const [withoutTown] = findDirectJourneys(unmatched, '2026-09-22', townA, exactOutlying).later;
  assert.equal(withoutTown?.trip.id, 'conflict');
  assert.equal(withoutTown.trip.stopTimes[withoutTown.boardingIndex]?.stopId, 'a-out');
  const [destinationOnly] = findDirectJourneys(unmatched, '2026-09-22', townA, townB).later;
  assert.equal(destinationOnly?.trip.id, 'conflict');
  assert.equal(destinationOnly.alightingIndex, 1);

  const ambiguous: NetworkDataset = {
    ...shortened,
    localAreas: [
      ...shortened.localAreas,
      { id: 'another-prefix', municipalityId: 'a', name: 'Town', referencePoint: null },
    ],
  };
  const [withoutUniqueTown] = findDirectJourneys(ambiguous, '2026-09-22', townA, exactOutlying).later;
  assert.equal(withoutUniqueTown?.trip.id, 'conflict');
  assert.equal(withoutUniqueTown.trip.stopTimes[withoutUniqueTown.boardingIndex]?.stopId, 'a-out');
});
