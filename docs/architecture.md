# Architecture

## Runtime boundary

Gadiruta Local is a static website. The browser downloads the app and its network JSON from a static
host, then searches the loaded data on-device. There is no Gadiruta application server, database,
runtime proxy, or browser request to CTAN.

The step-by-step app flow and the commands that prepare the JSON are in the [development guide](development.md).

## Network data shape

The browser-facing file, `public/data/bahia-cadiz-network.json`, contains the parts of GTFS needed by
the current place and stop search:

- the selected transport agency and its routes;
- physical stops and their coordinates; and
- ordered stop lists showing which stops each route serves.

The file also records its format version and the hash of the GTFS ZIP used to produce it. The
processor and browser both check that the data has the expected fields and that routes and stops
refer to entries that exist. ZIP and CSV details stay in developer scripts, so browser code only
needs to handle this smaller format.

The processor selects agency `CMTBC` only when its name matches the expected Bahía de Cádiz
Consortium. The agency ID defines which network is in scope; stop names and coordinates do not. The
current file does not include service calendars, departure times, shapes, fares, or alerts; add them
when a feature needs them.

The JSON is checked into Git so a fresh checkout can run without downloading CTAN data. The original
downloaded ZIP stays ignored under `data/source/`. For where these files live and how to refresh
them, see the [development guide](development.md).

## Places and physical stops

A place is a name people recognize, such as Cádiz or Rota. A stop is one exact bus boarding point.
The app keeps them as separate search choices because the current source data does not reliably
say which stops belong to each place. Choosing a place therefore does not yet expand into a set of
stops for journey search.

The names in `src/data/places.ts` are maintained by the project. GTFS stop records do not contain
the municipality or smaller-area IDs needed to connect every stop to those names. The separate CTAN
location probe investigates that relationship, but its results are not part of the browser data.

## CTAN location findings

CTAN's all-stops list omits some stops that are available from individual stop lookups. Its line-stop
response also uses a field named `idNucleo` to return a municipality ID. That value can identify a
municipality, but it does not establish the smaller area (nucleus) a stop belongs to. The current
probe report keeps those cases unresolved. Names and coordinates are not used to guess missing
relationships.

These findings explain why the app currently offers independent place and stop choices. They are
source-data limitations, not part of the website's runtime request flow.

## Future boundaries

- Keep browser data static and query it locally. Add a backend, database, or direct CTAN calls only
  when a concrete feature requires them and the need is documented.
- Keep parsing, validation, indexing, calendar rules, and journey calculations outside React
  components as those features are added.
- Keep tests offline. Save small examples for upstream data quirks that affect the code.
- Add local persistence, a service worker, or automated data refresh only when a feature establishes
  the need and its behavior can be specified.
