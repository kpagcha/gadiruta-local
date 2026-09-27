import { useMemo, useState } from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
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
import { useDevSettings } from '../hooks/dev-settings-context.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';
import { ExploreFilterInput } from './ExploreFilterInput';
import { Icon } from './Icon';
import { StopTimelineTrack } from './StopTimelineTrack';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AppTooltip } from './ui/tooltip';

/** Open a physical stop at its saved coordinates, as in direct journey results. */
function googleMapsStopUrl(stop: NetworkStop): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.latitude},${stop.longitude}`)}`;
}

/** Identify the reviewed area that should share one badge and timeline color. */
function stopAreaKey(stop: NetworkStop): string | null {
  if (stop.localAreaId !== null) return `area:${stop.localAreaId}`;
  return stop.municipalityId === null ? null : `place:${stop.municipalityId}`;
}

/** Pick a repeatable palette color from an area's saved ID. */
function stopAreaTone(key: string | null): string {
  if (key === null) return '';

  let hash = 0;
  for (const character of key) hash = Math.imul(hash, 31) + character.charCodeAt(0);
  return `line-area-tone-${(hash >>> 0) % 7}`;
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
  const pathEndpoints = patterns.map((pattern) => {
    const first = pattern.stops[0]!;
    const last = pattern.stops[pattern.stops.length - 1]!;
    const firstLocality = stopLocality(dataset, first);
    const lastLocality = stopLocality(dataset, last);
    return {
      full: `${first.name} → ${last.name}`,
      short:
        firstLocality !== null && lastLocality !== null && firstLocality !== lastLocality
          ? `${firstLocality} → ${lastLocality}`
          : `${first.name} → ${last.name}`,
    };
  });
  const pathChoices = patterns.map((pattern, index) => {
    const endpoints = pathEndpoints[index]!;
    const sameEnds = patterns.filter((_, otherIndex) => pathEndpoints[otherIndex]?.short === endpoints.short);
    const sameLength = sameEnds.filter((other) => other.stops.length === pattern.stops.length);
    const suffix = sameEnds.length > 1 ? ` · ${t('explore.pathStopCount', { count: pattern.stops.length })}` : '';
    const variant =
      sameLength.length > 1 ? ` · ${t('explore.pathVariant', { number: sameLength.indexOf(pattern) + 1 })}` : '';
    return {
      value: String(index),
      label: `${endpoints.full}${suffix}${variant}`,
      shortLabel: `${endpoints.short}${suffix}${variant}`,
    };
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
                  <SelectValue className="min-w-0 truncate">{activeChoice.shortLabel}</SelectValue>
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
            <h4 className="mt-5 font-semibold">{activeChoice.shortLabel}</h4>
          )}
          <LineStopTimeline dataset={dataset} stops={activePattern.stops} query={stopQuery} />
        </>
      )}
    </article>
  );
}

type LineStopGroup = {
  key: string | null;
  locality: string | null;
  tone: string;
  startIndex: number;
  stops: NetworkStop[];
};

/** Keep consecutive stops in one area together so its side badge fits their whole run. */
function groupLineStops(dataset: NetworkDataset, stops: readonly NetworkStop[]): LineStopGroup[] {
  const groups: LineStopGroup[] = [];
  for (const [index, stop] of stops.entries()) {
    const key = stopAreaKey(stop);
    const current = groups[groups.length - 1];
    if (current !== undefined && current.key === key) {
      current.stops.push(stop);
    } else {
      groups.push({
        key,
        locality: stopLocality(dataset, stop),
        tone: stopAreaTone(key),
        startIndex: index,
        stops: [stop],
      });
    }
  }
  return groups;
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
  const { settings } = useDevSettings();
  const filtering = query.trim() !== '';
  const groups = groupLineStops(dataset, stops);
  return (
    <div className="mt-5 max-w-170">
      {groups.map((group) => {
        const areaColored = settings.lineAreaColors && group.tone !== '';
        const stopColor = areaColored ? 'text-[var(--line-area-color)]' : 'text-accent';
        return (
          <div key={group.startIndex} className={`flex ${settings.lineAreaColors ? `gap-3 ${group.tone}` : ''}`}>
            {settings.lineAreaColors && group.locality !== null && (
              <div className="relative w-7 shrink-0">
                <h4>
                  <PopoverPrimitive.Root>
                    <PopoverPrimitive.Trigger
                      openOnHover
                      delay={300}
                      type="button"
                      className="line-area-badge absolute top-0 left-0 max-h-[calc(100%-0.5rem)] rotate-180 truncate rounded-lg border px-1 py-0.5 text-xs leading-4 font-bold uppercase [writing-mode:vertical-rl] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                    >
                      {group.locality}
                    </PopoverPrimitive.Trigger>
                    <PopoverPrimitive.Portal>
                      <PopoverPrimitive.Positioner side="top" sideOffset={7} className="z-100">
                        <PopoverPrimitive.Popup className="motion-base-popup rounded-lg bg-ink px-2.5 py-1.5 text-xs font-[650] text-surface-card shadow-[var(--shadow-popover)] outline-none">
                          <PopoverPrimitive.Title>{group.locality}</PopoverPrimitive.Title>
                        </PopoverPrimitive.Popup>
                      </PopoverPrimitive.Positioner>
                    </PopoverPrimitive.Portal>
                  </PopoverPrimitive.Root>
                </h4>
              </div>
            )}
            <ol start={group.startIndex + 1} className="min-w-0 flex-1">
              {group.stops.map((stop, groupIndex) => {
                const index = group.startIndex + groupIndex;
                const matched = filtering && matchesBrowseQuery(`${stop.name} ${group.locality ?? ''}`, query);
                const actionColor =
                  filtering && !matched
                    ? areaColored
                      ? 'text-muted hover:text-[var(--line-area-color)]'
                      : 'text-muted hover:text-accent'
                    : stopColor;
                return (
                  <li key={`${stop.id}-${index}`} className="grid min-h-14 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3">
                    <StopTimelineTrack
                      first={index === 0}
                      last={index === stops.length - 1}
                      highlighted={!filtering || matched}
                      highlightStart={filtering || index === 0}
                      highlightEnd={filtering || index === stops.length - 1}
                      areaColored={areaColored}
                    />
                    <div className="flex min-w-0 items-start justify-between gap-3 pb-2">
                      <span className={`min-w-0 ${filtering && !matched ? 'opacity-40' : ''}`}>
                        <span
                          className={`block ${matched ? 'font-bold' : 'font-semibold'} ${areaColored || matched ? stopColor : ''}`}
                        >
                          {stop.name}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <AppTooltip content={t('explore.search')}>
                          <a
                            className={`motion-interactive grid size-10 place-items-center rounded-xl hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${actionColor}`}
                            href={originSearchUrl({ kind: 'stop', id: stop.id, name: stop.name })}
                            aria-label={t('explore.searchFromStop', { stop: stop.name })}
                          >
                            <Icon name="search" size={16} strokeWidth={1.8} />
                          </a>
                        </AppTooltip>
                        <span aria-hidden="true" className="mx-0.5 h-3.5 border-l border-line" />
                        <AppTooltip content={t('explore.map')}>
                          <a
                            className={`motion-interactive grid size-10 place-items-center rounded-xl hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${actionColor}`}
                            href={googleMapsStopUrl(stop)}
                            aria-label={t('journey.openStopInGoogleMaps', { stop: stop.name })}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <Icon name="stop" size={16} strokeWidth={1.8} />
                          </a>
                        </AppTooltip>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
