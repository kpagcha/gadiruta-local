/** Checks offline conversion from saved CTAN evidence to the reviewed place directory. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { NetworkDataset, NetworkStop } from '../../../../src/data/network-schema.ts';
import {
  createCtanLocationProbeReport,
  parseCtanLocalAreas,
  parseCtanMunicipalities,
  parseCtanStop,
  parseCtanStops,
} from '../../../../scripts/ctan/research/ctan-location-crosswalk.ts';
import {
  createReviewedLocationDirectory,
  readLocationCapture,
  type LocationCapture,
} from '../../../../scripts/ctan/research/generate-location-directory.ts';

/** Give the converter three selected stops on one line, without a live timetable or CTAN request. */
function network(): NetworkDataset {
  const stops: NetworkStop[] = [
    {
      id: '2_303',
      name: 'First',
      latitude: 0,
      longitude: 0,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
    {
      id: '2_304',
      name: 'Second',
      latitude: 0,
      longitude: 2,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
    {
      id: '2_349',
      name: 'Line only',
      latitude: 1,
      longitude: 1,
      parentStationId: null,
      municipalityId: null,
      localAreaId: null,
    },
  ];
  return {
    formatVersion: 7,
    source: { url: 'source', generatedAt: '2026-09-22T00:00:00.000Z', archiveSha256: 'a'.repeat(64) },
    agencies: [],
    routes: [],
    municipalities: [],
    localAreas: [],
    stops,
    trips: [
      {
        id: 'trip',
        routeId: '2_32',
        serviceId: 'service',
        stopTimes: stops.map((stop, index) => ({
          stopId: stop.id,
          arrivalMinutes: index * 10,
          departureMinutes: index * 10,
          pickupType: 0,
          dropOffType: 0,
        })),
      },
    ],
    serviceDates: [],
    coverage: { startDate: '2026-01-01', endDate: '2026-12-31' },
  };
}

/** Include a main-list stop, an individual stop reply, and a municipality-only line fallback. */
function capture(): LocationCapture {
  const municipalities = {
    municipios: [
      { idMunicipio: '1', datos: 'Cádiz' },
      { idMunicipio: '7', datos: 'Rota' },
    ],
  };
  const areas = [
    { idNucleo: '1', idMunicipio: '1', nombre: 'Cádiz' },
    { idNucleo: '7', idMunicipio: '7', nombre: 'Rota' },
  ];
  const mainStop = { idParada: '303', idMunicipio: '1', idNucleo: '1' };
  const detailStop = { idParada: '304', idMunicipio: '1', idNucleo: '1' };
  const lineFallback = { gtfsStopId: '2_349', municipalityId: '7' };
  const report = createCtanLocationProbeReport(
    {
      municipalities: parseCtanMunicipalities(municipalities),
      localAreas: parseCtanLocalAreas({ nucleos: areas }),
      stops: [...parseCtanStops({ paradas: [mainStop] }), parseCtanStop(detailStop)],
    },
    ['2_303', '2_304', '2_349'],
    [lineFallback],
  );
  return {
    retrievedAt: '2026-09-22T16:36:30.037Z',
    report,
    responses: new Map([
      ['municipios.json', { status: 200, text: JSON.stringify(municipalities) }],
      ['municipio-1-nucleos.json', { status: 200, text: JSON.stringify({ nucleos: [areas[0]] }) }],
      ['municipio-7-nucleos.json', { status: 200, text: JSON.stringify({ nucleos: [areas[1]] }) }],
      ['paradas.json', { status: 200, text: JSON.stringify({ paradas: [mainStop] }) }],
      ['parada-304.json', { status: 200, text: JSON.stringify(detailStop) }],
      ['parada-349.json', { status: 400, text: JSON.stringify({ error: 'No se encuentran los datos' }) }],
      [
        'linea-32-paradas.json',
        { status: 200, text: JSON.stringify({ paradas: [{ idParada: '349', idNucleo: '7' }] }) },
      ],
    ]),
  };
}

test('generates names, stop assignments, and representative points from three kinds of CTAN evidence', () => {
  const result = createReviewedLocationDirectory(network(), capture());
  assert.deepEqual(result.municipalities, [
    { id: '1', name: 'Cádiz' },
    { id: '7', name: 'Rota' },
  ]);
  assert.deepEqual(result.stopLocations, {
    '2_303': { municipalityId: '1', localAreaId: '1' },
    '2_304': { municipalityId: '1', localAreaId: '1' },
    '2_349': { municipalityId: '7', localAreaId: null },
  });
  assert.deepEqual(result.localAreas[0]?.derivedCoordinates, {
    stopCount: 2,
    average: { latitude: 0, longitude: 1 },
    representativeStop: { stopId: '2_303', latitude: 0, longitude: 0 },
  });
  assert.equal(result.localAreas[1]?.derivedCoordinates, undefined);
});

test('rejects a line fallback without matching captured evidence', () => {
  const evidence = capture();
  const responses = new Map(evidence.responses);
  responses.delete('linea-32-paradas.json');
  assert.throws(
    () => createReviewedLocationDirectory(network(), { ...evidence, responses }),
    /no captured line proving municipality 7/,
  );
});

test('rejects missing stop details and a report that disagrees with captured replies', () => {
  const missingDetail = capture();
  const responses = new Map(missingDetail.responses);
  responses.delete('parada-304.json');
  assert.throws(
    () => createReviewedLocationDirectory(network(), { ...missingDetail, responses }),
    /parada-304.json is missing/,
  );

  const staleReport = capture();
  staleReport.report = { ...staleReport.report, gtfsStopCount: 2 };
  assert.throws(() => createReviewedLocationDirectory(network(), staleReport), /report disagrees/);
});

test('rejects a probe made from another GTFS ZIP before reading its location replies', async (context) => {
  const folder = await mkdtemp(join(tmpdir(), 'gadiruta-location-test-'));
  context.after(async () => rm(folder, { recursive: true, force: true }));
  await writeFile(
    join(folder, 'manifest.json'),
    JSON.stringify({ retrievedAt: '2026-09-22T00:00:00.000Z', gtfsArchiveSha256: 'a'.repeat(64), responses: [] }),
  );
  await assert.rejects(
    readLocationCapture(folder, createHash('sha256').update('different').digest('hex')),
    /different SHA-256 hashes/,
  );
});

test('rejects a captured reply whose bytes differ from the probe manifest', async (context) => {
  const folder = await mkdtemp(join(tmpdir(), 'gadiruta-location-test-'));
  context.after(async () => rm(folder, { recursive: true, force: true }));
  await writeFile(join(folder, 'municipios.json'), '{}');
  await writeFile(
    join(folder, 'manifest.json'),
    JSON.stringify({
      retrievedAt: '2026-09-22T00:00:00.000Z',
      gtfsArchiveSha256: 'a'.repeat(64),
      responses: [
        {
          path: join(folder, 'municipios.json'),
          sha256: createHash('sha256').update('different').digest('hex'),
          url: 'http://api.ctan.es/v1/Consorcios/2/municipios',
          status: 200,
        },
      ],
    }),
  );
  await assert.rejects(readLocationCapture(folder, 'a'.repeat(64)), /differs from its probe manifest hash/);
});
