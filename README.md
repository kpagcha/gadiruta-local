# Gadiruta Local

Gadiruta Local is a Cádiz-area public-transport web app. It is a local-first static React
application: the deployed site has no application backend, database, runtime proxy, or direct CTAN
requests.

## Current status

The app bundles a reviewed Bahía de Cádiz timetable snapshot derived from CTAN GTFS. The home page
loads it locally and finds scheduled direct journeys between places or exact stops on a chosen date
and optional departure time. Searches have shareable URLs and reveal local results in small slices.
On mobile, search is visible directly below the header. Network browsing, maps, and offline
persistence are still ahead.

## Roadmap

- [x] **Static foundation:** Root-level React app with no runtime backend, bilingual UI, and theme
      preference.
- [x] **First local data slice:** A validated Bahía de Cádiz GTFS topology snapshot loads and is
      queried directly in the browser.
- [x] **Place search:** Let people select Cádiz-area places or exact stops using local transit data.
- [x] **Direct journeys:** Find date-aware direct services between selected places on-device.
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
CTAN archive, place the unmodified file at `data/source/ctan-gtfs.zip` and run `just data`. It keeps
the current Cádiz calendar year and the next, clipped to the dates present in the feed. To download
a fresh archive from `https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip` before rebuilding, run
`just data-refresh`.

[The development guide](docs/development.md) explains the project tools and commands.

## Documentation

- [Product scope](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development conventions](docs/development.md)

Gadiruta Local is independent and is not an official CTAN or Junta de Andalucía service.
