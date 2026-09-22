# Architecture

## Runtime

Gadiruta Local is a static web application. A web host serves ordinary files; there is no
application server, database, runtime proxy, or direct CTAN request.

```text
Browser → React application → static files
                 ↓
      /data/bahia-cadiz-network.json
```

The browser owns language and theme preferences. It fetches the versioned network asset, validates
it, and keeps it in memory for the current page. The home page currently uses it for counts and a
route preview.

## Local network data

The committed `public/data/bahia-cadiz-network.json` is the current, simple development snapshot.
It is generated from CTAN's unified GTFS archive by `just data` and is intentionally tracked for
now so a fresh checkout can run without upstream access.

```text
CTAN GTFS ZIP → local preprocessing → committed static JSON → browser-local queries
```

The processor reads only `agency.txt`, `routes.txt`, `stops.txt`, `trips.txt`, and
`stop_times.txt`. It selects `agency_id = CMTBC` only after verifying that the feed labels it
“Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz.” It fails on absent data,
inconsistent references, empty selections, malformed rows, or an agency-name change. It does not
use display names or coordinates to define the Bay boundary.

Version 1 of the app-facing asset contains:

- source URL, generation time, and archive SHA-256;
- the selected agency and routes;
- physical stops with coordinates; and
- deduplicated ordered route-stop patterns.

GTFS ZIP/CSV details remain in the processor. `scripts/gtfs-archive.ts` uses `yauzl` for archive
entries and `csv-parse` for CSV decoding; `scripts/build-network-data.ts` selects and normalizes
the app-facing topology. This is a small responsibility split, not a reusable general-purpose GTFS
importer. UI code receives only
the normalized contract and validates it again at load time. The current feed has a few stop labels
with unescaped quotation marks; the processor preserves those labels rather than rejecting an
otherwise usable snapshot.

## Refreshing the snapshot

`data/source/ctan-gtfs.zip` is ignored because it is a downloaded input. `just data` transforms an
archive already at that path. `just data-refresh` deliberately downloads CTAN's current archive,
replaces that ignored input, and regenerates the tracked JSON. Review the resulting data diff and
run checks before committing a refresh. Normal development and tests never contact CTAN.

## CTAN location crosswalk investigation

The current CTAN GTFS `stops.txt` contains only `stop_id`, `stop_name`, latitude, and longitude:
it has no municipality, núcleo, stop code, or parent-station fields. CTAN's separate Bahía API
does expose municipalities, each municipality's núcleos, and stops with those hierarchy IDs.

`just locations-probe` is an explicit developer-only investigation command. It reads the local
GTFS archive, fetches those CTAN directory resources, and writes raw responses, their SHA-256
hashes, and a coverage report to an ignored timestamped directory under `data/source/`. It never
changes the reviewed browser snapshot or makes a browser request.

The command-specific file, `scripts/probe-ctan-locations.ts`, is limited to loading local GTFS,
fetching/capturing CTAN responses, and writing audit files. Its pure response parsing, identifier
crosswalk, and report validation live in `scripts/ctan-location-crosswalk.ts`, where offline tests
can exercise them without initiating network requests.

The probe accepts only CTAN's deterministic identifier relation: a CTAN `idParada` maps to GTFS
`stop_id` `2_<idParada>`, where `2` is the Bahía consortium identifier. It validates every
municipality -> núcleo -> stop relationship and succeeds only when every selected CMTBC GTFS stop
has exactly one such CTAN record. Names and coordinates are intentionally excluded. An incomplete
report is a source-data finding, not permission to infer or hand-maintain location membership.

CTAN's `/Consorcios/2/paradas` collection omits some records that its
`/Consorcios/2/paradas/<idParada>` endpoint returns. For every collection-missing GTFS candidate,
the probe performs that exact detail lookup. It then checks the GTFS stop's known route(s) through
`/Consorcios/2/lineas/<idLinea>/paradas`. The final report's `unmatchedGtfsStopIds` therefore
contains only IDs absent from all three official sources. Every step remains identifier-only; it
does not introduce name or coordinate matching.

CTAN's line-stop response has a durable field-name quirk: its `idNucleo` value is actually the
municipality ID. Across all 67 Bahía lines in the current snapshot, all 1,493 line-stop rows that
could be compared with the stop directory matched `idMunicipio`; none matched only the directory's
`idNucleo`. For example, the M-560 endpoint returns `idNucleo: "7"` for Rota stops, while Rota's
actual núcleo ID is `15`. The probe deliberately treats that value as a municipality ID, validates
it against the municipality directory, and records exact `{ gtfsStopId, municipalityId }` pairs in
`lineFallbacks`. It still records those IDs in `unresolvedNucleusGtfsStopIds`: line data improves
stop and municipality coverage but does not verify the lower-level núcleo. `status` remains
`incomplete` until the full hierarchy is verified.

Against archive `05dbac999e552f9d8164d3581b86dfe97cb71e111fc86deaa1e8fe7b13c4f844`, the collection
returned 15 municipalities, 44 núcleos, and 190 stops, initially matching 152 of the snapshot's
263 CMTBC GTFS stops. The detail fallback added 109 unique CTAN records, yielding 261 matches from
299 hierarchy-bearing CTAN stops. The individual endpoints for `2_349` and `2_350` returned
CTAN's no-data response, but their M-560 line itinerary records resolve both stop IDs. The official
location relation nevertheless remains incomplete for those two stops: the final report has
263/263 matched stop IDs and an empty `unmatchedGtfsStopIds`, but lists both IDs as line-fallback
municipality mappings and núcleo-unresolved results. The browser dataset therefore continues to
contain no user-facing location membership.

## Future automated production refreshes

When GTFS data needs automatic refreshes, a scheduled job (for example, GitHub Actions) will
download the upstream archive, validate/process/normalize it, generate the Gadiruta static
dataset(s), and publish them to the same static host or CDN as the app. Clients will fetch those
datasets and cache them locally with version checks.

At that stage, raw GTFS archives and regularly regenerated production datasets should normally be
generated deployment artifacts, not Git-tracked files. Version control should retain the source
code, import/build tooling, schemas, and small fixtures or sample data. The scheduling and
deployment mechanics remain deliberately unspecified until automated refreshes are needed.

## Deliberate boundaries

- GTFS stops are physical boarding locations, not user-facing places. A verified place-to-stop
  association has not yet been added to the app-facing snapshot. The CTAN crosswalk probe records
  whether an official complete relation is available, without inferring one.
- The snapshot deliberately excludes service calendars, trip times, shapes, fare data, and alerts.
  Add those only with the feature that needs them.
- There is no IndexedDB schema, service worker, PWA caching policy, edge service, or backend.
- Data parsing and validation live in focused TypeScript modules. Future normalization, indexing,
  calendar handling, and journey logic should remain outside React components.
