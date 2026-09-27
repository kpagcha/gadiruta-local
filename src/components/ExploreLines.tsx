import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRouteLabel } from '../data/network.ts';
import { linesForStops, matchesBrowseQuery, stopLocality, stopsForLine } from '../data/network-browse.ts';
import { lineFromUrl, lineUrl } from '../data/line-url.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from '../data/network-schema.ts';
import { originSearchUrl } from '../data/search-url.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';
import { ExploreFilterInput } from './ExploreFilterInput';
import { StopTimelineTrack } from './StopTimelineTrack';

/** Show the line directory or one selected line from the local network. */
export function ExploreLines({
  dataset,
  selectedId,
  query,
  onQueryChange,
}: {
  dataset: NetworkDataset;
  selectedId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();
  const routes = useMemo(() => linesForStops(dataset, dataset.stops), [dataset]);
  const selectedRoute = selectedId === null ? undefined : lineFromUrl(dataset.routes, selectedId);

  if (selectedId !== null) {
    const route = routes.find((item) => item.id === selectedRoute?.id);
    return route === undefined ? (
      <p role="alert" className="rounded-2xl border border-line bg-surface-card p-5">
        {t('explore.notFound')}
      </p>
    ) : (
      <LineDetail key={route.id} dataset={dataset} route={route} />
    );
  }

  const visible = routes.filter((route) =>
    matchesBrowseQuery(`${getRouteLabel(route)} ${route.longName ?? ''}`, query),
  );
  return (
    <section aria-labelledby="browse-lines-title">
      <ExploreDirectoryHeading
        id="browse-lines-title"
        title={t('explore.lines')}
        placeholder={t('explore.lineFilterPlaceholder')}
        query={query}
        onQueryChange={onQueryChange}
      />
      {visible.length === 0 && <p className="text-muted">{t('explore.noMatches')}</p>}
      <ul className="grid gap-3 desktop:grid-cols-2">
        {visible.map((route) => (
          <li key={route.id}>
            <a
              className="motion-interactive flex min-h-20 flex-col justify-center rounded-2xl border border-line bg-surface-card p-5 text-ink no-underline hover:border-line-brand hover:text-accent"
              href={lineUrl(route, dataset.routes)}
            >
              <span className="font-bold">{getRouteLabel(route)}</span>
              {route.longName !== null && route.longName !== getRouteLabel(route) && (
                <span className="mt-1 text-sm leading-5 text-muted">{route.longName}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Show official line names and a timeline-style list across all its saved trip patterns. */
function LineDetail({ dataset, route }: { dataset: NetworkDataset; route: NetworkRoute }) {
  const { t } = useTranslation();
  const [stopQuery, setStopQuery] = useState('');
  const stops = stopsForLine(dataset, route.id);
  const visibleStops = stops.filter((stop) =>
    matchesBrowseQuery(`${stop.name} ${stopLocality(dataset, stop) ?? ''}`, stopQuery),
  );
  return (
    <article>
      <a className="text-sm font-semibold text-accent underline underline-offset-4" href="/explore/lines">
        {t('explore.backToLines')}
      </a>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.8px]">{getRouteLabel(route)}</h2>
      {route.longName !== null && route.longName !== getRouteLabel(route) && (
        <p className="mt-2 max-w-170 leading-6 text-muted">{route.longName}</p>
      )}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <h3 className="text-xl font-bold">{t('explore.stopsServed')}</h3>
        <ExploreFilterInput
          label={t('explore.filterStops')}
          placeholder={t('explore.stopFilterPlaceholder')}
          value={stopQuery}
          onChange={setStopQuery}
        />
      </div>
      <p className="mt-2 max-w-170 text-sm leading-6 text-muted">{t('explore.lineStopsNote')}</p>
      {visibleStops.length === 0 ? (
        <p className="mt-5 text-muted">{t('explore.noMatches')}</p>
      ) : (
        <LineStopTimeline dataset={dataset} stops={visibleStops} />
      )}
    </article>
  );
}

/** Reuse the journey timeline rail for the line's unique, alphabetically listed stops. */
function LineStopTimeline({ dataset, stops }: { dataset: NetworkDataset; stops: readonly NetworkStop[] }) {
  const { t } = useTranslation();
  return (
    <ol className="mt-5 ml-2 max-w-170">
      {stops.map((stop, index) => {
        const locality = stopLocality(dataset, stop);
        return (
          <li key={stop.id} className="grid min-h-14 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3">
            <StopTimelineTrack
              first={index === 0}
              last={index === stops.length - 1}
              highlighted
              highlightStart={index === 0}
              highlightEnd={index === stops.length - 1}
            />
            <div className="flex min-w-0 items-start justify-between gap-3 pb-5">
              <span className="min-w-0">
                <span className="block font-semibold">{stop.name}</span>
                {locality !== null && <span className="block text-sm text-muted">{locality}</span>}
              </span>
              <a
                className="shrink-0 text-sm font-semibold text-accent underline underline-offset-4"
                href={originSearchUrl({ kind: 'stop', id: stop.id, name: stop.name })}
                aria-label={t('explore.searchFromStop', { stop: stop.name })}
              >
                {t('explore.search')}
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
