/** Checks CLI errors before the builder can read or download data. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNetworkData } from '../../scripts/build-network-data.ts';

test("rejects invalid arguments through Node's strict parser", async () => {
  await assert.rejects(buildNetworkData(['--unknown']), /GTFS data error: Unknown option '--unknown'/);
  await assert.rejects(buildNetworkData(['--start-date', '2026-01-01']), /must be provided together/);
  await assert.rejects(
    buildNetworkData(['--current-and-next-year', '--start-date', '2026-01-01', '--end-date', '2027-12-31']),
    /use either --current-and-next-year/,
  );
});
