import assert from 'node:assert/strict';
import test from 'node:test';
import { createNetworkDataset, parseCsv, readZipTextFiles } from './build-network-data.ts';
import { topologyFixture } from './fixtures/gtfs-topology.ts';

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

test('rejects a selected trip that references an absent stop', () => {
  const brokenFixture = {
    ...topologyFixture,
    stopTimes: [
      ...topologyFixture.stopTimes,
      { trip_id: 'inbound', stop_id: 'missing', stop_sequence: '3' },
    ],
  };

  assert.throws(() => createNetworkDataset(brokenFixture, 'a'.repeat(64)), /missing stop/);
});

test('parses quoted GTFS CSV values and rejects malformed rows', () => {
  assert.deepEqual(parseCsv('id,name\n1,"Cádiz, centro"\n'), [{ id: '1', name: 'Cádiz, centro' }]);
  assert.deepEqual(parseCsv('id,name\n1,"Oasis " Viveros " (V)"\n'), [
    { id: '1', name: 'Oasis " Viveros " (V)' },
  ]);
  assert.throws(() => parseCsv('id,name\n1\n'), /expected 2/);
});

test('rejects a ZIP archive without a central directory', () => {
  assert.throws(() => readZipTextFiles(new Uint8Array([80, 75, 3, 4])), /central-directory/);
});
