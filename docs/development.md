# Development guide

This guide explains where project files live, how the browser app starts, and what the developer
commands do. The short version: Vite serves the React app; React loads a checked-in JSON network
snapshot from `public/`; scripts under `scripts/` build or investigate data only when a developer
explicitly runs a command.

## Project map

```text
gadiruta-local/
├── index.html                    Browser document; provides #root and starts src/main.tsx
├── src/                          Browser application source
│   ├── main.tsx                  Mounts React, translations, and global styles
│   ├── App.tsx                   Shared header/footer shell and page metadata
│   ├── config.ts                 Project-controlled browser settings such as recent-search count
│   ├── pages/                    Full-page content (currently HomePage)
│   ├── components/               Reusable interface pieces
│   │   └── ui/                   Shared Base UI select and tooltip wrappers with app styling
│   ├── data/                     Browser-side network loading, journey search, recent history, URL and calendar helpers
│   ├── hooks/                    React lifecycle for dataset loading and theme preference
│   ├── i18n/                     English/Spanish text and language setup
│   └── styles/                   Global CSS and Tailwind entry point
├── public/                       Files copied as-is to the site root during build
│   ├── data/                     Checked-in network JSON fetched by the browser
│   ├── fonts/                    Font license and other public font files
│   └── favicon.svg               Browser tab icon
├── scripts/                      Developer-run data tools; never imported by the website
│   ├── build-network-data.ts     CLI, explicit download, file reading and snapshot writing
│   ├── gtfs/                     ZIP/CSV reading and GTFS conversion; adjacent tests
│   ├── reviewed/                 Curated JSON inputs; shared input schema and tests
│   ├── experiments/              Probing, crosswalk and coordinate tools; adjacent tests/fixtures
│   ├── build-network-data.test.ts CLI boundary tests
│   └── fixtures/                 Small GTFS examples for tooling tests
├── data/source/                  Ignored downloaded GTFS ZIP and probe captures (local only)
├── docs/                         Product, architecture, and contributor guides
├── package.json                  npm scripts and dependency list
├── package-lock.json             Exact installed dependency versions
├── justfile                      Friendly command names that call npm scripts
├── vite.config.ts                Vite development server and build configuration
├── tsconfig.json                 Strict browser TypeScript settings, without Node globals
└── tsconfig.tools.json           Node tooling, tests, and Vite configuration
```

Generated or local-only directories such as `node_modules/`, `dist/`, and
`.idea/` are omitted from the tree. The data paths have different roles:

- `data/source/` is ignored local input/evidence for developer tools. It is not shipped and is not
  needed to run the checked-in app.
- `public/data/` is a tracked, reviewed JSON file. Vite copies it to the site's `/data/` URL, where
  the browser fetches it.
- `src/data/` is TypeScript code, not a data directory. It loads, validates, and searches the JSON.

## How the app runs

```text
Browser opens index.html
  → src/main.tsx mounts React and initializes translations/styles
  → App.tsx renders the shared header, HomePage, and footer
  → HomePage uses src/hooks/use-network-dataset.ts
  → src/data/network.ts fetches /data/bahia-cadiz-network.json
  → network-schema.ts validates the JSON before use
  → location-search.ts combines network stops with curated places
  → TripLocationPicker displays local search choices
  → journey-search.ts validates submitted criteria and creates the URL and local results
  → direct-journeys.ts searches trips and calendars
```

After a search, `HomePage` places the persistent form next to a separate `DirectJourneyResults`
card on desktop, or above it on mobile. `LocationField` owns each endpoint's suggestions and place
picker; `TripLocationPicker` composes the whole form. `JourneyCard` owns stop selection and its
timeline; `DirectJourneyResults` owns result pagination. Motion animates the page entrance, search
layout, and journey cards; CSS handles short control and popup transitions.
`search-url.ts` maps shareable browser URLs to local places,
stops, dates, and times; `direct-journeys.ts` supplies and divides the local journey list.

The `public/data` URL is served by Vite in development and by any ordinary static host in
production. Browser code never imports `scripts/`, reads `data/source/`, or calls CTAN. There is no
Gadiruta server process or runtime database. Language and theme preferences and recent searches are
handled in the browser and may be saved in local storage.

## How the network JSON is made

```text
CTAN GTFS ZIP
  → data/source/ctan-gtfs.zip (local input, ignored by Git)
  → scripts/gtfs/archive.ts reads ZIP and CSV
  → scripts/gtfs/network-dataset.ts selects Bahía routes, stops, trips, and calendars
  → scripts/reviewed/place-stop-assignments.json adds reviewed place IDs
  → scripts/reviewed/ctan-location-directory.json adds reviewed CTAN location IDs and local-area reference points
  → public/data/bahia-cadiz-network.json (reviewed and tracked)
  → browser loads and validates it as above
```

