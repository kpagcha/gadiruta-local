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
- **Storybook** renders components and their saved visual states outside the application flow.
- **ESLint** and **Prettier** check code quality and formatting.
- **Zod** validates the small GTFS field subsets consumed by the offline snapshot processor.
- **Node's test runner** runs the focused local data tests.

## Repository layout

Keep this overview current when a tracked directory gains or changes a responsibility.

```text
src/           Browser application: components, pages, local-data code, translations, and styles.
public/data/   Reviewed static network snapshot served to the browser.
scripts/       Developer-only GTFS snapshot processor and its focused fixtures/tests.
.storybook/    Storybook configuration; component stories live beside components in src/.
docs/          Product, architecture, and contributor documentation.
data/source/   Ignored local CTAN ZIP used only when rebuilding the reviewed snapshot.
```

`package.json` defines npm tasks and dependencies; `justfile` provides the project command aliases.
Neither `scripts/` nor `data/source/` is part of the deployed application runtime.

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
just storybook      # develop component stories at http://127.0.0.1:6006
just storybook-build # build the separate static Storybook site
just test          # local GTFS transformation and runtime-contract tests
just typecheck     # strict TypeScript checks without build output
just lint          # JavaScript and TypeScript linting
just format-check  # formatting verification
just build         # type-check and create deployable static files
just check         # lint, formatting, tests, and production build
just preview       # serve a completed production build locally
just format        # deliberately rewrite files using the shared formatting rules
```

Stories live beside their components as `*.stories.tsx`. They provide isolated, manually
inspectable visual states; they do not call CTAN or replace the focused automated tests.

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

Use these practices when changing the project:

- Prefer the smallest explicit design that meets the current requirement. KISS, YAGNI, and the
  Rule of Three mean small local duplication is acceptable until repeated use proves an abstraction
  is needed.
- Split code only at a real responsibility boundary. Do not add layers, services, adapters,
  repositories, factories, or interfaces merely to make the code look more architectural.
- Keep modules cohesive by concept. Prefer pure functions for parsing, normalization, indexing,
  calendar handling, and journey calculations.
- Use strict TypeScript and no `any` without a documented concrete reason.
- Write a concise TSDoc/JSDoc block for every function. Describe its contract; add the why,
  invariant, source-data assumption, or quirk when it is not obvious. Do not narrate syntax or
  mechanically repeat parameter types.
- Keep React components focused on rendering and interaction; reusable non-UI logic belongs in
  ordinary TypeScript modules or hooks. All user-facing text belongs in both translation files
  under `src/i18n/`.
- Do not optimize or generalize before a real feature needs it.

Tests use small saved GTFS tables and never contact live transit services. Focus them on meaningful
failure risks: parsing, upstream quirks, normalization, reference integrity, date/calendar rules,
indexes, journey calculations, and important interactions as those features are added. Avoid
snapshot suites, trivial component tests, and implementation-detail tests. The current project uses
Node's built-in test runner to keep this small; introduce Vitest and Testing Library only when a
browser interaction test makes them worthwhile.
