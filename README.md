# Gadiruta Local

Gadiruta Local is a Cádiz-area public-transport web app. It is a local-first static React
application: the deployed site has no application backend, database, runtime proxy, or direct CTAN
requests.

## Current status

The app bundles a reviewed Bahía de Cádiz network-topology snapshot derived from CTAN GTFS. The
home page loads that asset in the browser and lets people choose a place or an exact stop for the
origin and destination. Journey results, timetables, maps, and offline persistence are still ahead.

## Roadmap

- [x] **Static foundation:** Root-level React app with no runtime backend, bilingual UI, and theme
      preference.
- [x] **First local data slice:** A validated Bahía de Cádiz GTFS topology snapshot loads and is
      queried directly in the browser.
- [x] **Place search:** Let people select Cádiz-area places or exact stops using local transit data.
- [ ] **Direct journeys:** Find date-aware direct services between selected places on-device.
- [ ] **Network browsing:** Add line, stop, and timetable views.
- [ ] **Offline experience:** Add local data persistence and deliberate PWA caching once real data
      needs it.

Each completed milestone is checked here. Technical design belongs in the architecture and source
code.

## Development

Requires Node.js 24, npm 11, and [just](https://just.systems/).

```shell
just install
just dev
```

Run the usual checks with:

```shell
just check
```

The committed network snapshot makes normal development work offline. To rebuild it from a local
CTAN archive, place the unmodified file at `data/source/ctan-gtfs.zip` and run `just data`. To
download a fresh archive from `https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip` before rebuilding,
run `just data-refresh`.

[The development guide](docs/development.md) explains the project tools and commands.

## Documentation

- [Product scope](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development conventions](docs/development.md)

Gadiruta Local is independent and is not an official CTAN or Junta de Andalucía service.
