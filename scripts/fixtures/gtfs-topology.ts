/**
 * Provides small example GTFS tables for tests of the data-building script.
 *
 * The examples include two transport agencies and route/stop details that let tests check how the
 * script selects the Bay of Cádiz network without opening a real downloaded archive.
 */
/** A tiny GTFS table set that covers Bahía filtering, topology variants, and parent stations. */
export const topologyFixture = {
  agency: [
    {
      agency_id: 'CMTBC',
      agency_name: 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz',
    },
    {
      agency_id: 'CTMAS',
      agency_name: 'Red de Consorcios de Transporte de Andalucía - Área de Sevilla',
    },
  ],
  routes: [
    {
      route_id: '2_13',
      agency_id: 'CMTBC',
      route_short_name: 'M-040',
      route_long_name: 'Cádiz-El Puerto de Santa María',
      route_type: '3',
      route_color: '9933ff',
      route_text_color: 'FFFFFF',
    },
    {
      route_id: '1_204',
      agency_id: 'CTMAS',
      route_short_name: 'M-106',
      route_long_name: 'Carmona-Sevilla',
      route_type: '3',
      route_color: 'FF0000',
      route_text_color: 'FFFFFF',
    },
  ],
  stops: [
    { stop_id: 'station', stop_name: 'Cádiz station', stop_lat: '36.5298', stop_lon: '-6.2947' },
    {
      stop_id: 'cadiz',
      stop_name: 'Cádiz',
      stop_lat: '36.5298',
      stop_lon: '-6.2947',
      parent_station: 'station',
    },
    { stop_id: 'puerto', stop_name: 'El Puerto', stop_lat: '36.5952', stop_lon: '-6.2333' },
    { stop_id: 'sevilla', stop_name: 'Sevilla', stop_lat: '37.3891', stop_lon: '-5.9845' },
  ],
  trips: [
    { route_id: '2_13', trip_id: 'outbound-one', direction_id: '0' },
    { route_id: '2_13', trip_id: 'outbound-two', direction_id: '0' },
    { route_id: '2_13', trip_id: 'inbound', direction_id: '1' },
    { route_id: '1_204', trip_id: 'other-agency', direction_id: '0' },
  ],
  stopTimes: [
    { trip_id: 'outbound-one', stop_id: 'cadiz', stop_sequence: '1' },
    { trip_id: 'outbound-one', stop_id: 'puerto', stop_sequence: '2' },
    { trip_id: 'outbound-two', stop_id: 'cadiz', stop_sequence: '1' },
    { trip_id: 'outbound-two', stop_id: 'puerto', stop_sequence: '2' },
    { trip_id: 'inbound', stop_id: 'puerto', stop_sequence: '1' },
    { trip_id: 'inbound', stop_id: 'cadiz', stop_sequence: '2' },
    { trip_id: 'other-agency', stop_id: 'sevilla', stop_sequence: '1' },
  ],
} as const;

/**
 * A compressed CTAN-style stops table with a UTF-8 BOM, whitespace around headers, and the
 * upstream's unescaped interior quotes. The final blank record exercises empty-line handling.
 */
export const ctanMalformedQuoteArchiveFixture = Buffer.from(
  'UEsDBBQAAAAIAHhXNl3pHj73MgAAADoAAAAJAAAAc3RvcHMudHh0e797v0JxSX5BfGaKgg6ElZeYm6rApZCfWJxZrKCj5A+mlRTCMstSi/JBLI0wTSUuLgBQSwECFAAUAAAACAB4VzZd6R4+9zIAAAA6AAAACQAAAAAAAAAAAAAAAAAAAAAAc3RvcHMudHh0UEsFBgAAAAABAAEANwAAAFkAAAAAAA==',
  'base64',
);
