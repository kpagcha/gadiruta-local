/** Checks real ZIP/CSV decoding with saved examples and no upstream requests. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ctanMalformedQuoteArchiveFixture } from '../../fixtures/gtfs-topology.ts';
import { parseCsv, readGtfsTable, readZipTextFiles } from '../../../scripts/ctan/archive.ts';

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
