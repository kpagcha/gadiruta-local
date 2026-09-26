# Developer guide

Start with the [README](../README.md) to run the app. This guide explains where its data comes from,
where to make a change, and how to check your work.

## How it works

Gadiruta Local is a static website. The deployed app has no server or database of its own. The
browser loads a checked-in timetable file and searches it locally. Node.js runs only the developer
commands that prepare that file and build the website.

CTAN, the regional transit data provider, supplies the timetable ZIP.

```text
CTAN timetable ZIP in data/source/ctan/ + reviewed locations in data/reviewed/ctan/
  → developer-run data script
  → checked-in network JSON in public/data/
  → browser loads and searches that JSON
```

The ZIP uses GTFS, a common format for transit schedules. Each folder has one job:

- `data/source/ctan/` holds the downloaded ZIP and saved research responses. Git ignores it; the app
  does not need it to run.
- `data/reviewed/ctan/` holds checked-in decisions about CTAN stop locations and place assignments.
  The builder needs these when it regenerates the network file.
- `scripts/ctan/` contains the developer-only command and code that read those inputs, select Bay
  of Cádiz services, and write the finished network file. Its `research/` folder has optional
  location tools that run separately from a normal refresh.
- `public/data/` holds the checked-in result that the browser loads and searches. The browser
  never contacts CTAN.

## Where to look

| If you need to...                    | Start in...                                        |
| ------------------------------------ | -------------------------------------------------- |
| Change what people see               | `src/pages/` and `src/components/`                 |
| Change network loading or theme      | `src/hooks/`                                       |
| Change place or journey search       | `src/data/`                                        |
| Change the network file's format     | `src/data/network-schema.ts`                       |
| Change timetable preparation         | `scripts/ctan/`                                    |
| Investigate or review stop locations | `scripts/ctan/research/` and `data/reviewed/ctan/` |

Tests mirror the source folders under `tests/src/` and `tests/scripts/`, with saved examples in
`tests/fixtures/`.

## Day-to-day commands

Use Node.js 24, npm 11, and [just](https://just.systems/). Run `just install` once, then `just dev`
to open the site at `http://127.0.0.1:5173`. Run `just check` before committing; it checks formatting,
lint, tests, types, and the production build. `just --list` shows the other commands.

## Updating transit data

Put the original CTAN GTFS ZIP at `data/source/ctan/gtfs.zip` and run `just data`. Run
`just data-refresh` when you intentionally want to download a fresh ZIP from CTAN first. The
script writes the checked-in file in `public/data/`; review that diff before committing it.

The data script limits the file's date range to what the source provides. It also requires reviewed
locations for selected stops rather than guessing them. A saved timetable has limited date
coverage, so it needs an intentional refresh when the source changes or expires.

Location research is separate from this routine build. `just locations-probe` saves CTAN responses
under ignored `data/source/ctan/`; `just locations-coordinates` writes candidate points to the tracked
location directory. Review those findings before using them to rebuild the network file or
committing them. CTAN location information can be incomplete or misleading: leave an area unknown
when it cannot be established, rather than inferring it from a stop name or coordinates. The tests
under `tests/scripts/ctan/research/` record the specific provider quirks.

## Working on the app

Keep rendering and interaction in React components. Put timetable rules and other data work in
ordinary TypeScript under `src/data/`; keep Node-only code in `scripts/`. Add user-facing text to
both `src/i18n/en.json` and `src/i18n/es.json`. Tests should use local examples, not live CTAN
requests.

Storybook may be useful if the app later has enough shared components to need isolated visual
examples. For now, develop them in the app and test meaningful behavior directly.
