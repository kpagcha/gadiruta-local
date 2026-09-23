# Gadiruta Local agent instructions

Gadiruta Local is a Cádiz-focused, local-first static React application. Its product scope is in
`docs/product.md`, and its current technical boundary is in `docs/architecture.md`.

## Workflow

Before changing code, inspect the relevant source and documentation, then run `git status`. Work in
small vertical slices: implement, run relevant checks, review the diff, update documentation, and
create a focused Conventional Commit.

Do not retain or introduce a permanent application backend, database, or direct CTAN REST calls
without a concrete, documented need. The browser should eventually consume preprocessed static
transit data and query it locally.

## Engineering practice

- Apply KISS, YAGNI, and the Rule of Three: solve the present requirement plainly, tolerate small
  local duplication, and extract an abstraction only after repeated real use proves one is needed.
- Separate genuinely different responsibilities, but do not invent layers, services, adapters,
  repositories, factories, or interfaces merely to make the project look architectural.
- Prefer explicit control flow and ordinary TypeScript over cleverness. Keep modules cohesive by
  concept rather than arbitrary file length, and prefer pure functions for data transformations.
- Use strict TypeScript. Do not use `any` without a concrete, documented reason.
- Add a top-level TSDoc/JSDoc comment to each non-UI module/file, especially data and tooling
  modules. Explain what the file is for in plain, familiar words a newcomer can understand. Include
  when it runs and what it reads, changes, or produces when that context helps explain its purpose.
  Avoid short labels or technical terms without explanation. Do not add module summaries to React
  components or page files.
- Write a concise TSDoc/JSDoc block for every function. State its contract; for non-obvious code,
  explain the invariant, assumption, external-data quirk, or reason behind the implementation
  instead of narrating syntax or mechanically repeating parameter types.
- In non-trivial functions, add a few short inline comments at meaningful stages to help readers
  scan the steps and understand the reasoning. Explain intent, invariants, or surprising choices;
  do not comment obvious statements or every line.
- Do not optimize or generalize before a real feature demonstrates the need.

## Frontend

- Use React, strict TypeScript, Vite, react-i18next, and the existing lightweight styling system.
- Keep dependencies small. Prefer browser APIs and ordinary TypeScript over libraries or generic
  architecture.
- Keep components focused on rendering and interaction. Put reusable parsing, normalization,
  indexing, calendar, and journey logic in cohesive TypeScript modules.
- Prefer pure functions for data work where practical.
- All user-facing strings must go through `src/i18n/en.json` and `src/i18n/es.json`.
- Keep the app mobile-first, spacious, accessible, and bilingual.

## Data and tests

Do not design a complete GTFS importer or local database before a feature needs it. Verify uncertain
upstream data assumptions and save small representative fixtures when they affect code. Record
important source-data findings in `docs/architecture.md` until they justify their own document.

Use the existing focused test runner for meaningful behaviour. Add Vitest and Testing Library only
when browser interaction tests make them a concrete need. Tests must not rely on live upstream
services.

`public/data/bahia-cadiz-network.json` is a reviewed, versioned data snapshot and is deliberately
tracked so the app can run offline after checkout. Its downloaded input under `data/source/` remains
ignored; this is the narrow exception to the generated-output rule below.

## Documentation

Keep the small documentation set concise and non-overlapping:

- `README.md`: orientation, commands, and milestone checklist.
- `docs/product.md`: user and scope definition.
- `docs/architecture.md`: current boundaries, data direction, and durable technical choices.
- `docs/development.md`: contributor workflow, tool explanation, and repository layout.

Keep the repository-layout overview in `docs/development.md` current when a tracked directory gains
or changes a responsibility.

## Git

Never commit secrets, disposable generated output, `node_modules`, or editor state. The reviewed
network snapshot described above is the only exception. Avoid destructive Git operations. Use
small, focused Conventional Commits such as `feat: add local place index` or
`refactor: simplify static data loading`.
