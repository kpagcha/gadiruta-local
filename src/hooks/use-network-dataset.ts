/**
 * Loads the network timetable JSON for a page and tells the page whether it is loading, ready, or
 * unable to load the file.
 *
 * The page uses this hook to show the right state while the browser fetches and checks the local
 * file from `public/data/`.
 */
import { useEffect, useState } from 'react';
import { loadNetworkDataset, type NetworkDataset } from '../data/network.ts';

/** The three visible states while one mounted interface loads the local network asset. */
export type NetworkDatasetState =
  { status: 'loading' } | { status: 'ready'; dataset: NetworkDataset } | { status: 'error' };

/** Load the static asset once for a mounted interface and expose its visible state. */
export function useNetworkDataset(): NetworkDatasetState {
  const [state, setState] = useState<NetworkDatasetState>({ status: 'loading' });

  useEffect(() => {
    // Tie the request to this mounted component so navigating away cannot update stale state.
    const controller = new AbortController();

    void loadNetworkDataset(controller.signal).then(
      (dataset) => setState({ status: 'ready', dataset }),
      (error: unknown) => {
        // An abort is expected during unmount; every other failure becomes a user-visible state.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error' });
        }
      },
    );

    // React calls this cleanup when the component unmounts.
    return () => controller.abort();
  }, []);

  return state;
}
