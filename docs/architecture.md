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
  association has not been designed or inferred.
- The snapshot deliberately excludes service calendars, trip times, shapes, fare data, and alerts.
  Add those only with the feature that needs them.
- There is no IndexedDB schema, service worker, PWA caching policy, edge service, or backend.
- Data parsing and validation live in focused TypeScript modules. Future normalization, indexing,
  calendar handling, and journey logic should remain outside React components.
