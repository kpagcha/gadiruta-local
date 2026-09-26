/**
 * Checks offline location suggestions against a small reviewed hierarchy: municipality-wide
 * choices, town areas, outlying areas, and physical stops keep distinct scopes and URL identities.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { locationAliasGroups } from '../../../src/data/location-search-aliases.ts';
import {
  createLocationMunicipalities,
  createLocationOptions,
  hasMinimumLocationQuery,
  isSameLocationChoice,
  locationLabel,
  searchLocations,
} from '../../../src/data/location-search.ts';
import { parseNetworkDataset, type NetworkDataset } from '../../../src/data/network-schema.ts';
import { places } from '../../../src/data/places.ts';
import { resolveSearchUrl, searchQuery } from '../../../src/data/search-url.ts';

const dataset: NetworkDataset = {
  formatVersion: 6,
  source: { url: 'source', generatedAt: '2026-09-21T16:09:45.619Z', archiveSha256: 'a'.repeat(64) },
  agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
  routes: [
    { id: '2_10', agencyId: 'CMTBC', shortName: 'M-032', longName: null, type: 3, color: null, textColor: null },
  ],
  municipalities: [
    { id: '1', name: 'Cádiz' },
    { id: '3', name: 'Chiclana de la Frontera' },
    { id: '4', name: 'Puerto Real' },
    { id: '6', name: 'Jerez de la Frontera' },
  ],
  localAreas: [
    { id: '1', name: 'Cádiz', municipalityId: '1', referencePoint: null },
    { id: '3', name: 'Chiclana de la Frontera', municipalityId: '3', referencePoint: null },
    { id: '48', name: 'San Andrés Golf', municipalityId: '3', referencePoint: null },
    { id: '6', name: 'Puerto Real', municipalityId: '4', referencePoint: null },
    { id: '40', name: 'El Marquesado', municipalityId: '4', referencePoint: null },
    { id: '11', name: 'Barrio Jarana', municipalityId: '4', referencePoint: null },
    { id: '43', name: 'Hospital Pto. Real', municipalityId: '4', referencePoint: null },
    { id: '14', name: 'Jerez de la Frontera', municipalityId: '6', referencePoint: null },
    { id: '42', name: 'Aeropuerto', municipalityId: '6', referencePoint: null },
  ],
  stops: [
    {
      id: '2_1',
      name: 'Plaza Asdrúbal',
      latitude: 36.5,
      longitude: -6.3,
      parentStationId: null,
      municipalityId: '1',
      localAreaId: '1',
    },
    {
      id: '2_2',
      name: 'Avda. del Comercio',
      latitude: 36.4,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '3',
      localAreaId: '3',
    },
    {
      id: '2_3',
      name: 'San Andrés Golf',
      latitude: 36.4,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '3',
      localAreaId: '48',
    },
    {
      id: '2_4',
      name: 'Estación Puerto Real',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '4',
      localAreaId: '6',
    },
    {
      id: '2_5',
      name: 'Mirlo',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '4',
      localAreaId: '40',
    },
    {
      id: '2_6',
      name: 'Barrio Jarana',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '4',
      localAreaId: '11',
    },
    {
      id: '2_7',
      name: 'Hospital De Puerto Real',
      latitude: 36.5,
      longitude: -6.2,
      parentStationId: null,
      municipalityId: '4',
      localAreaId: '43',
    },
    {
      id: '2_8',
      name: 'Estación Jerez',
      latitude: 36.68,
      longitude: -6.13,
      parentStationId: null,
      municipalityId: '6',
      localAreaId: '14',
    },
    {
      id: '2_9',
      name: 'Aeropuerto',
      latitude: 36.75,
      longitude: -6.06,
      parentStationId: null,
      municipalityId: '6',
      localAreaId: '42',
    },
  ],
  trips: [
    {
      id: 'fixture-trip',
      routeId: '2_10',
      serviceId: 'daily',
      stopTimes: ['2_1', '2_2', '2_3', '2_4', '2_5', '2_6', '2_7', '2_8', '2_9'].map((stopId, index) => ({
        stopId,
        arrivalMinutes: index * 10,
        departureMinutes: index * 10,
        pickupType: 0,
        dropOffType: 0,
      })),
    },
  ],
  calendars: [],
  calendarExceptions: [],
  coverage: { startDate: '2026-09-01', endDate: '2026-12-31' },
};

const options = createLocationOptions(places, dataset);

test('labels physical stops from the routes of trips that visit them', () => {
  const secondRoute = { ...dataset.routes[0]!, id: '2_11', shortName: 'M-033' };
  const secondTrip = {
    ...dataset.trips[0]!,
    id: 'second-trip',
    routeId: secondRoute.id,
    stopTimes: dataset.trips[0]!.stopTimes.slice(1, 3),
  };
  const withTwoRoutes = createLocationOptions(places, {
    ...dataset,
    routes: [...dataset.routes, secondRoute],
    trips: [...dataset.trips, secondTrip],
  });
  /** Read the labels shown beside one physical stop option. */
  const labels = (id: string) => {
    const option = withTwoRoutes.find((item) => item.id === id);
    return option?.kind === 'stop' ? option.routeLabels : null;
  };
  assert.deepEqual(labels('2_1'), ['M-032']);
  assert.deepEqual(labels('2_2'), ['M-032', 'M-033']);
});

