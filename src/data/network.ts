import { parseNetworkDataset, type NetworkDataset, type NetworkRoute } from './network-schema.ts';

export type { NetworkDataset, NetworkRoute } from './network-schema.ts';

const datasetUrl = '/data/bahia-cadiz-network.json';

/** Load the versioned static network asset without contacting an upstream transit service. */
export async function loadNetworkDataset(signal?: AbortSignal): Promise<NetworkDataset> {
  const response = await fetch(datasetUrl, { signal });

  if (!response.ok) {
    throw new Error(`The local network data could not be loaded (${response.status}).`);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('The local network data is not valid JSON.');
  }

  return parseNetworkDataset(value);
}

/** Return a stable, human-readable route label without translating official route names. */
export function getRouteLabel(route: NetworkRoute): string {
  return route.shortName ?? route.longName ?? route.id;
}

/** Select a small deterministic sample for the landing-page network preview. */
export function getRoutePreview(routes: readonly NetworkRoute[], limit = 6): NetworkRoute[] {
  return [...routes]
    .sort((first, second) =>
      getRouteLabel(first).localeCompare(getRouteLabel(second), 'es', {
        numeric: true,
        sensitivity: 'base',
      }),
    )
    .slice(0, limit);
}