`just data` rebuilds the snapshot from the local ZIP for the current Cádiz calendar year and the
next. It clips the requested end date to the Bay services actually present in the archive; it never
extends an old timetable into a new year. `just data-refresh` downloads a new ZIP from CTAN and uses
the same range, so it needs network access and should be an intentional refresh. Both commands fail
if the feed has no service in that range or a selected stop lacks a reviewed CTAN location. Review
the JSON diff before committing. Update the tracked location directory from a new probe capture
when CTAN adds stops or changes its hierarchy. The app can be developed from a fresh
checkout without the ZIP because the reviewed JSON is already present.

`build-network-data.ts` handles arguments, explicit downloads, file IO, and provenance. The GTFS
conversion in `scripts/gtfs/network-dataset.ts` can be tested without those side effects. ZIP/CSV
decoding uses `yauzl` and `csv-parse`; arguments use Node's `parseArgs`. JSON boundaries use Zod,
with explicit transit relationship checks in the shared `src/data/network-schema.ts` contract.

The underlying builder keeps the full source span when no range is given: `npm run data`. For an
inclusive custom range, run `npm run data -- --start-date 2026-07-01 --end-date 2026-09-30`. These
commands read the local ZIP; only the explicit `--download` option fetches CTAN data.

`just locations-probe` is a separate investigation. It contacts CTAN location endpoints, compares
their identifiers with stops in the local ZIP, and writes raw replies and a report under
`data/source/ctan-location-probe/`. It never edits the browser JSON. The commands and crosswalk code live under
`scripts/experiments/`. Their rules are tested offline; tests do not contact transit services. Review its captured
hierarchy before updating the tracked directory that the snapshot builder reads.

`just locations-coordinates` uses the checked-in network snapshot to write two candidate points
for each local area with selected stops into the reviewed location directory: the average stop
position and the stop nearest to the others overall. It omits points for areas without selected
stops and removes older municipality candidates. It makes no network requests. Review the directory
diff after running it. The snapshot builder uses each representative stop as the local area's
reference point for default journey stop selection.

## Setup and commands

Requires Node.js 24, npm 11, and [just](https://just.systems/).
The Vite commands use its native config loader, which reads the TypeScript config directly on Node 24.

```powershell
just install
just dev
```

Open `http://127.0.0.1:5173`; stop the development server with Ctrl+C. `just --list` prints all
available commands. Common commands:

| Command                           | What it does                                              |
| --------------------------------- | --------------------------------------------------------- |
| `just dev`                        | Runs the website locally with Vite                        |
| `just build`                      | Type-checks and builds static deployment files in `dist/` |
| `just preview`                    | Serves the existing `dist/` build locally                 |
| `just data`                       | Builds the rolling-year snapshot from the local GTFS ZIP  |
| `just data-refresh`               | Downloads GTFS, then builds the rolling-year snapshot     |
| `just locations-probe`            | Captures CTAN location evidence under ignored source data |
| `just locations-coordinates`      | Derives candidate local-area points from tracked stops    |
| `just test`                       | Runs focused offline data tests with Node's test runner   |
| `just typecheck`                  | Checks TypeScript without writing build files             |
| `just lint` / `just format-check` | Checks code rules / formatting                            |
| `just check`                      | Runs lint, formatting, tests, and production build        |

Storybook may be useful later if the app grows enough shared components to benefit from isolated
visual examples. For now, develop components in the app and keep interaction checks focused on
behavior that needs them.

## Code conventions

- Keep TypeScript strict and prefer the smallest direct implementation that meets the feature.
- Give each non-UI module a top-level TSDoc/JSDoc comment that explains its purpose in plain words.
  Include when it runs and what it reads or produces when that helps a newcomer understand it. Do
  not add these module summaries to React components or page files.
- Give every function a concise TSDoc/JSDoc contract. Explain important assumptions or source-data
  quirks where needed; don't repeat parameter types or narrate syntax.
- In non-trivial functions, add a few short inline comments at meaningful stages so a reader can
  scan the steps and understand the reasoning. Comment on intent, invariants, or surprising choices;
  avoid explaining obvious statements or commenting every line.
- Keep React components focused on rendering and interaction. Put reusable parsing, validation,
  indexing, and search logic in cohesive `src/data/` modules.
- Put every user-facing string in both `src/i18n/en.json` and `src/i18n/es.json`.
- Keep tests offline and focused on meaningful behavior and failure cases.

Tests sit next to the responsibility they exercise: GTFS archive/conversion tests in `scripts/gtfs/`,
reviewed-input tests in `scripts/reviewed/`, experimental tests in `scripts/experiments/`, and browser
data tests in `src/data/`. `npm test` discovers `*.test.ts` in both trees using Node's test runner.
Fixtures remain small and local to tooling; application tests use application-shaped data.

`npm run typecheck` checks browser code without Node globals, then tooling and tests with
Node types. ESLint rejects Node/tooling imports in browser code, React imports in data modules, and
experimental imports in production data generation. Tests can use Node for offline fixtures.
Formatting skips generated sites, caches, and ignored source evidence.

See [Architecture](architecture.md) for the current data boundaries and [Product](product.md) for
what the app is meant to do.
