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
- physical stops, their coordinates, and their CTAN municipality and local-area relationships;
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
The app keeps them as separate search choices. The tracked CTAN location directory records 15
municipalities, 44 local areas, and the location of all 263 selected stops. The curated place list
covers all local areas with selected stops. Where a municipality has a matching town area and other
served areas, its plain-name choice searches the town area; its explicit all-stops choice keeps the
existing municipality URL ID and searches the whole municipality. A municipality with only town
stops retains one choice. Named local-area searches use CTAN membership. Suggestions group places,
served local areas, and exact stops. A matched municipality expands stops only from its matching
town area; a matched local area expands its own stops. Name matching ignores accent, case, and word
order, and the picker reveals further matches within each group on request.
The earlier reviewed assignments in `scripts/place-stop-assignments.json` remain in the snapshot
for places without a CTAN link. The ignored geographic report was used as a review checklist and
is never browser input.

The names and URL IDs in `src/data/places.ts` are maintained by the project and linked to reviewed
CTAN location IDs. GTFS does not supply municipality or local-area IDs; the builder reads the tracked
directory extracted from the separate CTAN probe. Two Rota stops have a known municipality but no
resolved local area, so they can match Rota without a local-area label.

The reviewed directory holds an average position and a representative stop for each local area
with selected stops. The snapshot carries the representative stop's coordinates as that area's
reference point. A municipality search uses its uniquely matched same-named town area; a named
local-area search uses its own point. These points are derived from stops, not supplied by CTAN.
Costa Ballena is linked to Rota's local area only; its stable place ID remains `costa-ballena`.

## Direct journeys and coverage

The browser checks the version-five snapshot before searching. A direct journey uses one trip, with
boarding before alighting and GTFS pickup/drop-off permissions applied. The selected date covers the
whole local day, including departures earlier today. Trips scheduled on the previous service date
are also considered when their GTFS stop time is `24:00` or later. A calendar exception overrides
the weekly rule. The result card starts with stops matching the search, then lets riders choose any
pair on the same trip where boarding and alighting are permitted in that order. These card choices
do not change the search URL. After applying the departure cutoff, the initial pair minimizes the
sum of straight-line distances from the origin and destination reference points, with equal weight
at both ends. Ties use the earliest departure, then arrival. A town area is found through a
normalized exact or unique shortened name match; an absent or ambiguous match contributes no
distance preference. The full local result is split into four-card visual pages:
earlier and later controls reveal adjacent groups without another data request. A trip appears only
once even when it has several matching boarding stops.

The home page writes `from`, `to`, and `mode=now` for Leave now, or `from`, `to`, `date`, and optional
`depart_after` for Depart at. A Leave now search applies the current Cádiz minute as its departure
cutoff. Existing links with a current or future date restore Depart at; past dates cannot start a
search. The form normalizes compact clock entries before searching and omits an unrecognized time
from `depart_after`, so the local journey filter receives a valid clock time or no cutoff.

Place values use their maintained IDs. Stop values combine a readable name slug with an eight-character
token derived from the source stop ID; the token identifies the stop even if its name changes. The
snapshot validator rejects token collisions, and links containing a raw stop ID remain readable.
Invalid or incomplete links do not run a journey search.

The browser keeps the most recent distinct origin-to-destination searches in local storage as
shareable search queries. The project-controlled limit is in `src/config.ts`. Saved queries are
resolved against the current network snapshot before display; unavailable places or stops are
discarded, and a past Depart at date becomes Leave now. Selecting a recent search uses the same
local search and URL update as a new selection. Browser storage errors do not block searching.

The current local ZIP has 1,249 Bay trips, 16,150 timed stop visits, and 114 used weekly calendars.
Its Bay calendars span 2021-06-01 through 2026-12-31. The reviewed snapshot limits visible travel
dates to 2026-01-01 through 2026-12-31: the project builder requests the current Cádiz year and
the next, then clips that request to the source coverage. This feed has no Bay service in 2027.
The builder keeps a preceding service day only for trips with after-midnight stop times, so journeys
just after midnight on the first visible date remain searchable. The UI shows an expired-data
message once the current Cádiz date passes the end. Coverage is not a promise that every date or
location pair has a departure.

All selected source stop times have whole-minute values; the generator rejects nonzero seconds so
later feed changes cannot be rounded silently.

## CTAN location findings

CTAN's all-stops list omits some stops that are available from individual stop lookups. Its line-stop
response also uses a field named `idNucleo` to return a municipality ID. That value can identify a
municipality, but it does not establish the local area a stop belongs to. The current
probe report keeps those cases unresolved. Coordinates and stop names are not used to guess missing
relationships.

The tracked directory is reviewed before it enters the static snapshot. These findings are
source-data limitations, not part of the website's runtime request flow.

The earlier spatial review disagrees with CTAN's municipality on four boundary stops. Current place
search follows CTAN's location hierarchy for those stops; the discrepancy remains in the local
probe evidence.

## Future boundaries

- Keep browser data static and query it locally. Add a backend, database, or direct CTAN calls only
  when a concrete feature requires them and the need is documented.
- Keep parsing, validation, indexing, calendar rules, and journey calculations outside React
  components as those features are added.
- Keep tests offline. Save small examples for upstream data quirks that affect the code.
- Add local persistence, a service worker, or automated data refresh only when a feature establishes
  the need and its behavior can be specified.
