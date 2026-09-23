/** Checks that the browser rejects broken timetable assets before searching them. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkDataset } from './network-schema.ts';

const dataset = {
  formatVersion: 2,
  source: { url: 'source', generatedAt: '2026-09-21T15:15:44.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [{ id: 'route', agencyId: 'CMTBC', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  stops: [
    { id: 'a', name: 'A', latitude: 36.5, longitude: -6.2, parentStationId: null, placeId: 'cadiz' },
    { id: 'b', name: 'B', latitude: 36.6, longitude: -6.3, parentStationId: null, placeId: null },
  ],
  patterns: [{ routeId: 'route', directionId: '0', stopIds: ['a', 'b'] }],
  trips: [
    {
      id: 'trip',
      routeId: 'route',
      serviceId: 'daily',
      stopTimes: [
        { stopId: 'a', arrivalMinutes: 480, departureMinutes: 480, pickupType: 0, dropOffType: 1 },
        { stopId: 'b', arrivalMinutes: 500, departureMinutes: 500, pickupType: 1, dropOffType: 0 },
      ],
    },
  ],
  calendars: [
    {
      serviceId: 'daily',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      weekdays: [true, true, true, true, true, true, true],
    },
  ],
  calendarExceptions: [{ serviceId: 'daily', date: '2026-09-25', type: 2 }],
  coverage: { startDate: '2026-09-01', endDate: '2026-12-31' },
};

test('accepts the version-two timetable contract', () => {
  assert.deepEqual(parseNetworkDataset(dataset), dataset);
});

test('rejects broken stop, route, service, and place references', () => {
  assert.throws(
    () => parseNetworkDataset({ ...dataset, trips: [{ ...dataset.trips[0], serviceId: 'missing' }] }),
    /unknown route, service, or stop/,
  );
  assert.throws(
    () => parseNetworkDataset({ ...dataset, stops: [{ ...dataset.stops[0], placeId: 'unknown' }, dataset.stops[1]] }),
    /unknown place/,
  );
  assert.throws(
    () => parseNetworkDataset({ ...dataset, patterns: [{ routeId: 'missing', directionId: null, stopIds: ['a'] }] }),
    /unknown route/,
  );
});

test('rejects invalid times, dates, and duplicate exceptions', () => {
  const trip = dataset.trips[0]!;
  assert.throws(
    () =>
      parseNetworkDataset({
        ...dataset,
        trips: [{ ...trip, stopTimes: [trip.stopTimes[0], { ...trip.stopTimes[1], arrivalMinutes: 470 }] }],
      }),
    /ordered/,
  );
  assert.throws(
    () => parseNetworkDataset({ ...dataset, calendars: [{ ...dataset.calendars[0], endDate: '2026-02-30' }] }),
    /valid YYYY-MM-DD/,
  );
  assert.throws(
    () =>
      parseNetworkDataset({
        ...dataset,
        calendarExceptions: [dataset.calendarExceptions[0], dataset.calendarExceptions[0]],
      }),
    /duplicated/,
  );
  assert.throws(
    () => parseNetworkDataset({ ...dataset, coverage: { startDate: '2026-09-02', endDate: '2026-12-31' } }),
    /coverage/,
  );
});
