# Developer guide

Start with the [README](../README.md) to run the app. This guide explains where its data comes from,
where to make a change, and how to check your work.

## How it works

Gadiruta Local is a static website. The deployed app has no server or database of its own. The
browser loads a checked-in timetable file and searches it locally. Node.js runs only the developer
commands that prepare that file and build the website.

CTAN, the regional transit data provider, supplies the timetable ZIP.

```text
CTAN timetable ZIP + reviewed stop locations
  → developer-run data script
  → checked-in network JSON in public/data/
  → browser loads and searches that JSON
```

The ZIP uses GTFS, a common format for transit schedules. The data script selects services around
the Bay of Cádiz and turns them into the smaller file the app needs. The browser never contacts CTAN; it
works from the saved file even when the original ZIP is unavailable.

## Where to look

| If you need to...                    | Start in...                                         |
| ------------------------------------ | --------------------------------------------------- |
| Change what people see               | `src/pages/` and `src/components/`                  |
| Change network loading or theme      | `src/hooks/`                                        |
| Change place or journey search       | `src/data/`                                         |
| Change the network file's format     | `src/data/network-schema.ts`                        |
| Change timetable conversion          | `scripts/gtfs/` and `scripts/build-network-data.ts` |
| Investigate or review stop locations | `scripts/experiments/` and `scripts/reviewed/`      |

Tests mirror the source folders under `tests/src/` and `tests/scripts/`, with saved examples in
`tests/fixtures/`. `public/data/bahia-cadiz-network.json` is the reviewed file
served to the browser. `data/source/` holds downloaded inputs and investigation results on your
machine; Git ignores it.

## Day-to-day commands

Use Node.js 24, npm 11, and [just](https://just.systems/). Run `just install` once, then `just dev`
to open the site at `http://127.0.0.1:5173`. Run `just check` before committing; it checks formatting,
lint, tests, types, and the production build. `just --list` shows the other commands.

## Updating transit data

Put the original CTAN GTFS ZIP at `data/source/ctan-gtfs.zip` and run `just data`. Run
`just data-refresh` when you intentionally want to download a fresh ZIP from CTAN first. The
script writes the checked-in file in `public/data/`; review that diff before committing it.

The data script limits the file's date range to what the source provides. It also requires reviewed
locations for selected stops rather than guessing them. A saved timetable has limited date
coverage, so it needs an intentional refresh when the source changes or expires.

Location research is separate from this routine build. `just locations-probe` saves CTAN responses
under ignored `data/source/`; `just locations-coordinates` writes candidate points to the tracked
location directory. Review those findings before using them to rebuild the network file or
committing them. CTAN location information can be incomplete or misleading: leave an area unknown
when it cannot be established, rather than inferring it from a stop name or coordinates. The tests
under `tests/scripts/experiments/` record the specific provider quirks.

## Working on the app

Keep rendering and interaction in React components. Put timetable rules and other data work in
ordinary TypeScript under `src/data/`; keep Node-only code in `scripts/`. Add user-facing text to
both `src/i18n/en.json` and `src/i18n/es.json`. Tests should use local examples, not live CTAN
requests.

Storybook may be useful if the app later has enough shared components to need isolated visual
examples. For now, develop them in the app and test meaningful behavior directly.
