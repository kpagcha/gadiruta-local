# Development

## Tooling

Install Node.js 24, npm 11, and [just](https://just.systems/). The project supplies the rest.

- **Node.js** runs the build, data processor, and focused test runner; it does not run a Gadiruta
  backend.
- **just** exposes the project commands. Run `just --list` to see them.
- **npm** installs the locked JavaScript packages and calls the underlying project tasks.
- **React** renders the interface in `src/`.
- **TypeScript** type-checks browser code and the local GTFS processor.
- **Vite** serves the development site and creates deployable static files.
- **Tailwind CSS** supplies the styling classes used by components.
- **ESLint** and **Prettier** check code quality and formatting.
- **Node's test runner** runs the focused, dependency-free data tests.

## Start the app

Run these commands from the repository root in PowerShell:

```shell
just install
just dev
```

Open `http://127.0.0.1:5173` in a browser. Keep the command running while you work; Vite refreshes
the page when source files change. Stop it with `Ctrl+C`.

## Commands

```shell
just data          # rebuild the checked-in snapshot from a local GTFS ZIP
just data-refresh  # download CTAN GTFS, then rebuild that snapshot
just test          # local GTFS transformation and runtime-contract tests
just typecheck     # strict TypeScript checks without build output
just lint          # JavaScript and TypeScript linting
just format-check  # formatting verification
just build         # type-check and create deployable static files
just check         # lint, formatting, tests, and production build
just preview       # serve a completed production build locally
just format        # deliberately rewrite files using the shared formatting rules
```

## Network data

The app runs from the checked-in `public/data/bahia-cadiz-network.json` snapshot. Its raw CTAN
input is intentionally not committed.

1. Download `https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip`.
2. Save it unchanged as `data/source/ctan-gtfs.zip`.
3. Run `just data`.
4. Review the JSON diff, then run `just check`.

`just data-refresh` performs the download and processing in one explicit command. Do not put it in
normal checks or application startup: it needs upstream access and refreshes a reviewed source
snapshot.

## Code and tests

Use strict TypeScript. Keep React components focused on rendering and interaction; put reusable
data logic in ordinary TypeScript modules or hooks. All user-facing text belongs in both
translation files under `src/i18n/`.

Tests use small saved GTFS tables and never contact live transit services. Focus them on meaningful
failure risks: parsing, upstream quirks, normalization, reference integrity, date/calendar rules,
indexes, journey calculations, and important interactions as those features are added. Avoid
snapshot suites and implementation-detail tests.
