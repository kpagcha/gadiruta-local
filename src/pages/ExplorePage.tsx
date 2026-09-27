import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExploreLines } from '../components/ExploreLines';
import { ExplorePlaces } from '../components/ExplorePlaces';
import { createLocationOptions } from '../data/location-search.ts';
import { places } from '../data/places.ts';
import { useNetworkDataset } from '../hooks/use-network-dataset.ts';

export type ExploreView =
  | { kind: 'places' }
  | { kind: 'lines' }
  | { kind: 'place'; id: string }
  | { kind: 'line'; id: string }
  | { kind: 'missing' };

/** Keep the Explore heading, navigation, and data load shared between place and line views. */
export function ExplorePage({ view }: { view: ExploreView }) {
  const { t } = useTranslation();
  const networkState = useNetworkDataset();
  const [queries, setQueries] = useState({ places: '', lines: '' });
  const options = useMemo(
    () => (networkState.status === 'ready' ? createLocationOptions(places, networkState.dataset) : []),
    [networkState],
  );
  const category = view.kind === 'line' || view.kind === 'lines' ? 'lines' : 'places';

  return (
    <main id="main-content" className="flex-1 pt-5 pb-12 focus:outline-none desktop:pt-8" tabIndex={-1}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b border-line">
        <h1 className="pb-3 text-2xl font-[700] tracking-[-0.7px] desktop:text-[32px]">{t('explore.title')}</h1>
        <nav className="flex gap-2" aria-label={t('explore.navigation')}>
          <a
            href="/explore/places"
            aria-current={category === 'places' ? 'page' : undefined}
            className={`motion-interactive flex min-h-11 items-center border-b-2 px-3 text-sm font-bold no-underline ${category === 'places' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t('explore.places')}
          </a>
          <a
            href="/explore/lines"
            aria-current={category === 'lines' ? 'page' : undefined}
            className={`motion-interactive flex min-h-11 items-center border-b-2 px-3 text-sm font-bold no-underline ${category === 'lines' ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t('explore.lines')}
          </a>
        </nav>
      </header>
      {networkState.status === 'loading' && <p role="status">{t('explore.loading')}</p>}
      {networkState.status === 'error' && <p role="alert">{t('explore.error')}</p>}
      {networkState.status === 'ready' &&
        (view.kind === 'places' || view.kind === 'place' ? (
          <ExplorePlaces
            dataset={networkState.dataset}
            options={options}
            selectedId={view.kind === 'place' ? view.id : null}
            query={queries.places}
            onQueryChange={(value) => setQueries((current) => ({ ...current, places: value }))}
          />
        ) : view.kind === 'lines' || view.kind === 'line' ? (
          <ExploreLines
            dataset={networkState.dataset}
            selectedId={view.kind === 'line' ? view.id : null}
            query={queries.lines}
            onQueryChange={(value) => setQueries((current) => ({ ...current, lines: value }))}
          />
        ) : (
          <p role="alert" className="rounded-2xl border border-line bg-surface-card p-5">
            {t('explore.notFound')}
          </p>
        ))}
    </main>
  );
}
