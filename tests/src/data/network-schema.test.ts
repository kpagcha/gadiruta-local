/** Checks that the browser rejects broken timetable assets before searching them. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNetworkDataset } from '../../../src/data/network-schema.ts';

const dataset = {
  formatVersion: 6,
  source: { url: 'source', generatedAt: '2026-09-21T15:15:44.000Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [{ id: 'route', agencyId: 'CMTBC', shortName: 'M-1', longName: null, type: 3, color: null, textColor: null }],
  municipalities: [],
  localAreas: [],
  stops: [
    {
      id: 'a',
      name: 'A',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
    {
      id: 'b',
      name: 'B',
      latitude: 36.6,
      longitude: -6.3,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
  ],
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

test('accepts the version-six timetable contract', () => {
  assert.deepEqual(parseNetworkDataset(dataset), dataset);
  assert.throws(() => parseNetworkDataset({ ...dataset, formatVersion: 5 }), /formatVersion must be 6/);
});

test('rejects duplicate IDs, invalid primitives, missing nullable fields', () => {
  assert.throws(() => parseNetworkDataset({ ...dataset, stops: [dataset.stops[0], dataset.stops[0]] }), /duplicate ID/);
  assert.throws(
    () => parseNetworkDataset({ ...dataset, stops: [{ ...dataset.stops[0], latitude: '36.5' }] }),
    /latitude/,
  );
  assert.throws(() => parseNetworkDataset({ ...dataset, stops: [{ ...dataset.stops[0], latitude: NaN }] }), /latitude/);
  assert.throws(() => parseNetworkDataset({ ...dataset, routes: [{ ...dataset.routes[0], id: ' ' }] }), /non-empty/);
  assert.throws(
    () => parseNetworkDataset({ ...dataset, source: { ...dataset.source, archiveSha256: 'bad' } }),
    /SHA-256/,
  );
});

test('rejects broken stop, route, and service references', () => {
  const trip = dataset.trips[0]!;
  assert.throws(
    () => parseNetworkDataset({ ...dataset, trips: [{ ...trip, serviceId: 'missing' }] }),
    /unknown route, service, or stop/,
  );
  assert.throws(
    () =>
      parseNetworkDataset({
        ...dataset,
        trips: [{ ...trip, stopTimes: [{ ...trip.stopTimes[0], stopId: 'missing' }, trip.stopTimes[1]] }],
      }),
    /unknown route, service, or stop/,
  );
});

test('validates municipality and local-area relationships while allowing an unresolved local area', () => {
  const withLocations = {
    ...dataset,
    municipalities: [{ id: 'municipality', name: 'Municipality' }],
    localAreas: [{ id: 'localArea', municipalityId: 'municipality', name: 'Town', referencePoint: null }],
    stops: [
      { ...dataset.stops[0], municipalityId: 'municipality', localAreaId: 'localArea' },
      { ...dataset.stops[1], municipalityId: 'municipality', localAreaId: null },
    ],
  };
  assert.deepEqual(parseNetworkDataset(withLocations), withLocations);
  assert.throws(
    () =>
      parseNetworkDataset({
        ...withLocations,
        localAreas: [{ id: 'localArea', municipalityId: 'municipality', name: 'Town' }],
      }),
    /referencePoint/,
  );
  assert.throws(
    () =>
      parseNetworkDataset({
        ...withLocations,
        localAreas: [{ ...withLocations.localAreas[0], referencePoint: { latitude: 91, longitude: 0 } }],
      }),
    /invalid reference coordinates/,
  );
  assert.throws(
    () =>
      parseNetworkDataset({
        ...withLocations,
        stops: [{ ...withLocations.stops[0], municipalityId: 'other' }, withLocations.stops[1]],
      }),
    /unknown municipality/,
  );
  assert.throws(
    () =>
      parseNetworkDataset({
        ...withLocations,
        stops: [{ ...withLocations.stops[0], localAreaId: 'other' }, withLocations.stops[1]],
      }),
    /local area outside its municipality/,
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
    () => parseNetworkDataset({ ...dataset, coverage: { startDate: '2026-09-03', endDate: '2026-12-31' } }),
    /coverage/,
  );
});
