import { useEffect, useState } from 'react';
import { loadNetworkDataset, type NetworkDataset } from './network.ts';

export type NetworkDatasetState =
  { status: 'loading' } | { status: 'ready'; dataset: NetworkDataset } | { status: 'error' };

/** Load the static asset once for a mounted interface and expose its visible state. */
export function useNetworkDataset(): NetworkDatasetState {
  const [state, setState] = useState<NetworkDatasetState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void loadNetworkDataset(controller.signal).then(
      (dataset) => setState({ status: 'ready', dataset }),
      (error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error' });
        }
      },
    );

    return () => controller.abort();
  }, []);

  return state;
}
