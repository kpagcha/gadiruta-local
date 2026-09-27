# Developer guide

Start with the [README](../README.md) to run the app. This guide explains where its data comes from,
where to make a change, and how to check your work.

## How it works

Gadiruta Local is a static website. The deployed app has no server or database of its own. The
browser loads a checked-in timetable file and searches it locally. Node.js runs only the developer
commands that prepare that file and build the website.

Explore uses paths under `/explore/`. A static host serving the production build must return
`index.html` for direct visits to those paths, while serving assets and `/data/` as files.
The local development build also has `/dev/settings` for browser-only experiments with line colors,
recent searches, and theme palettes. It is absent from production builds; a hidden URL would not be
access control on a static site. Reset on that page removes its saved browser settings.
Place paths use the area name alone when it differs from its municipality; `/all` selects the whole
municipality. When both scopes have the same stops, the plain path and `/all` resolve to the same place.
Direct-search place values use the same convention.
Line paths use the official label alone when it is unique. If labels repeat, the official route
description distinguishes them. Tests check the reviewed snapshot for unresolved collisions after a
data refresh. Source IDs are not accepted as line paths.
Line pages accept optional `path`, `date`, `run`, `mode=trips`, and `view=stops` query values. A path alias names the
exact ordered stop sequence by its endpoints, adding a stop count only when endpoints repeat. A
dated view includes only trips following that sequence that start on the selected service date.
Both Stops and Trips include their visits after midnight on the next day. A plain line URL defaults to today's schedule;
`view=stops` keeps the date cleared. A `run` token names a departure time within the selected date
and path, with a number when several buses share that time. `mode=trips` restores the trip list with
the selected run expanded. These links use the saved snapshot's explicit service dates,
not a generic weekday or holiday timetable.
Path averages use the saved trips for the chosen path and date, or all saved trips when the date is
cleared. Durations subtract the first departure from the last arrival, including after midnight.
The `data/reviewed/ctan/line-path-labels.json` catalogue names paths that need more than a simple
outward and return pair. It keys each line by its official short name and each exact stop sequence
by its path URL alias. The line page uses its English and Spanish names, falling back to generated
endpoint labels for paths absent from the catalogue. Check the keys after refreshing the network
snapshot; a changed stop sequence can gain a different alias.

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
- `data/reviewed/ctan/` holds checked-in decisions about CTAN stop locations and labels for line
  paths with more than a simple outward and return pair. The builder needs the stop locations when
  it regenerates the network file; the browser bundles the path labels for the line page.
- `scripts/ctan/` contains the developer-only command and code that read those inputs, select Bay
  of Cádiz services, and write the finished network file. Its `research/` folder has optional
  location tools that run separately from a normal refresh.
- `public/data/` holds the checked-in result that the browser loads and searches. The browser
  never contacts CTAN.

## Where to look

| If you need to...                     | Start in...                                        |
| ------------------------------------- | -------------------------------------------------- |
| Change what people see                | `src/pages/` and `src/components/`                 |
| Change network loading or theme       | `src/hooks/` and `src/data/dev-settings.ts`        |
| Change place, line, or journey lookup | `src/data/`                                        |
| Change the network file's format      | `src/data/network-schema.ts`                       |
| Change timetable preparation          | `scripts/ctan/`                                    |
| Investigate or review stop locations  | `scripts/ctan/research/` and `data/reviewed/ctan/` |

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
