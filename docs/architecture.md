# Architecture

## What runs today

Gadiruta Local is a static web application. It is built from the files in this repository and can
be hosted as ordinary website files. There is no application server, database, runtime proxy, or
direct CTAN REST request.

```text
Browser → React application → bundled website files
```

The browser currently owns the interface language and theme preference. It will also own transit
searches once a local dataset is introduced.

## Data direction

The next milestone is a small, preprocessed slice of CTAN GTFS data published as static files. The
app will download that data and query it on the device.

```text
CTAN GTFS → preprocessing outside the app → static dataset → browser-local queries
```

CTAN's unified feed has historically been available at:

```text
https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip
```

Before depending on it, verify its current coverage, identifiers, and attribution requirements.
GTFS stops are physical boarding locations, while Gadiruta's place-first interface needs broader
areas such as Cádiz or Jerez. A reliable place-to-stop association is still a discovery task; do
not derive it from names alone.

## Deliberate boundaries

- The application lives at the repository root because it is the only runtime application.
- No importer, IndexedDB schema, service worker, or edge service exists yet. Their shape should
  follow the first data-backed feature instead of preceding it.
- UI components should receive app-facing data rather than raw GTFS rows. Keep parsing,
  normalization, calendar handling, indexes, and journey calculations in ordinary TypeScript
  modules close to the feature that needs them.
