import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getRouteLabel } from '../data/network.ts';
import {
  filterLineStopPatterns,
  linesForStops,
  lineStopPatterns,
  matchesBrowseQuery,
  stopLocality,
} from '../data/network-browse.ts';
import { lineFromUrl, lineUrl } from '../data/line-url.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from '../data/network-schema.ts';
import { originSearchUrl } from '../data/search-url.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';
import { ExploreFilterInput } from './ExploreFilterInput';
import { StopTimelineTrack } from './StopTimelineTrack';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

/** Open a physical stop at its saved coordinates, as in direct journey results. */
function googleMapsStopUrl(stop: NetworkStop): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.latitude},${stop.longitude}`)}`;
}

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

/** Show one ordered saved trip path at a time for the selected line. */
function LineDetail({ dataset, route }: { dataset: NetworkDataset; route: NetworkRoute }) {
  const { t } = useTranslation();
  const [stopQuery, setStopQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState('0');
  const patterns = useMemo(() => lineStopPatterns(dataset, route.id), [dataset, route.id]);
  const matchingPatterns = filterLineStopPatterns(dataset, patterns, stopQuery);
  const pathChoices = patterns.map((pattern, index) => {
    const first = pattern.stops[0]!;
    const last = pattern.stops[pattern.stops.length - 1]!;
    const sameEnds = patterns.filter(
      (other) => other.stops[0]?.name === first.name && other.stops[other.stops.length - 1]?.name === last.name,
    );
    const sameLength = sameEnds.filter((other) => other.stops.length === pattern.stops.length);
    const suffix = sameEnds.length > 1 ? ` · ${t('explore.pathStopCount', { count: pattern.stops.length })}` : '';
    const variant =
      sameLength.length > 1 ? ` · ${t('explore.pathVariant', { number: sameLength.indexOf(pattern) + 1 })}` : '';
    return { value: String(index), label: `${first.name} → ${last.name}${suffix}${variant}` };
  });
  const visibleChoices = pathChoices.filter((_, index) => matchingPatterns.includes(patterns[index]!));
  // Keep a manually selected path when possible; a filter may temporarily choose another one.
  const activeChoice = visibleChoices.find((choice) => choice.value === selectedPath) ?? visibleChoices[0];
  const activePattern = activeChoice === undefined ? undefined : patterns[Number(activeChoice.value)];
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
        <h3 className="text-xl font-bold">{t('explore.stops')}</h3>
        <ExploreFilterInput
          label={t('explore.filterStops')}
          placeholder={t('explore.stopFilterPlaceholder')}
          value={stopQuery}
          onChange={setStopQuery}
        />
      </div>
      {activeChoice === undefined || activePattern === undefined ? (
        <p className="mt-5 text-muted">{t('explore.noMatches')}</p>
      ) : (
        <>
          {patterns.length > 1 ? (
            <div className="mt-5 flex max-w-170 flex-col gap-2">
              <label className="text-sm font-semibold" htmlFor="line-path">
                {t('explore.path')}
              </label>
              <Select
                items={visibleChoices}
                value={activeChoice.value}
                onValueChange={(value) => {
                  if (value !== null) setSelectedPath(value);
                }}
              >
                <SelectTrigger
                  className="min-h-11 rounded-xl border border-line-input bg-surface-input px-3 py-2 text-left text-sm focus:shadow-[var(--shadow-field-focus)]"
                  id="line-path"
                >
                  <SelectValue className="min-w-0 truncate" />
                </SelectTrigger>
                <SelectContent>
                  {visibleChoices.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <h4 className="mt-5 font-semibold">{activeChoice.label}</h4>
          )}
          <LineStopTimeline dataset={dataset} stops={activePattern.stops} query={stopQuery} />
        </>
      )}
    </article>
  );
}

/** Reuse the journey timeline rail while preserving every stop in the selected trip order. */
function LineStopTimeline({
  dataset,
  stops,
  query,
}: {
  dataset: NetworkDataset;
  stops: readonly NetworkStop[];
  query: string;
}) {
  const { t } = useTranslation();
  return (
    <ol className="mt-5 ml-2 max-w-170">
      {stops.map((stop, index) => {
        const locality = stopLocality(dataset, stop);
        const filtering = query.trim() !== '';
        const matched = filtering && matchesBrowseQuery(`${stop.name} ${locality ?? ''}`, query);
        const actionColor = filtering && !matched ? 'text-muted hover:text-accent' : 'text-accent';
        return (
          <li key={`${stop.id}-${index}`} className="grid min-h-14 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3">
            <StopTimelineTrack
              first={index === 0}
              last={index === stops.length - 1}
              highlighted={!filtering || matched}
              highlightStart={filtering || index === 0}
              highlightEnd={filtering || index === stops.length - 1}
            />
            <div className={`flex min-w-0 items-start justify-between gap-3 pb-5 ${matched ? 'text-accent' : ''}`}>
              <span className={`min-w-0 ${filtering && !matched ? 'opacity-70' : ''}`}>
                <span className="block font-semibold">{stop.name}</span>
                {locality !== null && (
                  <span className={`block text-sm ${matched ? 'text-accent' : filtering ? 'text-ink' : 'text-muted'}`}>
                    {locality}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                <a
                  className={`${actionColor} underline underline-offset-4`}
                  href={originSearchUrl({ kind: 'stop', id: stop.id, name: stop.name })}
                  aria-label={t('explore.searchFromStop', { stop: stop.name })}
                >
                  {t('explore.search')}
                </a>
                <span aria-hidden="true" className="text-muted">
                  |
                </span>
                <a
                  className={`${actionColor} underline underline-offset-4`}
                  href={googleMapsStopUrl(stop)}
                  aria-label={t('journey.openStopInGoogleMaps', { stop: stop.name })}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t('explore.map')}
                </a>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
