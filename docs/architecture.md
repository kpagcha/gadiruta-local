# Architecture

## Runtime boundary

Gadiruta Local is a static website. The browser downloads the app and its network JSON from a static
host, then searches the loaded data on-device. There is no Gadiruta application server, database,
runtime proxy, or browser request to CTAN.

The step-by-step app flow and the commands that prepare the JSON are in the [development guide](development.md).

## Network data shape

The browser-facing file, `public/data/bahia-cadiz-network.json`, contains the parts of GTFS needed by
local search and direct journey results:

- the selected transport agency and its routes;
- physical stops and their coordinates; and
- ordered stop lists showing which stops each route serves;
- a reviewed single place assignment for each confidently located stop; and
- timed trips, weekly service calendars, and date exceptions.

The file also records its format version and the hash of the GTFS ZIP used to produce it. The
processor and browser both check that the data has the expected fields and that routes and stops
refer to entries that exist. ZIP and CSV details stay in developer scripts, so browser code only
needs to handle this smaller format.

The processor selects agency `CMTBC` only when its name matches the expected Bahía de Cádiz
Consortium. The agency ID defines which network is in scope; stop names and coordinates do not. The
current file does not include shapes, fares, or alerts.

The JSON is checked into Git so a fresh checkout can run without downloading CTAN data. The original
downloaded ZIP stays ignored under `data/source/`. For where these files live and how to refresh
them, see the [development guide](development.md).

## Places and physical stops

A place is a name people recognize, such as Cádiz or Rota. A stop is one exact bus boarding point.
The app keeps them as separate search choices. The reviewed assignment in
`scripts/place-stop-assignments.json` connects 204 of the 263 selected physical stops to one
rider-facing place each. Named smaller areas such as Costa Ballena, Jédula, and Río San Pedro have
their own assignments; a town choice covers its built-up core. Isolated and ambiguous roadside
stops remain available by exact stop name. The ignored geographic report was used as a review
checklist and is never browser input.

The names in `src/data/places.ts` are maintained by the project. GTFS stop records do not contain
the municipality or smaller-area IDs needed to connect every stop to those names. The separate CTAN
location probe investigates that relationship, but its results are not part of the browser data.
Rota stops `2_349` and `2_350` and the Cádiz and Rota ferry terminals are explicitly assigned;
Venta El Cepo remains exact-stop-only because it lies outside the built-up core.

## Direct journeys and coverage

The browser checks the version-two snapshot before searching. A direct journey uses one trip, with
boarding before alighting and GTFS pickup/drop-off permissions applied. The selected date covers the
whole local day, including departures earlier today. Trips scheduled on the previous service date
are also considered when their GTFS stop time is `24:00` or later. A calendar exception overrides
the weekly rule. The result card offers alternative matching stops on the same trip. Its default is
the earliest valid boarding, or the first boarding at or after an optional departure time, followed
by the earliest reachable alighting. The full local result is split into four-card visual pages:
earlier and later controls reveal adjacent groups without another data request. A trip appears only
once even when it has several matching boarding stops.

The home page writes `from`, `to`, `date`, and optional `depart_after` into browser history on submit.
It resolves those IDs against the checked-in place and stop choices when a link loads or browser
history changes. `jerez` is the short public slug for the local `jerez-de-la-frontera` place ID;
both forms are accepted. Invalid or incomplete links do not run a journey search.

The current local ZIP has 1,249 Bay trips, 16,150 timed stop visits, and 114 used weekly calendars.
The weekly calendars span 2021-06-01 through 2026-12-31; that span bounds the travel date input.
The UI shows an expired-data message once the current Cádiz date passes the end. This is source
coverage, not a promise that every date or location pair has a departure.
The time pill keeps exact typed minutes. Its 15-minute arrows change the date at midnight and
disable a step beyond the snapshot coverage. A first arrow press on an empty time fills the current
Cádiz time rounded down to a quarter hour.
The form normalizes compact clock entries before searching and omits an unrecognized time from
`depart_after`, so the local journey filter always receives a valid clock time or no cutoff.
All selected source stop times have whole-minute values; the generator rejects nonzero seconds so
later feed changes cannot be rounded silently.

## CTAN location findings

CTAN's all-stops list omits some stops that are available from individual stop lookups. Its line-stop
response also uses a field named `idNucleo` to return a municipality ID. That value can identify a
municipality, but it does not establish the smaller area (nucleus) a stop belongs to. The current
probe report keeps those cases unresolved. Names and coordinates are not used to guess missing
relationships.

These findings explain why place assignments are reviewed conservatively. They are source-data
limitations, not part of the website's runtime request flow.

## Future boundaries

- Keep browser data static and query it locally. Add a backend, database, or direct CTAN calls only
  when a concrete feature requires them and the need is documented.
- Keep parsing, validation, indexing, calendar rules, and journey calculations outside React
  components as those features are added.
- Keep tests offline. Save small examples for upstream data quirks that affect the code.
- Add local persistence, a service worker, or automated data refresh only when a feature establishes
  the need and its behavior can be specified.