test('the place picker uses served locations and existing place identities', () => {
  const hierarchy = createLocationMunicipalities(options, {
    ...dataset,
    municipalities: [...dataset.municipalities, { id: '15', name: 'Chipiona' }],
    localAreas: [
      ...dataset.localAreas,
      { id: '44', name: 'Chipiona', municipalityId: '15', referencePoint: null },
      { id: '99', name: 'Unserved', municipalityId: '4', referencePoint: null },
    ],
  });
  assert.deepEqual(
    hierarchy.map((municipality) => municipality.name),
    ['Cádiz', 'Chiclana de la Frontera', 'Jerez de la Frontera', 'Puerto Real'],
  );
  const puertoReal = hierarchy.find((municipality) => municipality.id === '4')!;
  assert.equal(puertoReal.choice.id, 'puerto-real');
  assert.deepEqual(
    puertoReal.areas.map((area) => [area.id, area.choice.id]),
    [
      ['11', 'barrio-jarana'],
      ['40', 'el-marquesado'],
      ['43', 'hospital-puerto-real'],
      ['6', 'puerto-real-town'],
    ],
  );
  assert.deepEqual(hierarchy.find((municipality) => municipality.id === '1')?.areas, []);
  assert.equal(
    searchQuery(puertoReal.choice, puertoReal.areas[0]!.choice, 'leave-now', '2026-09-25', ''),
    '?from=puerto-real&to=barrio-jarana&mode=now',
  );
});

test('requires two non-space characters before returning location suggestions', () => {
  assert.equal(hasMinimumLocationQuery(' c '), false);
  assert.equal(hasMinimumLocationQuery('ca'), true);
  assert.deepEqual(searchLocations(options, 'c'), { places: [], areas: [], stops: [] });
  assert.ok(searchLocations(options, 'ca').places.length > 0);
});

test('only identical selected places or physical stops are the same location choice', () => {
  const town = options.find((option) => option.id === 'puerto-real-town')!;
  const broad = options.find((option) => option.id === 'puerto-real')!;
  const firstStop = options.find((option) => option.id === '2_1')!;
  const secondStopWithSameName = { ...firstStop, id: 'another-physical-stop' };
  assert.equal(isSameLocationChoice(town, town), true);
  assert.equal(isSameLocationChoice(firstStop, firstStop), true);
  assert.equal(isSameLocationChoice(town, broad), false);
  assert.equal(isSameLocationChoice(firstStop, secondStopWithSameName), false);
  assert.equal(isSameLocationChoice(null, firstStop), false);
  assert.equal(isSameLocationChoice({ kind: 'place', id: firstStop.id, name: firstStop.name }, firstStop), false);
});

test('shared links reject identical choices but allow a town and its all-stops municipality', () => {
  const town = options.find((option) => option.id === 'puerto-real-town')!;
  const broad = options.find((option) => option.id === 'puerto-real')!;
  const stop = options.find((option) => option.id === '2_1')!;
  const resolve = (query: string) => resolveSearchUrl(query, options, dataset.coverage, '2026-09-25');
  assert.equal(resolve(searchQuery(town, town, 'leave-now', '2026-09-25', '')).invalid, true);
  assert.equal(resolve(searchQuery(stop, stop, 'leave-now', '2026-09-25', '')).complete, false);
  assert.equal(resolve(searchQuery(town, broad, 'leave-now', '2026-09-25', '')).complete, true);
});

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

