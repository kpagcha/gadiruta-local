# Development

## Tooling

You only need Node.js 24, npm 11, and [just](https://just.systems/) installed to work on this
project. The rest is managed by the project itself.

- **Node.js** runs the tools that prepare the web app. It does not run a Gadiruta backend.
- **just** provides the short project commands. Run `just --list` to see them.
- **npm** downloads JavaScript packages and runs the underlying tasks for `just`.
- **React** builds the interface in `src/`.
- **TypeScript** adds error checking before code reaches a browser; use `just typecheck` to run it.
- **Vite** starts the local site and creates static files for deployment.
- **Tailwind CSS** supplies the styling classes used in React components.
- **ESLint** and **Prettier** check code quality and formatting; `just check` runs them.

## Start the app

Run these commands from the repository root in PowerShell:

```shell
just install
just dev
```

`just install` downloads the exact versions recorded by the project, so everyone starts from the
same set of tools. It is normally needed after cloning or after package dependencies change.

`just dev` starts a local development website. Open `http://127.0.0.1:5173` in a browser. Keep that
command running while you work; Vite refreshes the page when you save a source file. Stop it with
`Ctrl+C`.

## Check a change

```shell
just check
```

`just check` runs the usual pre-commit checks: linting, formatting verification, and a production
build. The build includes a TypeScript check and asks Vite to create the static files that a web host
would serve.

Use `just --list` to see every available command. The most useful individual ones are `just lint`,
`just typecheck`, `just build`, and `just preview`.

To reformat files deliberately:

```shell
just format
```

## Code and tests

Use strict TypeScript. Keep React components focused on rendering and interaction; put reusable
data logic in ordinary TypeScript modules or hooks. User-facing text belongs in both translation
files under `src/i18n/`.

There is no automated test runner yet because the app has no data-query behaviour to test. Add
Vitest and Testing Library with the first data-backed feature, focusing on GTFS parsing,
normalization, dates, local indexes, direct-journey calculations, and important interactions. Tests
must not call live transit services.
