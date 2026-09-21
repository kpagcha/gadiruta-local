# Gadiruta Local

Gadiruta Local is a Cádiz-area public-transport web app that is being rebuilt as a local-first,
static React application.

It will eventually download a preprocessed transit dataset and run place search, direct-journey
lookup, timetables, and network visualisation in the browser. It has no application backend at
runtime.

## Current status

The repository currently contains the browser application foundation: bilingual interface,
light/dark theme, responsive visual system, and local development tooling. No transit dataset or
journey search is bundled yet, so data-dependent features are intentionally not exposed as working
controls.

## Roadmap

- [x] **Static foundation:** Root-level React app with no runtime backend, bilingual UI, and theme
      preference.
- [ ] **First local data slice (next):** Validate a small preprocessed CTAN GTFS dataset and query
      it directly in the browser.
- [ ] **Place search:** Let people select Cádiz-area places using local transit data.
- [ ] **Direct journeys:** Find date-aware direct services between selected places on-device.
- [ ] **Network browsing:** Add line, stop, and timetable views.
- [ ] **Offline experience:** Add local data persistence and deliberate PWA caching once real data
      needs it.

Each completed milestone should be checked here. Keep the list outcome-focused; technical design
belongs in the relevant source code and architecture documentation.

## Development

Requires Node.js 24, npm 11, and [just](https://just.systems/), a small project command runner.

```shell
just install
just dev
```

Useful checks:

```shell
just check
```

New to these tools? [The development guide](docs/development.md) explains just, npm, React,
TypeScript, Vite, and the project commands in plain language.

## Documentation

- [Product scope](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development conventions](docs/development.md)

Gadiruta Local is independent and is not an official CTAN or Junta de Andalucía service.