test('a municipality and area can be searched together in either order', () => {
  for (const query of ['jerez aeropuerto', 'aeropuerto jerez', 'jere aerop']) {
    const results = searchLocations(options, query);
    assert.deepEqual(
      results.areas.map((area) => area.id),
      ['aeropuerto-jerez'],
    );
    assert.deepEqual(
      results.stops.map((stop) => stop.id),
      ['2_9'],
    );
  }
  assert.deepEqual(
    searchLocations(options, 'chiclana san andres').stops.map((stop) => stop.id),
    ['2_3'],
  );
  assert.deepEqual(
    searchLocations(options, 'jerez').stops.map((stop) => stop.id),
    ['2_8'],
  );
  assert.deepEqual(
    searchLocations(options, 'aeropuerto').stops.map((stop) => stop.id),
    ['2_9'],
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

test('curated hub aliases refer to existing choices in the tracked network snapshot', () => {
  const snapshot = parseNetworkDataset(
    JSON.parse(readFileSync(new URL('../../../public/data/bahia-cadiz-network.json', import.meta.url), 'utf8')),
  );
  const snapshotOptions = createLocationOptions(places, snapshot);
  const placeIds = new Set(snapshotOptions.filter((option) => option.kind === 'place').map((option) => option.id));
  const stopIds = new Set(snapshot.stops.map((stop) => stop.id));

  for (const group of locationAliasGroups) {
    for (const id of group.placeIds ?? []) assert.ok(placeIds.has(id), `Missing alias place: ${id}`);
    for (const id of group.stopIds ?? []) assert.ok(stopIds.has(id), `Missing alias stop: ${id}`);
  }

  /** Compare matching stops regardless of how suggestions are ranked. */
  const matchingStopIds = (query: string) =>
    searchLocations(snapshotOptions, query)
      .stops.map((stop) => stop.id)
      .sort();
  const busStops = ['2_14', '2_161', '2_181', '2_188', '2_191', '2_222', '2_266', '2_303', '2_304'].sort();
  const railStops = ['2_125', '2_126', '2_163', '2_174', '2_47', '2_48', '2_86', '2_87'].sort();

  assert.deepEqual(matchingStopIds('bus station'), busStops);
  assert.deepEqual(matchingStopIds('train station'), railStops);
  assert.deepEqual(matchingStopIds('estación de tren'), railStops);
  assert.deepEqual(matchingStopIds('Cádiz bus station'), ['2_14', '2_303', '2_304']);
  assert.deepEqual(matchingStopIds('station train Bahía Sur'), ['2_47', '2_48']);
  assert.deepEqual(matchingStopIds('jerez airport'), ['2_173']);
  assert.deepEqual(
    searchLocations(snapshotOptions, 'airport').areas.map((area) => area.id),
    ['aeropuerto-jerez'],
  );

  const airport = searchLocations(snapshotOptions, 'airport').areas[0]!;
  const cadiz = snapshotOptions.find((option) => option.id === 'cadiz')!;
  const query = searchQuery(airport, cadiz, 'leave-now', snapshot.coverage.startDate, '');
  assert.equal(
    resolveSearchUrl(query, snapshotOptions, snapshot.coverage, snapshot.coverage.startDate).origin?.id,
    airport.id,
  );
  const stationStop = searchLocations(snapshotOptions, 'Jerez bus station').stops[0]!;
  const stationQuery = searchQuery(stationStop, cadiz, 'leave-now', snapshot.coverage.startDate, '');
  assert.equal(
    resolveSearchUrl(stationQuery, snapshotOptions, snapshot.coverage, snapshot.coverage.startDate).origin?.id,
    '2_161',
  );
});

test('official names rank ahead of aliases without repeating a choice', () => {
  const choices = [
    { kind: 'stop' as const, id: 'alias', name: 'Another stop', searchAliases: ['bus station'], routeLabels: [] },
    { kind: 'stop' as const, id: 'name', name: 'Bus Station', searchAliases: ['bus station'], routeLabels: [] },
  ];
  assert.deepEqual(
    searchLocations(choices, 'bus station').stops.map((stop) => stop.id),
    ['name', 'alias'],
  );
});
