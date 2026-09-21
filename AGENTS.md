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

Use Vitest and Testing Library selectively for meaningful behaviour. Tests must not rely on live
upstream services.

## Documentation

Keep the small documentation set concise and non-overlapping:

- `README.md`: orientation, commands, and milestone checklist.
- `docs/product.md`: user and scope definition.
- `docs/architecture.md`: current boundaries, data direction, and durable technical choices.
- `docs/development.md`: contributor workflow and tool explanation.

## Git

Never commit secrets, generated output, `node_modules`, or editor state. Avoid destructive Git
operations. Use small, focused Conventional Commits such as `feat: add local place index` or
`refactor: simplify static data loading`.
