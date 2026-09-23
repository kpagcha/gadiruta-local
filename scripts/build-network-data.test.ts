/**
 * Checks that the data scripts can read GTFS examples and produce the website's network timetable
 * JSON correctly. These tests use saved examples and do not download data from CTAN.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkData, createNetworkDataset } from './build-network-data.ts';
import { ctanMalformedQuoteArchiveFixture, topologyFixture } from './fixtures/gtfs-topology.ts';
import { parseCsv, readGtfsTable, readZipTextFiles } from './gtfs-archive.ts';

test('creates a Bahía-only topology with stable deduplicated patterns', () => {
  const dataset = createNetworkDataset(topologyFixture, 'a'.repeat(64));

  assert.deepEqual(dataset.agencies, [
    { id: 'CMTBC', name: 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz' },
  ]);
  assert.equal(dataset.routes.length, 1);
  assert.equal(dataset.routes[0]?.id, '2_13');
  assert.deepEqual(
    dataset.stops.map((stop) => stop.id),
    ['cadiz', 'puerto', 'station'],
  );
  assert.equal(dataset.patterns.length, 2);
  assert.deepEqual(dataset.patterns[0], {
    routeId: '2_13',
    directionId: '0',
    stopIds: ['cadiz', 'puerto'],
  });
});

test('keeps reviewed place IDs, calendar exceptions, and GTFS times after midnight', () => {
  const fixture = {
    ...topologyFixture,
    stopTimes: topologyFixture.stopTimes.map((time) =>
      time.trip_id === 'outbound-two'
        ? {
            ...time,
            arrival_time: time.stop_id === 'cadiz' ? '24:10:00' : '25:00:00',
            departure_time: time.stop_id === 'cadiz' ? '24:10:00' : '25:00:00',
          }
        : time,
    ),
  };
  const dataset = createNetworkDataset(fixture, 'a'.repeat(64), { cadiz: 'cadiz' });
  assert.equal(dataset.formatVersion, 2);
  assert.equal(dataset.stops.find((stop) => stop.id === 'cadiz')?.placeId, 'cadiz');
  assert.equal(dataset.stops.find((stop) => stop.id === 'puerto')?.placeId, null);
  assert.deepEqual(
    dataset.trips.find((trip) => trip.id === 'outbound-two')?.stopTimes.map((time) => time.departureMinutes),
    [1450, 1500],
  );
  assert.deepEqual(dataset.calendarExceptions, [{ serviceId: 'weekday', date: '2026-09-25', type: 2 }]);
  assert.deepEqual(dataset.coverage, { startDate: '2026-09-01', endDate: '2026-12-31' });
});

test('rejects a selected trip that references an absent stop', () => {
  const brokenFixture = {
    ...topologyFixture,
    stopTimes: [
      ...topologyFixture.stopTimes,
      {
        trip_id: 'inbound',
        stop_id: 'missing',
        stop_sequence: '3',
        arrival_time: '11:00:00',
        departure_time: '11:00:00',
      },
    ],
  };

  assert.throws(() => createNetworkDataset(brokenFixture, 'a'.repeat(64)), /missing stop/);
});

test('normalizes selected GTFS values and retains clear field errors', () => {
  const normalizedFixture = {
    ...topologyFixture,
    routes: [
      {
        ...topologyFixture.routes[0],
        route_id: ' 2_13 ',
        route_short_name: ' M-040 ',
        route_type: ' 3 ',
      },
      topologyFixture.routes[1],
    ],
  };

  const dataset = createNetworkDataset(normalizedFixture, 'a'.repeat(64));
  assert.deepEqual(dataset.routes[0], {
    id: '2_13',
    agencyId: 'CMTBC',
    shortName: 'M-040',
    longName: 'Cádiz-El Puerto de Santa María',
    type: 3,
    color: '9933ff',
    textColor: 'FFFFFF',
  });

  const invalidFixture = {
    ...topologyFixture,
    routes: [{ ...topologyFixture.routes[0], route_type: 'bus' }, topologyFixture.routes[1]],
  };
  assert.throws(
    () => createNetworkDataset(invalidFixture, 'a'.repeat(64)),
    /GTFS data error: routes\.route_type must be an integer\./,
  );
});

test('does not validate fields outside the selected GTFS slice', () => {
  const fixtureWithUnselectedMalformedRows = {
    ...topologyFixture,
    routes: [topologyFixture.routes[0], { ...topologyFixture.routes[1], route_id: '', route_type: 'not-an-integer' }],
    trips: [...topologyFixture.trips, { route_id: 'not-selected', trip_id: '', direction_id: '' }],
    stopTimes: [
      ...topologyFixture.stopTimes,
      { trip_id: 'not-selected', stop_id: '', stop_sequence: 'not-an-integer' },
    ],
  };

  const dataset = createNetworkDataset(fixtureWithUnselectedMalformedRows, 'a'.repeat(64));
  assert.equal(dataset.routes.length, 1);
  assert.equal(dataset.patterns.length, 2);
});

test("rejects invalid arguments through Node's strict parser", async () => {
  await assert.rejects(buildNetworkData(['--unknown']), /GTFS data error: Unknown option '--unknown'/);
});

test('reads CTAN CSV quirks from a ZIP archive without changing GTFS field values', async () => {
  const files = await readZipTextFiles(ctanMalformedQuoteArchiveFixture);

  assert.deepEqual(readGtfsTable(files, 'stops.txt'), [{ stop_id: ' oasis ', stop_name: 'Oasis " Viveros " (V)' }]);
});

test('parses quoted GTFS CSV values and rejects malformed rows', () => {
  assert.deepEqual(parseCsv('id,name\n1,"Cádiz, centro"\n'), [{ id: '1', name: 'Cádiz, centro' }]);
  assert.throws(() => parseCsv('id,name\n1\n'), /expected 2/);
  assert.throws(() => parseCsv('id,id\n1,2\n'), /duplicate or empty columns/);
});

test('retains the table filename when CSV parsing fails', () => {
  assert.throws(
    () => readGtfsTable(new Map([['stops.txt', 'id,name\n1\n']]), 'stops.txt'),
    /stops\.txt: GTFS data error: CSV row 2 has 1 fields; expected 2\./,
  );
});

test('rejects an invalid ZIP archive', async () => {
  await assert.rejects(readZipTextFiles(new Uint8Array([80, 75, 3, 4])), /ZIP archive/);
});
