/** Checks reviewed JSON at the file boundary without requiring CTAN or a downloaded archive. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { locationDirectorySchema } from '../../../scripts/network/location-directory.ts';

test('accepts the reviewed directory without discarding its metadata or candidate points', () => {
  const input: unknown = JSON.parse(
    readFileSync(new URL('../../../data/reviewed/ctan-location-directory.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(locationDirectorySchema.parse(input), input);
});

test('rejects missing stop relationships and malformed candidate coordinates at the file boundary', () => {
  const directory = {
    retrievedAt: '2026-09-22T00:00:00Z',
    municipalities: [{ id: '1', name: 'Town' }],
    localAreas: [],
    stopLocations: { stop: { municipalityId: '1', localAreaId: null } },
  };
  assert.throws(() => locationDirectorySchema.parse({ ...directory, stopLocations: null }));
  assert.throws(() =>
    locationDirectorySchema.parse({
      ...directory,
      localAreas: [
        {
          id: '1',
          name: 'Town',
          municipalityId: '1',
          derivedCoordinates: {
            stopCount: 1,
            average: { latitude: 36, longitude: -6 },
            representativeStop: { stopId: 'stop', latitude: '36', longitude: -6 },
          },
        },
      ],
    }),
  );
});
