/**
 * Checks offline location suggestions against a small reviewed hierarchy: municipality-wide
 * choices, town areas, outlying areas, and physical stops keep distinct scopes and URL identities.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocationOptions, locationLabel, searchLocations } from './location-search.ts';
import type { NetworkDataset } from './network-schema.ts';
import { places } from './places.ts';
import { resolveSearchUrl, searchQuery } from './search-url.ts';

const dataset: NetworkDataset = {
  formatVersion: 5,
  source: { url: 'source', generatedAt: '2026-09-21T16:09:45.619Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [
    { id: '2_10', agencyId: 'CMTBC', shortName: 'M-032', longName: null, type: 3, color: null, textColor: null },
  ],
  municipalities: [
    { id: '1', name: 'Cádiz' },
    { id: '3', name: 'Chiclana de la Frontera' },
    { id: '4', name: 'Puerto Real' },
  ],
  localAreas: [
    { id: '1', name: 'Cádiz', municipalityId: '1', referencePoint: null },
    { id: '3', name: 'Chiclana de la Frontera', municipalityId: '3', referencePoint: null },
    { id: '48', name: 'San Andrés Golf', municipalityId: '3', referencePoint: null },
    { id: '6', name: 'Puerto Real', municipalityId: '4', referencePoint: null },
    { id: '40', name: 'El Marquesado', municipalityId: '4', referencePoint: null },
    { id: '11', name: 'Barrio Jarana', municipalityId: '4', referencePoint: null },
    { id: '43', name: 'Hospital Pto. Real', municipalityId: '4', referencePoint: null },
  ],
  stops: [
    {
      id: '2_1',
      name: 'Plaza Asdrúbal',
      latitude: 36.5,
      longitude: -6.3,
      parentStationId: null,
      placeId: 'cadiz',
      municipalityId: '1',
      localAreaId: '1',
    },
    {
      id: '2_2',
      name: 'Avda. del Comercio',
      latitude: 36.4,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'chiclana-de-la-frontera',
      municipalityId: '3',
      localAreaId: '3',
    },
    {
      id: '2_3',
      name: 'San Andrés Golf',
      latitude: 36.4,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'chiclana-de-la-frontera',
      municipalityId: '3',
      localAreaId: '48',
    },
    {
      id: '2_4',
      name: 'Estación Puerto Real',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'puerto-real',
      municipalityId: '4',
      localAreaId: '6',
    },
    {
      id: '2_5',
      name: 'Mirlo',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'puerto-real',
      municipalityId: '4',
      localAreaId: '40',
    },
    {
      id: '2_6',
      name: 'Barrio Jarana',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'puerto-real',
      municipalityId: '4',
      localAreaId: '11',
    },
    {
      id: '2_7',
      name: 'Hospital De Puerto Real',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      placeId: 'puerto-real',
      municipalityId: '4',
      localAreaId: '43',
    },
  ],
  patterns: [{ routeId: '2_10', directionId: '0', stopIds: ['2_1', '2_2', '2_3', '2_4', '2_5', '2_6', '2_7'] }],
  trips: [],
  calendars: [],
  calendarExceptions: [],
  coverage: { startDate: '2026-09-01', endDate: '2026-12-31' },
};

const options = createLocationOptions(places, dataset);

test('plain Puerto Real is the town and the existing municipality URL remains broad', () => {
  const results = searchLocations(options, 'Puerto Real');
  assert.equal(results.places[0]?.id, 'puerto-real-town');
  assert.equal(results.places[1]?.id, 'puerto-real');
  assert.equal(locationLabel(results.places[1]!, 'All stops'), 'Puerto Real (All stops)');
  assert.deepEqual(
    results.stops.map((stop) => stop.id),
    ['2_4'],
  );
  assert.equal(
    searchQuery(
      results.places[1]!,
      options.find((option) => option.id === 'cadiz')!,
      'leave-now',
      '2026-09-25',
      '',
    ),
    '?from=puerto-real&to=cadiz&mode=now',
  );
  assert.ok(results.areas.some((area) => area.id === 'el-marquesado'));
  assert.equal(
    resolveSearchUrl('?from=puerto-real&to=cadiz&mode=now', options, dataset.coverage, '2026-09-25').origin?.id,
    'puerto-real',
  );
  assert.equal(
    resolveSearchUrl('?from=puerto-real-town&to=cadiz&mode=now', options, dataset.coverage, '2026-09-25').origin?.id,
    'puerto-real-town',
  );
});

test('a municipality reveals only its town stops while its areas remain choices', () => {
  const results = searchLocations(options, 'chiclana');
  assert.ok(results.places.some((place) => place.id === 'chiclana-de-la-frontera-town'));
  assert.ok(results.areas.some((area) => area.id === 'san-andres-golf'));
  assert.deepEqual(
    results.stops.map((stop) => stop.id),
    ['2_2'],
  );
  assert.deepEqual(
    searchLocations(options, 'cadiz').stops.map((stop) => stop.id),
    ['2_1'],
  );
  assert.equal(
    options.some((option) => option.id === 'cadiz-town'),
    false,
  );
});

test('named areas expand their own stops and words match in any order', () => {
  assert.deepEqual(
    searchLocations(options, 'El Marquesado').stops.map((stop) => stop.id),
    ['2_5'],
  );
  assert.deepEqual(
    searchLocations(options, 'puerto real hospital').stops.map((stop) => stop.id),
    ['2_7'],
  );
  assert.deepEqual(
    searchLocations(options, 'Plaza Asdrubal').stops.map((stop) => stop.id),
    ['2_1'],
  );
});

test('empty and unserved areas do not appear', () => {
  assert.deepEqual(searchLocations(options, '  '), { places: [], areas: [], stops: [] });
  assert.deepEqual(searchLocations(options, 'nowhere'), { places: [], areas: [], stops: [] });
  assert.equal(
    options.some((option) => option.id === 'costa-ballena'),
    false,
  );
});

test('search returns every matching stop for the picker to reveal within its group', () => {
  const repeatedStops = Array.from({ length: 9 }, (_, index) => ({
    kind: 'stop' as const,
    id: `stop-${index}`,
    name: `Hospital ${index}`,
    routeLabels: [],
  }));
  assert.equal(searchLocations(repeatedStops, 'hospital').stops.length, 9);
});
