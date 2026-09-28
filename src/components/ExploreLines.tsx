import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { madridToday, parseCalendarDate } from '../data/calendar-date.ts';
import { getRouteLabel } from '../data/network.ts';
import { selectedAccentColors } from '../data/dev-settings.ts';
import { lineAreaColors, lineStopAreaKey, type LineAreaColors } from '../data/line-area-colors.ts';
import {
  filterLineStopPatterns,
  linesForStops,
  lineStopPatterns,
  matchesBrowseQuery,
  stopLocality,
} from '../data/network-browse.ts';
import { lineFromUrl, lineUrl } from '../data/line-url.ts';
import { reviewedLinePathLabel } from '../data/line-path-labels.ts';
import {
  datedLineTrips,
  lineDateFromQuery,
  linePathAverageDurationMinutes,
  linePathAlias,
  lineRunAlias,
  lineRunFromAlias,
  lineStopTimesAtStop,
  lineTripDurationMinutes,
  type DatedLineTrip,
} from '../data/line-timetable.ts';
import { clockTime } from '../data/journey-time.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from '../data/network-schema.ts';
import { originSearchUrl } from '../data/search-url.ts';
import { useDevSettings } from '../hooks/dev-settings-context.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';
import { ExploreFilterInput } from './ExploreFilterInput';
import { Icon } from './Icon';
import { JourneyDatePill } from './JourneyDatePill';
import { StopTimelineTrack } from './StopTimelineTrack';
import { AppTooltip } from './ui/tooltip';

// Keep the tray's open state aligned with the custom desktop breakpoint in app.css.
const DESKTOP_MEDIA_QUERY = '(min-width: 53.125rem)';

/** Format end-to-end timetable minutes for path averages and individual trips. */
function LineDuration({ minutes, average = false }: { minutes: number; average?: boolean }) {
  const { t } = useTranslation();
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const duration =
    hours === 0
      ? t('explore.durationMinutes', { minutes })
      : rest === 0
        ? t('explore.durationHours', { hours })
        : t('explore.durationHoursMinutes', { hours, minutes: rest });
  return average ? t('explore.averageDuration', { duration }) : duration;
}

