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
│   ├── pages/                    Full-page content (currently HomePage)
│   ├── components/               Reusable interface pieces and their Storybook stories
│   │   └── ui/                   Shared shadcn Base UI select parts and app styling
│   ├── data/                     Browser-side network loading, journey search, URL and calendar helpers
│   ├── i18n/                     English/Spanish text and language setup
│   ├── styles/                   Global CSS and Tailwind entry point
│   └── theme.ts                  Browser theme preference and document synchronization
├── public/                       Files copied as-is to the site root during build
│   ├── data/                     Checked-in network JSON fetched by the browser
│   ├── fonts/                    Font license and other public font files
│   └── favicon.svg               Browser tab icon
├── scripts/                      Developer-run data tools; never imported by the website
│   ├── gtfs-archive.ts           Reads ZIP entries and parses GTFS CSV tables
│   ├── build-network-data.ts     Selects and writes the browser network snapshot
│   ├── place-stop-assignments.json Reviewed stop-to-place IDs used during snapshot generation
│   ├── ctan-location-crosswalk.ts Parses CTAN location replies and checks stop coverage
│   ├── probe-ctan-locations.ts   Explicit live CTAN investigation; saves audit evidence
│   ├── *.test.ts                 Offline tests for data tooling
│   └── fixtures/                 Small saved input examples used by those tests
├── data/source/                  Ignored downloaded GTFS ZIP and probe captures (local only)
├── docs/                         Product, architecture, and contributor guides
├── .storybook/                   Storybook configuration; stories sit by components in src/
├── package.json                  npm scripts and dependency list
├── package-lock.json             Exact installed dependency versions
├── justfile                      Friendly command names that call npm scripts
├── vite.config.ts                Vite development server and build configuration
└── tsconfig.json                 Strict TypeScript settings
```

Generated or local-only directories such as `node_modules/`, `dist/`, `storybook-static/`, and
`.idea/` are omitted from the tree. The two directories with the word `data` have different roles:

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
  → HomePage uses useNetworkDataset()
  → src/data/network.ts fetches /data/bahia-cadiz-network.json
  → network-schema.ts validates the JSON before use
  → location-search.ts combines network stops with curated places
  → TripLocationPicker displays local search choices
  → direct-journeys.ts searches trips and calendars after date/location selection
```

After a search, `HomePage` places the persistent form next to a separate `DirectJourneyResults`
card on desktop, or above it on mobile. `search-url.ts` maps shareable browser URLs to local places,
stops, dates, and times; `direct-journeys.ts` supplies and divides the local journey list.

The `public/data` URL is served by Vite in development and by any ordinary static host in
production. Browser code never imports `scripts/`, reads `data/source/`, or calls CTAN. There is no
Gadiruta server process or runtime database. Language and theme preferences are handled in the
browser and may be saved in local storage.

## How the network JSON is made

```text
CTAN GTFS ZIP
  → data/source/ctan-gtfs.zip (local input, ignored by Git)
  → scripts/gtfs-archive.ts reads ZIP and CSV
  → scripts/build-network-data.ts selects Bahía routes, stops, trips, and calendars
  → scripts/place-stop-assignments.json adds reviewed place IDs
  → public/data/bahia-cadiz-network.json (reviewed and tracked)
  → browser loads and validates it as above
```

`just data` rebuilds the snapshot from the local ZIP. `just data-refresh` downloads a new ZIP from
CTAN and rebuilds it, so it needs network access and should be an intentional refresh. Review the
JSON diff before committing. Review place assignments separately when changing geographic scope.
The app can be developed from a fresh checkout without the ZIP because
the reviewed JSON is already present.

`just locations-probe` is a separate investigation. It contacts CTAN location endpoints, compares
their identifiers with stops in the local ZIP, and writes raw replies and a report under
`data/source/ctan-location-probe/`. It never edits the browser JSON. The corresponding parser and
crosswalk rules are tested offline; tests do not contact transit services.

## Setup and commands

Requires Node.js 24, npm 11, and [just](https://just.systems/).
The Vite commands use its native config loader, which reads the TypeScript config directly on Node 24.

```powershell
just install
just dev
```

Open `http://127.0.0.1:5173`; stop the development server with Ctrl+C. `just --list` prints all
available commands. Common commands:

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `just dev`                        | Runs the website locally with Vite                           |
| `just build`                      | Type-checks and builds static deployment files in `dist/`    |
| `just preview`                    | Serves the existing `dist/` build locally                    |
| `just data`                       | Builds the tracked network JSON from the local GTFS ZIP      |
| `just data-refresh`               | Downloads GTFS from CTAN, then builds the network JSON       |
| `just locations-probe`            | Captures CTAN location evidence under ignored source data    |
| `just test`                       | Runs focused offline data tests with Node's test runner      |
| `just typecheck`                  | Checks TypeScript without writing build files                |
| `just lint` / `just format-check` | Checks code rules / formatting                               |
| `just check`                      | Runs lint, formatting, tests, and production build           |
| `just storybook`                  | Opens isolated component examples at `http://127.0.0.1:6006` |

Stories are saved interface examples, not separate app pages. They live next to the component they
demonstrate and can be opened in Storybook without running the app flow.

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

See [Architecture](architecture.md) for the current data boundaries and [Product](product.md) for
what the app is meant to do.
