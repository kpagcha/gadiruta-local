/** Checks the search submission boundary with a tiny local timetable and a fixed clock. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { submitJourneySearch, type TripSearchDraft } from '../../../src/data/journey-search.ts';
import type { NetworkDataset } from '../../../src/data/network-schema.ts';
import { resolveSearchUrl } from '../../../src/data/search-url.ts';

const origin = { kind: 'stop' as const, id: 'a', name: 'A', routeLabels: [] };
const destination = { kind: 'stop' as const, id: 'b', name: 'B', routeLabels: [] };
const dataset: NetworkDataset = {
  formatVersion: 5,
  source: { url: 'source', generatedAt: '2026-09-26T00:00:00Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'agency', name: 'Agency' }],
  routes: [
    { id: 'route', agencyId: 'agency', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null },
  ],
  municipalities: [],
  localAreas: [],
  stops: [origin, destination].map(({ id, name }) => ({
    id,
    name,
    latitude: 36,
    longitude: -6,
    parentStationId: null,
    placeId: null,
    municipalityId: null,
    localAreaId: null,
  })),
  patterns: [{ routeId: 'route', directionId: null, stopIds: ['a', 'b'] }],
  trips: [
    {
      id: 'trip',
      routeId: 'route',
      serviceId: 'daily',
      stopTimes: [
        { stopId: 'a', arrivalMinutes: 600, departureMinutes: 600, pickupType: 0, dropOffType: 1 },
        { stopId: 'b', arrivalMinutes: 630, departureMinutes: 630, pickupType: 1, dropOffType: 0 },
      ],
    },
  ],
  calendars: [
    {
      serviceId: 'daily',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      weekdays: [true, true, true, true, true, true, true],
    },
  ],
  calendarExceptions: [],
  coverage: { startDate: '2026-01-01', endDate: '2026-12-31' },
};
const draft: TripSearchDraft = {
  origin: { text: 'A', choice: origin },
  destination: { text: 'B', choice: destination },
  date: '2026-09-26',
  departAfter: '0907',
  departureMode: 'depart-at',
};
const now = new Date('2026-09-26T07:15:00Z');

test('normalizes committed times and produces results and a restorable link from the same criteria', () => {
  const submitted = submitJourneySearch(dataset, draft, now)!;
  assert.equal(submitted.search.departAfter, '09:07');
  assert.equal(submitted.result.later[0]?.trip.id, 'trip');
  assert.equal(submitted.result.earlier.length, 0);
  const restored = resolveSearchUrl(submitted.query, [origin, destination], dataset.coverage, draft.date);
  assert.equal(restored.complete, true);
  assert.equal(restored.origin?.id, origin.id);
  assert.equal(restored.departAfter, '09:07');
  assert.equal(draft.departAfter, '0907');
});

test('captures one Madrid instant for Leave now while keeping saved criteria relative', () => {
  const submitted = submitJourneySearch(
    dataset,
    { ...draft, departureMode: 'leave-now' },
    new Date('2026-09-26T22:05:00Z'),
  )!;
  assert.equal(submitted.search.date, '2026-09-27');
  assert.equal(submitted.result.later[0]?.trip.id, 'trip');
  assert.equal(submitted.search.departAfter, '');
  assert.equal(new URLSearchParams(submitted.query).get('mode'), 'now');
  assert.equal(new URLSearchParams(submitted.query).has('date'), false);
});

test('rejects unresolved, identical, past, invalid, and uncovered criteria before querying', () => {
  for (const invalid of [
    { ...draft, origin: { text: 'unfinished', choice: null } },
    { ...draft, destination: draft.origin },
    { ...draft, date: '2026-09-25' },
    { ...draft, date: '2026-02-30' },
    { ...draft, date: '2027-01-01' },
  ])
    assert.equal(submitJourneySearch(dataset, invalid, now), null);
});

test('unrecognized typed time retains the existing all-day search behavior', () => {
  const submitted = submitJourneySearch(dataset, { ...draft, departAfter: '25:99' }, now)!;
  assert.equal(submitted.result.later[0]?.trip.id, 'trip');
  assert.equal(submitted.result.earlier.length, 0);
  assert.equal(new URLSearchParams(submitted.query).has('depart_after'), false);
});