/** Place a path's departures and average duration on one compact metadata line. */
function LinePathMeta({
  runs,
  averageDurationMinutes,
  showDepartures,
}: {
  runs: readonly DatedLineTrip[];
  averageDurationMinutes: number | null;
  showDepartures: boolean;
}) {
  const { t } = useTranslation();
  const departures = showDepartures ? runs.map((run) => clockTime(run.trip.stopTimes[0]!.departureMinutes)) : [];
  if (departures.length === 0 && averageDurationMinutes === null) return null;
  return (
    <span className="flex min-w-0 items-baseline text-xs font-normal text-muted tabular-nums">
      {departures.length > 0 && (
        <span className="min-w-0 truncate">
          {departures.slice(0, 4).join('  ')}
          {departures.length > 4 && `  ${t('explore.moreTrips', { count: departures.length - 4 })}`}
        </span>
      )}
      {averageDurationMinutes !== null && (
        <span className="shrink-0 whitespace-nowrap">
          {departures.length > 0 && (
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
          )}
          <LineDuration minutes={averageDurationMinutes} average />
        </span>
      )}
    </span>
  );
}

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
  const { t, i18n } = useTranslation();
  const reducedMotion = useReducedMotion();
  const trayId = useId();
  const [trayOpen, setTrayOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_MEDIA_QUERY).matches);
  const [traySettled, setTraySettled] = useState(true);
  const [stopQuery, setStopQuery] = useState('');
  const [urlSearch, setUrlSearch] = useState(() => window.location.search);
  const patterns = useMemo(() => lineStopPatterns(dataset, route.id), [dataset, route.id]);
  useEffect(() => {
    /** Restore the line's path and date from a shared link or browser history. */
    function restoreLineUrl() {
      setUrlSearch(window.location.search);
    }
    window.addEventListener('popstate', restoreLineUrl);
    return () => window.removeEventListener('popstate', restoreLineUrl);
  }, []);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    /** Show the full controls when the layout changes to desktop width. */
    function syncLayout() {
      setIsDesktop(media.matches);
      setTraySettled(true);
    }
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);
  const parameters = new URLSearchParams(urlSearch);
  const rawDate = parameters.get('date');
  const rawPath = parameters.get('path');
  const rawView = parameters.get('view');
  const rawMode = parameters.get('mode');
  const rawRun = parameters.get('run');
  const timetableView = rawMode === 'trips' ? 'trips' : 'stops';
  const today = madridToday();
  const date =
    rawDate !== null
      ? lineDateFromQuery(rawDate, dataset.coverage)
      : rawView === 'stops'
        ? null
        : lineDateFromQuery(today, dataset.coverage);
  const scheduledRuns: DatedLineTrip[][] =
    date === null
      ? patterns.map(() => [])
      : patterns.map((pattern) => datedLineTrips(dataset, route.id, pattern, date));
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
    const value = linePathAlias(dataset, pattern, patterns);
    const reviewedLabel = reviewedLinePathLabel(route, value, i18n.resolvedLanguage ?? i18n.language);
    const durationTrips = date === null ? dataset.trips : scheduledRuns[index]!.map((run) => run.trip);
    return {
      value,
      label: reviewedLabel ?? `${endpoints.full}${suffix}${variant}`,
      shortLabel: reviewedLabel ?? `${endpoints.short}${suffix}${variant}`,
      direction: endpoints.short,
      runs: scheduledRuns[index]!,
      averageDurationMinutes: linePathAverageDurationMinutes(durationTrips, route.id, pattern),
    };
  });
  const visibleChoices = pathChoices.filter((_, index) => matchingPatterns.includes(patterns[index]!));
  // A shared path can still explain an empty date; the picker offers only paths with departures.
  const listedChoices = date === null ? visibleChoices : visibleChoices.filter((choice) => choice.runs.length > 0);
  const listedDirections = [...new Set(listedChoices.map((choice) => choice.direction))];
  // A plain line link opens a path that actually runs today when one is available.
  const firstScheduledChoice = date === null ? undefined : visibleChoices.find((choice) => choice.runs.length > 0);
  // Keep a shared path when possible; a stop filter may temporarily choose another one.
  const activeChoice =
    visibleChoices.find((choice) => choice.value === rawPath) ??
    firstScheduledChoice ??
    visibleChoices[0] ??
    pathChoices.find((choice) => choice.value === rawPath) ??
    pathChoices[0];
  const noMatchingStops = stopQuery.trim() !== '' && visibleChoices.length === 0;
  const singleListedChoiceIsActive = listedChoices.length === 1 && listedChoices[0]?.value === activeChoice?.value;
  const activePattern = activeChoice === undefined ? undefined : patterns[pathChoices.indexOf(activeChoice)];
  const trips = activeChoice?.runs ?? [];
  const selectedRun = rawRun === null ? undefined : lineRunFromAlias(trips, rawRun);
  const trayExpanded = isDesktop || trayOpen;
  const dateSummary =
    date === null
      ? null
      : date === today
        ? t('search.today')
        : new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'en', {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          }).format(parseCalendarDate(date));
  const filterSummary = stopQuery.trim() === '' ? null : t('explore.filterSummary', { query: stopQuery.trim() });

  /** Keep the selected path, date, timetable view, and optional run in a shareable line URL. */
  function updateLineUrl(
    path: string,
    nextDate: string | null,
    runAlias: string | null = null,
    nextMode: 'trips' | 'stops' = timetableView,
  ) {
    const next = new URLSearchParams({ path });
    if (nextDate !== null) next.set('date', nextDate);
    else next.set('view', 'stops');
    if (nextDate !== null && runAlias !== null) next.set('run', runAlias);
    if (nextDate !== null && nextMode === 'trips') next.set('mode', 'trips');
    const search = `?${next.toString()}`;
    if (search === window.location.search) return;
    window.history.pushState(null, '', `${window.location.pathname}${search}`);
    setUrlSearch(search);
  }

  /** Select one scheduled run, or clear it when its time is selected again. */
  function toggleRun(run: DatedLineTrip) {
    if (activeChoice === undefined || date === null) return;
    const alias = lineRunAlias(run, trips);
    updateLineUrl(activeChoice.value, date, rawRun === alias ? null : alias);
  }

  return (
    <article>
      <a className="text-sm font-semibold text-accent underline underline-offset-4" href="/explore/lines">
        {t('explore.backToLines')}
      </a>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.8px]">{getRouteLabel(route)}</h2>
      {route.longName !== null && route.longName !== getRouteLabel(route) && (
        <p className="mt-2 max-w-170 leading-6 text-muted">{route.longName}</p>
      )}
      {(rawDate !== null && date === null) ||
      (rawPath !== null && !pathChoices.some((choice) => choice.value === rawPath)) ||
      (rawView !== null && (rawView !== 'stops' || rawDate !== null)) ||
      (rawMode !== null && rawMode !== 'trips' && rawMode !== 'stops') ? (
        <p className="mt-4 text-sm text-warning" role="alert">
          {t('explore.invalidLineLink')}
        </p>
      ) : null}
      {rawRun !== null && selectedRun === undefined && stopQuery.trim() === '' && (
        <p className="mt-4 text-sm text-warning" role="alert">
          {t('explore.invalidRunLink')}
        </p>
      )}
      {rawDate === null && rawView === null && date === null && (
        <p className="mt-4 text-sm text-warning" role="status">
          {t('explore.todayUnavailable')}
        </p>
      )}
      <h3 className="sr-only">{date === null ? t('explore.stops') : t('explore.timetable')}</h3>
      {activeChoice === undefined || activePattern === undefined ? (
        <p className="mt-6 text-muted">{t('explore.noMatches')}</p>
      ) : (
        <div className="mt-6 grid gap-5 desktop:grid-cols-[minmax(0,1fr)_20rem] desktop:gap-8">
          <aside
            className="min-w-0 rounded-2xl border border-line bg-[color-mix(in_srgb,var(--color-ink)_6%,var(--color-paper))] desktop:col-start-2 desktop:row-start-1 desktop:rounded-none desktop:border-0 desktop:bg-transparent"
            aria-label={t('explore.timetableControls')}
          >
            <button
              aria-controls={trayId}
              aria-expanded={trayOpen}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent desktop:hidden"
              onClick={() => {
                setTraySettled(false);
                setTrayOpen((open) => !open);
              }}
              type="button"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{activeChoice.shortLabel}</span>
                {(dateSummary !== null || filterSummary !== null) && (
                  <span className="block truncate text-xs text-muted">
                    {dateSummary}
                    {dateSummary !== null && filterSummary !== null && ' · '}
                    {filterSummary}
                  </span>
                )}
              </span>
              <Icon
                name="chevronDown"
                size={18}
                className={`shrink-0 text-accent transition-transform duration-200 motion-reduce:transition-none ${trayOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <motion.div
              id={trayId}
              initial={false}
              animate={{ height: trayExpanded ? 'auto' : 0, opacity: trayExpanded ? 1 : 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeOut' }}
              onAnimationComplete={() => setTraySettled(true)}
              style={{ overflow: trayExpanded && (traySettled || reducedMotion) ? 'visible' : 'hidden' }}
              aria-hidden={!trayExpanded}
              inert={!trayExpanded}
            >
              <div className="border-t border-line/70 px-3 pt-3 pb-3 desktop:border-0 desktop:p-0">
                {listedChoices.length === 0 ? null : singleListedChoiceIsActive ? (
                  <div className="text-sm font-semibold text-ink">
                    {activeChoice.shortLabel}
                    <LinePathMeta
                      runs={activeChoice.runs}
                      averageDurationMinutes={activeChoice.averageDurationMinutes}
                      showDepartures={date !== null}
                    />
                  </div>
                ) : patterns.length === 2 || listedChoices.length === 1 ? (
                  <div
                    aria-label={t('explore.path')}
                    className="grid gap-1.5 sm:grid-cols-2 desktop:grid-cols-1"
                    role="group"
                  >
                    {listedChoices.map((choice) => (
                      <button
                        key={choice.value}
                        aria-pressed={choice.value === activeChoice.value}
                        className={`motion-interactive flex min-h-11 min-w-0 flex-col justify-center rounded-xl border px-2.5 py-1 text-left text-sm leading-5 font-semibold focus-visible:outline-2 focus-visible:outline-accent ${choice.value === activeChoice.value ? 'border-accent bg-surface-active text-accent' : 'border-line-input bg-surface-input text-ink hover:bg-surface-hover'}`}
                        onClick={() => updateLineUrl(choice.value, date)}
                        type="button"
                      >
                        <span>{choice.shortLabel}</span>
                        <LinePathMeta
                          runs={choice.runs}
                          averageDurationMinutes={choice.averageDurationMinutes}
                          showDepartures={date !== null}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    aria-label={t('explore.path')}
                    className={`grid gap-3 ${listedDirections.length > 1 ? 'sm:grid-cols-2 desktop:grid-cols-1' : ''}`}
                    role="group"
                  >
                    {listedDirections.map((direction) => (
                      <div key={direction} aria-label={direction} className="grid content-start gap-1.5" role="group">
                        {listedChoices
                          .filter((choice) => choice.direction === direction)
                          .map((choice) => {
                            return (
                              <button
                                key={choice.value}
                                aria-pressed={choice.value === activeChoice.value}
                                className={`motion-interactive flex min-h-11 min-w-0 flex-col justify-center gap-0.5 rounded-xl border px-2.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-accent ${choice.value === activeChoice.value ? 'border-accent bg-surface-active text-accent' : 'border-line-input bg-surface-input text-ink hover:bg-surface-hover'}`}
                                onClick={() => updateLineUrl(choice.value, date)}
                                type="button"
                              >
                                <span className="text-sm font-semibold">{choice.shortLabel}</span>
                                <LinePathMeta
                                  runs={choice.runs}
                                  averageDurationMinutes={choice.averageDurationMinutes}
                                  showDepartures={date !== null}
                                />
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                )}
                <div className={listedChoices.length > 0 ? 'mt-4' : ''}>
                  <ExploreFilterInput
                    label={t('explore.filterStops')}
                    placeholder={t('explore.stopFilterPlaceholder')}
                    value={stopQuery}
                    onChange={setStopQuery}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-2 desktop:items-start">
                    <JourneyDatePill
                      value={date}
                      onChange={(value) => updateLineUrl(activeChoice.value, value)}
                      minimum={dataset.coverage.startDate}
                      maximum={dataset.coverage.endDate}
                      disabled={false}
                      allowPast
                      emptyLabel={t('explore.chooseDate')}
                      clear={
                        date === null
                          ? undefined
                          : {
                              label: t('explore.clearDate'),
                              onClick: () => updateLineUrl(activeChoice.value, null),
                            }
                      }
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </aside>
          <div className="min-w-0 desktop:col-start-1 desktop:row-start-1">
            {noMatchingStops ? (
              <p className="text-muted" role="status">
                {t('explore.noMatches')}
              </p>
            ) : date === null ? (
              <LineStopTimeline dataset={dataset} stops={activePattern.stops} query={stopQuery} />
            ) : (
              <>
                <div
                  className="flex w-full overflow-hidden rounded-xl border border-line-input bg-surface-input sm:inline-flex sm:w-auto"
                  role="group"
                  aria-label={t('explore.timetableView')}
                >
                  {(['stops', 'trips'] as const).map((view) => (
                    <button
                      key={view}
                      aria-pressed={timetableView === view}
                      className={`motion-interactive inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1 px-2 py-1 text-sm leading-5 font-semibold first:border-r first:border-line-input focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent sm:flex-none sm:gap-1.5 sm:px-2.5 ${timetableView === view ? 'bg-surface-active text-accent' : 'text-ink hover:bg-surface-hover'}`}
                      onClick={() =>
                        updateLineUrl(activeChoice.value, date, selectedRun === undefined ? null : rawRun, view)
                      }
                      type="button"
                    >
                      <Icon name={view === 'stops' ? 'listClock' : 'timeline'} size={14} className="shrink-0" />
                      <span>{t(view === 'trips' ? 'explore.tripList' : 'explore.timesByStop')}</span>
                    </button>
                  ))}
                </div>
                {trips.length > 0 && timetableView === 'stops' && (
                  <p className="mt-2 text-sm text-muted">
                    {t('explore.selectRunHint')}{' '}
                    {selectedRun !== undefined && (
                      <button
                        className="font-semibold text-accent underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-accent"
                        onClick={() => updateLineUrl(activeChoice.value, date)}
                        type="button"
                      >
                        {t('explore.clearRunSelection')}
                      </button>
                    )}
                  </p>
                )}
                {trips.length === 0 ? (
                  <p className="mt-5 text-muted" role="status">
                    {t('explore.noLineTrips')}{' '}
                    <button
                      className="motion-interactive font-semibold text-accent underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-accent"
                      onClick={() => updateLineUrl(activeChoice.value, null)}
                      type="button"
                    >
                      {t('explore.clearDate')}
                    </button>
                  </p>
                ) : timetableView === 'trips' ? (
                  <LineTripList
                    dataset={dataset}
                    stops={activePattern.stops}
                    trips={trips}
                    query={stopQuery}
                    selectedRun={selectedRun}
                    onSelectRun={toggleRun}
                  />
                ) : (
                  <LineStopTimeline
                    dataset={dataset}
                    stops={activePattern.stops}
                    query={stopQuery}
                    trips={trips}
                    selectedRun={selectedRun}
                    onSelectRun={toggleRun}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

type LineStopGroup = {
  key: string | null;
  locality: string | null;
  tone: LineAreaColors | null;
  startIndex: number;
  stops: NetworkStop[];
};

/** Show the scheduled buses in travel order and expand one run for its stop times. */
function LineTripList({
  dataset,
  stops,
  trips,
  query,
  selectedRun,
  onSelectRun,
}: {
  dataset: NetworkDataset;
  stops: readonly NetworkStop[];
  trips: readonly DatedLineTrip[];
  query: string;
  selectedRun: DatedLineTrip | undefined;
  onSelectRun: (run: DatedLineTrip) => void;
}) {
  const { t } = useTranslation();
  const selectedRowRef = useRef<HTMLLIElement>(null);
  const selectedKey = selectedRun === undefined ? null : `${selectedRun.trip.id}:${selectedRun.serviceDate}`;
  useEffect(() => {
    if (selectedKey === null) return;
    // Wait for the expanded timeline to render before placing its trip at the viewport top.
    const frame = requestAnimationFrame(() => {
      selectedRowRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedKey]);
  return (
    <ol className="mt-5 max-w-170 space-y-1">
      {trips.map((run) => {
        const key = `${run.trip.id}:${run.serviceDate}`;
        const first = run.trip.stopTimes[0]!;
        const last = run.trip.stopTimes[run.trip.stopTimes.length - 1]!;
        const firstMinute = first.departureMinutes;
        const lastMinute = last.arrivalMinutes;
        const expanded = selectedRun?.trip.id === run.trip.id && selectedRun.serviceDate === run.serviceDate;
        return (
          <li key={key} ref={expanded ? selectedRowRef : undefined} className="scroll-mt-4 border-b border-line pb-1">
            <button
              aria-expanded={expanded}
              className={`motion-interactive flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left font-semibold hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${expanded ? 'text-accent' : ''}`}
              onClick={() => onSelectRun(run)}
              type="button"
            >
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="tabular-nums">
                  {clockTime(firstMinute)}
                  {' → '}
                  {clockTime(lastMinute)}
                </span>
                <span className="text-xs font-normal text-muted">
                  <LineDuration minutes={lineTripDurationMinutes(run.trip)} />
                </span>
              </span>
              <span className="text-sm text-muted">
                {expanded ? t('explore.hideStopTimes') : t('explore.showStopTimes')}
              </span>
            </button>
            {expanded && (
              <div className="pb-3 pl-2">
                <LineStopTimeline dataset={dataset} stops={stops} query={query} run={run} showActions={false} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Keep consecutive stops in one area together so its side badge fits their whole run. */
function groupLineStops(
  dataset: NetworkDataset,
  stops: readonly NetworkStop[],
  colors: ReadonlyMap<string, LineAreaColors>,
): LineStopGroup[] {
  const groups: LineStopGroup[] = [];
  for (const [index, stop] of stops.entries()) {
    const key = lineStopAreaKey(stop);
    const current = groups[groups.length - 1];
    if (current !== undefined && current.key === key) {
      current.stops.push(stop);
    } else {
      groups.push({
        key,
        locality: stopLocality(dataset, stop),
        tone: key === null ? null : (colors.get(key) ?? null),
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
  trips,
  run,
  selectedRun,
  onSelectRun,
  showActions = true,
}: {
  dataset: NetworkDataset;
  stops: readonly NetworkStop[];
  query: string;
  trips?: readonly DatedLineTrip[];
  run?: DatedLineTrip;
  selectedRun?: DatedLineTrip;
  onSelectRun?: (run: DatedLineTrip) => void;
  showActions?: boolean;
}) {
  const { t } = useTranslation();
  const { settings } = useDevSettings();
  const filtering = query.trim() !== '';
  const { light, dark } = selectedAccentColors(settings);
  const colors = useMemo(
    () => (settings.lineAreaColors ? lineAreaColors(dataset, { light, dark }) : new Map<string, LineAreaColors>()),
    [dataset, settings.lineAreaColors, light, dark],
  );
  const groups = groupLineStops(dataset, stops, colors);
  return (
    <div className="mt-5 max-w-170">
      {groups.map((group) => {
        const areaColored = settings.lineAreaColors && group.tone !== null;
        const stopColor = areaColored ? 'text-[var(--line-area-color)]' : 'text-accent';
        const toneStyle =
          areaColored && group.tone !== null
            ? ({
                '--line-area-color-light': group.tone.light,
                '--line-area-color-dark': group.tone.dark,
              } as CSSProperties)
            : undefined;
        return (
          <div
            key={group.startIndex}
            className={`flex ${settings.lineAreaColors ? 'line-area-colored gap-3' : ''}`}
            style={toneStyle}
          >
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
                const times = trips === undefined ? undefined : lineStopTimesAtStop(trips, index);
                const runMinute = run === undefined ? null : run.trip.stopTimes[index]!.arrivalMinutes;
                const actionColor =
                  filtering && !matched
                    ? areaColored
                      ? 'text-muted hover:text-[var(--line-area-color)]'
                      : 'text-muted hover:text-accent'
                    : stopColor;
                return (
                  <li key={`${stop.id}-${index}`} className="grid min-h-14 grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3">
                    {/* Search fades stop content while the physical line remains continuous. */}
                    <StopTimelineTrack
                      first={index === 0}
                      last={index === stops.length - 1}
                      highlighted
                      highlightStart={index === 0}
                      highlightEnd={index === stops.length - 1}
                      areaColored={areaColored}
                    />
                    <div className="flex min-w-0 items-start justify-between gap-3 pb-2">
                      <span className="min-w-0">
                        <span
                          className={`block ${matched ? 'font-bold' : 'font-semibold'} ${areaColored || matched ? stopColor : ''} ${filtering && !matched ? 'opacity-40' : ''}`}
                        >
                          {stop.name}
                        </span>
                        {times !== undefined && (
                          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted tabular-nums">
                            {times.length === 0
                              ? '—'
                              : times.map(({ minute, item }) => {
                                  const selected =
                                    selectedRun?.trip.id === item.trip.id &&
                                    selectedRun.serviceDate === item.serviceDate;
                                  return (
                                    <button
                                      key={`${item.trip.id}:${item.serviceDate}`}
                                      aria-label={t('explore.highlightRunAtStop', {
                                        time: clockTime(minute),
                                        stop: stop.name,
                                      })}
                                      aria-pressed={selected}
                                      className={`motion-interactive -mx-1 inline-flex min-h-7 items-center rounded-md px-1 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${selected ? 'font-bold text-accent underline underline-offset-4' : selectedRun !== undefined || (filtering && !matched) ? 'opacity-40' : ''}`}
                                      onClick={() => onSelectRun?.(item)}
                                      type="button"
                                    >
                                      <time dateTime={clockTime(minute)}>{clockTime(minute)}</time>
                                    </button>
                                  );
                                })}
                          </span>
                        )}
                        {runMinute !== null && (
                          <span
                            className={`mt-1 block text-sm text-muted tabular-nums ${filtering && !matched ? 'opacity-40' : ''}`}
                          >
                            <time dateTime={clockTime(runMinute)}>{clockTime(runMinute)}</time>
                            {runMinute >= 1440 && ` · ${t('explore.nextDay')}`}
                          </span>
                        )}
                      </span>
                      {showActions && (
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
                      )}
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
