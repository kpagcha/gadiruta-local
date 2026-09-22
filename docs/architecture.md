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

The committed `public/data/bahia-cadiz-network.json` is a reviewed source snapshot, not disposable
build output. It is generated from CTAN's unified GTFS archive by `just data` and is intentionally
tracked so a fresh checkout can run without upstream access.

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

The processor uses small Zod schemas for only the GTFS columns it consumes. They trim and validate
those values at the normalization boundary while retaining table-and-column errors; they are not a
claim to support the rest of GTFS.

## Refreshing the snapshot

`data/source/ctan-gtfs.zip` is ignored because it is a downloaded input. `just data` transforms an
archive already at that path. `just data-refresh` deliberately downloads CTAN's current archive,
replaces that ignored input, and regenerates the tracked JSON. Review the resulting data diff and
run checks before committing a refresh. Normal development and tests never contact CTAN.

## Deliberate boundaries

- GTFS stops are physical boarding locations, not user-facing places. A verified place-to-stop
  association has not been designed or inferred.
- The snapshot deliberately excludes service calendars, trip times, shapes, fare data, and alerts.
  Add those only with the feature that needs them.
- There is no IndexedDB schema, service worker, PWA caching policy, edge service, or backend.
- Data parsing and validation live in focused TypeScript modules. Future normalization, indexing,
  calendar handling, and journey logic should remain outside React components.
