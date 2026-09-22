import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCtanLocationProbeReport,
  getCtanStopId,
  getGtfsStopId,
  isMissingCtanStopResponse,
  parseCtanStop,
  parseCtanMunicipalities,
  parseCtanNuclei,
  parseCtanStops,
  probeCtanLocations,
} from './probe-ctan-locations.ts';
import { ctanLocationFixture } from './fixtures/ctan-location.ts';

test('proves a complete CTAN hierarchy using the exact consortium-prefixed GTFS stop ID', () => {
  const directory = {
    municipalities: parseCtanMunicipalities({ municipios: ctanLocationFixture.municipalities }),
    nuclei: parseCtanNuclei({ nucleos: ctanLocationFixture.nuclei }),
    stops: parseCtanStops({ paradas: ctanLocationFixture.stops }),
  };

  assert.equal(getGtfsStopId('303'), '2_303');
  assert.deepEqual(createCtanLocationProbeReport(directory, ['2_303']), {
    status: 'verified',
    gtfsStopCount: 1,
    municipalityCount: 1,
    nucleusCount: 1,
    ctanStopCount: 1,
    matchedGtfsStopCount: 1,
    unmatchedGtfsStopIds: [],
  });
});

test('reports unmatched GTFS stops without creating a heuristic location assignment', () => {
  const directory = {
    municipalities: parseCtanMunicipalities({ municipios: ctanLocationFixture.municipalities }),
    nuclei: parseCtanNuclei({ nucleos: ctanLocationFixture.nuclei }),
    stops: parseCtanStops({ paradas: ctanLocationFixture.stops }),
  };

  const report = createCtanLocationProbeReport(directory, ['2_303', '2_999']);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.matchedGtfsStopCount, 1);
  assert.deepEqual(report.unmatchedGtfsStopIds, ['2_999']);
});

test('recovers the only CTAN stop detail ID that can supplement an incomplete collection result', () => {
  assert.equal(getCtanStopId('2_303'), '303');
  assert.equal(getCtanStopId('station-303'), null);
  assert.deepEqual(parseCtanStop(ctanLocationFixture.stops[0]), {
    id: '303',
    municipalityId: '1',
    nucleusId: '1',
  });
});

test("recognizes CTAN's not-found responses without hiding other failed detail requests", () => {
  assert.equal(isMissingCtanStopResponse(404, '<html>not found</html>'), true);
  assert.equal(isMissingCtanStopResponse(400, '{"error":"No se encuentran los datos"}'), true);
  assert.equal(isMissingCtanStopResponse(400, '{"error":"invalid request"}'), false);
  assert.equal(isMissingCtanStopResponse(500, '{"error":"No se encuentran los datos"}'), false);
});

test('rejects a stop whose declared municipality disagrees with its CTAN nucleus', () => {
  const directory = {
    municipalities: parseCtanMunicipalities({ municipios: ctanLocationFixture.municipalities }),
    nuclei: parseCtanNuclei({ nucleos: ctanLocationFixture.nuclei }),
    stops: parseCtanStops({
      paradas: [{ ...ctanLocationFixture.stops[0], idMunicipio: '99' }],
    }),
  };

  assert.throws(
    () => createCtanLocationProbeReport(directory, ['2_303']),
    /disagrees with nucleus 1 about its municipality/,
  );
});

test('rejects malformed CTAN location identifiers before they can be used in a source-data path', () => {
  assert.throws(
    () => parseCtanMunicipalities({ municipios: [{ idMunicipio: '../cadiz' }] }),
    /must be a non-empty decimal identifier/,
  );
});

test('rejects a capture location outside ignored source data before reading or contacting CTAN', async () => {
  await assert.rejects(probeCtanLocations(['--output', '../outside-source-data']), /must stay within data\/source/);
});
