import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  alightableTripStopIndices,
  boardableTripStopIndices,
  clockTime,
  splitDirectJourneys,
  type DirectJourney,
} from '../data/direct-journeys.ts';
import { getRouteLabel } from '../data/network.ts';
import type { NetworkDataset, NetworkStop } from '../data/network-schema.ts';
import { Icon, type IconName } from './Icon';
import { AppTooltip } from './ui/tooltip';

/** A submitted search and the departure cutoff used to divide its journeys. */
export interface JourneySearchResult {
  departAfter: string;
  journeys: DirectJourney[];
}

/** Match the usual GTFS route types to the transport symbols used by the result badge. */
function routeIcon(type: number | undefined): IconName {
  if (type === 3) return 'bus';
  if (type === 4) return 'boat';
  if (type === 0) return 'tram';
  if (type === 1 || type === 2) return 'train';
  return 'route';
}

/** Point Google Maps at a physical stop using its reviewed snapshot coordinates. */
function googleMapsStopUrl(stop: NetworkStop): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.latitude},${stop.longitude}`)}`;
}

/** A trip visit as shown in either of the journey card's stop lists. */
interface StopTimelineChoice {
  index: number;
  time: string;
  name: string;
  selectable: boolean;
}

/** Match typed stop names without requiring riders to enter Spanish accents. */
function normalizeStopName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/** Show a trip visit, including its place on the rider's selected segment. */
function StopTimelineOption({
  choice,
  count,
  id,
  boardingIndex,
  alightingIndex,
  selected,
  active,
  onSelect,
}: {
  choice: StopTimelineChoice;
  count: number;
  id: string;
  boardingIndex: number;
  alightingIndex: number;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const inJourney = choice.index >= boardingIndex && choice.index <= alightingIndex;
  const endpoint = choice.index === boardingIndex || choice.index === alightingIndex;

  return (
    <div
      id={id}
      aria-disabled={!choice.selectable}
      aria-selected={selected}
      className={`flex min-h-8 w-full items-stretch px-2 py-1 ${selected ? 'font-[700] text-accent' : endpoint ? 'font-[650] text-accent' : choice.selectable ? '' : 'text-muted'} ${active && !selected ? 'underline decoration-accent underline-offset-4' : ''} ${choice.selectable ? 'cursor-pointer hover:text-accent-strong' : 'cursor-default'}`}
      onClick={choice.selectable ? onSelect : undefined}
      onMouseDown={(event) => event.preventDefault()}
      role="option"
    >
      <div className="grid min-w-0 flex-1 grid-cols-[2.25rem_0.75rem_minmax(0,1fr)] items-start gap-x-2 leading-[20px]">
        <span className="tabular-nums">{choice.time}</span>
        <span aria-hidden="true" className="relative self-stretch">
          <span
            className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-line-brand ${choice.index === 0 ? 'top-2.5' : '-top-2'} ${choice.index === count - 1 ? 'bottom-[calc(100%-0.625rem)]' : '-bottom-2'}`}
          />
          {inJourney && (
            <span
              className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-accent ${choice.index === boardingIndex ? 'top-2.5' : '-top-2'} ${choice.index === alightingIndex ? 'bottom-[calc(100%-0.625rem)]' : '-bottom-2'}`}
            />
          )}
          <span
            className={`absolute top-[5px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 ${inJourney ? 'border-accent bg-accent' : 'border-icon-muted bg-surface-input'}`}
          />
        </span>
        <span className="min-w-0 wrap-anywhere">{choice.name}</span>
      </div>
    </div>
  );
}

/** Show the line's shared timeline for whichever journey step is being chosen. */
function StopTimelineList({
  id,
  labelId,
  options,
  boardingIndex,
  alightingIndex,
  selectedIndex,
  triggerRef,
  onSelect,
  onClose,
}: {
  id: string;
  labelId: string;
  options: StopTimelineChoice[];
  boardingIndex: number;
  alightingIndex: number;
  selectedIndex: number;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const eligible = options.filter((option) => option.selectable);

  useEffect(() => {
    typeahead.current = { text: '', time: 0 };
    const frame = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Center the active visit inside the list without moving the whole page.
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const option = document.getElementById(`${id}-option-${activeIndex}`);
      if (!list || !option) return;
      const listRect = list.getBoundingClientRect();
      const optionRect = option.getBoundingClientRect();
      list.scrollTop += optionRect.top - listRect.top - (list.clientHeight - optionRect.height) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, id]);

  /** Close and return focus to the chosen stop button. */
  function closeAndFocus() {
    onClose();
    triggerRef.current?.focus();
  }

  /** Select a permitted visit; the card handles any dependent alighting change. */
  function choose(index: number) {
    if (!options[index]?.selectable) return;
    onSelect(index);
    closeAndFocus();
  }

  /** Move through permitted stops and commit only on Enter or Space. */
  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocus();
      return;
    }
    if (event.key === 'Tab') {
      // Let the browser move focus before removing the list from the page.
      requestAnimationFrame(onClose);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? eligible[0]!.index : eligible[eligible.length - 1]!.index);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const current = eligible.findIndex((option) => option.index === activeIndex);
      setActiveIndex(eligible[(current + direction + eligible.length) % eligible.length]!.index);
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;

    // Repeated initials cycle through matches; longer text narrows to a stop name.
    const now = event.timeStamp;
    const previous = now - typeahead.current.time < 700 ? typeahead.current.text : '';
    const typed = normalizeStopName(previous + event.key);
    const query =
      previous.length > 0 && [...typed].every((character) => character === typed[0])
        ? normalizeStopName(event.key)
        : typed;
    typeahead.current = { text: query, time: now };
    const start = query.length === 1 ? activeIndex + 1 : activeIndex;
    for (let offset = 0; offset < options.length; offset += 1) {
      const option = options[(start + offset) % options.length]!;
      if (option.selectable && normalizeStopName(option.name).startsWith(query)) {
        setActiveIndex(option.index);
        break;
      }
    }
  }

  return (
    <div
      id={id}
      ref={listRef}
      aria-activedescendant={`${id}-option-${activeIndex}`}
      aria-labelledby={labelId}
      className="relative max-h-[min(20rem,calc(100dvh-2rem))] overflow-y-auto overscroll-contain text-[13px] text-ink outline-none"
      onKeyDown={handleListKeyDown}
      role="listbox"
      tabIndex={0}
    >
      {options.map((option) => (
        <StopTimelineOption
          key={option.index}
          id={`${id}-option-${option.index}`}
          choice={option}
          count={options.length}
          boardingIndex={boardingIndex}
          alightingIndex={alightingIndex}
          selected={option.index === selectedIndex}
          active={option.index === activeIndex}
          onSelect={() => choose(option.index)}
        />
      ))}
    </div>
  );
}

/** Show one trip and allow a rider to choose another reachable stop pair on that trip. */
function JourneyCard({
  journey,
  dataset,
  defaultBoardingIndex,
  defaultAlightingIndex,
}: {
  journey: DirectJourney;
  dataset: NetworkDataset;
  defaultBoardingIndex: number;
  defaultAlightingIndex: number;
}) {
  const { t } = useTranslation();
  const stopLabelId = useId();
  const stopListId = useId();
  const boardTriggerRef = useRef<HTMLButtonElement>(null);
  const alightTriggerRef = useRef<HTMLButtonElement>(null);
  const initialBoarding = journey.boardings[defaultBoardingIndex]!;
  const [boardingIndex, setBoardingIndex] = useState(initialBoarding.index);
  const [alightingIndex, setAlightingIndex] = useState(defaultAlightingIndex);
  const [openStop, setOpenStop] = useState<'board' | 'alight' | null>(null);
  const stopsById = new Map(dataset.stops.map((stop) => [stop.id, stop]));
  const route = dataset.routes.find((route) => route.id === journey.routeId);
  const trip = dataset.trips.find((trip) => trip.id === journey.tripId)!;
  const boarding = trip.stopTimes[boardingIndex]!;
  const alighting = trip.stopTimes[alightingIndex]!;
  const boardingStop = stopsById.get(boarding.stopId);
  const alightingStop = stopsById.get(alighting.stopId);
  // The journey's recorded boarding time gives every trip visit the same service-day offset.
  const firstBoarding = journey.boardings[0]!;
  const minuteOffset = firstBoarding.departureMinute - trip.stopTimes[firstBoarding.index]!.departureMinutes;
  const boardableIndices = boardableTripStopIndices(trip);
  const alightableIndices = alightableTripStopIndices(trip, boardingIndex);
  const boardingOptions = trip.stopTimes.map((time, index) => ({
    index,
    time: clockTime(time.departureMinutes + minuteOffset),
    name: stopsById.get(time.stopId)?.name ?? time.stopId,
    selectable: boardableIndices.includes(index),
  }));
  const alightingOptions = trip.stopTimes.map((time, index) => ({
    index,
    time: clockTime(time.arrivalMinutes + minuteOffset),
    name: stopsById.get(time.stopId)?.name ?? time.stopId,
    selectable: alightableIndices.includes(index),
  }));
  const duration = alighting.arrivalMinutes - boarding.departureMinutes;
  const hasLongNameTooltip = Boolean(route?.shortName && route.longName);
  /** Open the shared timeline for a step, or collapse it when that step is already open. */
  function toggleStopList(step: 'board' | 'alight') {
    setOpenStop((current) => (current === step ? null : step));
  }

  const lineChip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-surface-active px-2 py-1 text-xs font-[700] text-accent ${hasLongNameTooltip ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent' : ''}`}
      tabIndex={hasLongNameTooltip ? 0 : undefined}
    >
      <Icon name={routeIcon(route?.type)} size={15} strokeWidth={1.8} />
      {t('journey.line', { line: route === undefined ? journey.routeId : getRouteLabel(route) })}
    </span>
  );

  return (
    <article className="journey-card min-w-0 rounded-xl border border-line-subtle bg-surface-input px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3>
          {hasLongNameTooltip && route?.longName ? (
            <AppTooltip
              side="right"
              content={<span className="block max-w-[min(20rem,calc(100vw-3rem))]">{route.longName}</span>}
            >
              {lineChip}
            </AppTooltip>
          ) : (
            lineChip
          )}
        </h3>
        <span className="text-xs text-muted">{t('journey.duration', { count: duration })}</span>
      </div>
      <div className="mt-3 flex items-center gap-3 tabular-nums">
        <time
          className="text-[25px] font-[700] tracking-[-0.8px]"
          dateTime={clockTime(boarding.departureMinutes + minuteOffset)}
        >
          {clockTime(boarding.departureMinutes + minuteOffset)}
        </time>
        <Icon name="arrow" className="size-5 shrink-0 text-icon-muted" />
        <time
          className="text-[25px] font-[700] tracking-[-0.8px]"
          dateTime={clockTime(alighting.arrivalMinutes + minuteOffset)}
        >
          {clockTime(alighting.arrivalMinutes + minuteOffset)}
        </time>
      </div>
      {alighting.arrivalMinutes + minuteOffset >= 1440 && (
        <p className="mt-1 text-xs text-muted">{t('journey.nextDay')}</p>
      )}
      <div className="journey-card-fields mt-4 grid gap-3 text-sm">
        <div className="min-w-0">
          <span
            id={`${stopLabelId}-board`}
            className={`block text-xs font-[650] ${openStop === 'board' ? 'text-accent' : ''}`}
          >
            {t('journey.boardAt')}
          </span>
          <div className="mt-1 flex min-w-0 items-start gap-1">
            {boardableIndices.length > 1 ? (
              <button
                ref={boardTriggerRef}
                id={`${stopLabelId}-board-trigger`}
                aria-controls={openStop === 'board' ? stopListId : undefined}
                aria-expanded={openStop === 'board'}
                aria-haspopup="listbox"
                aria-labelledby={`${stopLabelId}-board ${stopLabelId}-board-trigger`}
                className={`-ml-2 flex min-h-6 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 text-left ${openStop === 'board' ? 'bg-[#155f64] text-white' : 'hover:text-accent-strong'}`}
                onClick={() => toggleStopList('board')}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setOpenStop('board');
                  }
                }}
                type="button"
              >
                <span className="min-w-0 truncate">{boardingStop?.name ?? boarding.stopId}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`shrink-0 ${openStop === 'board' ? 'rotate-180 text-white' : 'text-muted'}`}
                  size={16}
                  strokeWidth={1.6}
                />
              </button>
            ) : (
              <p className="min-w-0 flex-1 wrap-anywhere">{boardingStop?.name ?? boarding.stopId}</p>
            )}
            {boardingStop && (
              <a
                aria-label={t('journey.openStopInGoogleMaps', { stop: boardingStop.name })}
                className="grid size-6 shrink-0 place-items-center rounded-lg text-icon-muted hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={googleMapsStopUrl(boardingStop)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon name="externalLink" size={14} />
              </a>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <span
            id={`${stopLabelId}-alight`}
            className={`block text-xs font-[650] ${openStop === 'alight' ? 'text-accent' : ''}`}
          >
            {t('journey.alightAt')}
          </span>
          <div className="mt-1 flex min-w-0 items-start gap-1">
            {alightableIndices.length > 1 ? (
              <button
                ref={alightTriggerRef}
                id={`${stopLabelId}-alight-trigger`}
                aria-controls={openStop === 'alight' ? stopListId : undefined}
                aria-expanded={openStop === 'alight'}
                aria-haspopup="listbox"
                aria-labelledby={`${stopLabelId}-alight ${stopLabelId}-alight-trigger`}
                className={`-ml-2 flex min-h-6 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 text-left ${openStop === 'alight' ? 'bg-[#155f64] text-white' : 'hover:text-accent-strong'}`}
                onClick={() => toggleStopList('alight')}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setOpenStop('alight');
                  }
                }}
                type="button"
              >
                <span className="min-w-0 truncate">{alightingStop?.name ?? alighting.stopId}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`shrink-0 ${openStop === 'alight' ? 'rotate-180 text-white' : 'text-muted'}`}
                  size={16}
                  strokeWidth={1.6}
                />
              </button>
            ) : (
              <p className="min-w-0 flex-1 wrap-anywhere">{alightingStop?.name ?? alighting.stopId}</p>
            )}
            {alightingStop && (
              <a
                aria-label={t('journey.openStopInGoogleMaps', { stop: alightingStop.name })}
                className="grid size-6 shrink-0 place-items-center rounded-lg text-icon-muted hover:bg-surface-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={googleMapsStopUrl(alightingStop)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon name="externalLink" size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
      {openStop !== null && (
        <div className="mt-2 min-w-0">
          <StopTimelineList
            key={openStop}
            id={stopListId}
            labelId={`${stopLabelId}-${openStop}`}
            options={openStop === 'board' ? boardingOptions : alightingOptions}
            boardingIndex={boardingIndex}
            alightingIndex={alightingIndex}
            selectedIndex={openStop === 'board' ? boardingIndex : alightingIndex}
            triggerRef={openStop === 'board' ? boardTriggerRef : alightTriggerRef}
            onSelect={(index) => {
              if (openStop === 'board') {
                const nextAlightings = alightableTripStopIndices(trip, index);
                setBoardingIndex(index);
                if (!nextAlightings.includes(alightingIndex)) setAlightingIndex(nextAlightings[0]!);
              } else {
                setAlightingIndex(index);
              }
            }}
            onClose={() => setOpenStop((current) => (current === openStop ? null : current))}
          />
        </div>
      )}
    </article>
  );
}

/** Render submitted journeys or a prompt while the rider edits a previous search. */
export function DirectJourneyResults({
  dataset,
  result,
  panelRef,
}: {
  dataset: NetworkDataset;
  result: JourneySearchResult | null;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [earlierCount, setEarlierCount] = useState(0);
  const [laterCount, setLaterCount] = useState(4);
  const split = result === null ? { earlier: [], later: [] } : splitDirectJourneys(result.journeys, result.departAfter);
  const visible = [
    ...split.earlier.slice(Math.max(0, split.earlier.length - earlierCount)),
    ...split.later.slice(0, laterCount),
  ];
  const total = split.earlier.length + split.later.length;
  const hasEarlier = earlierCount < split.earlier.length;
  const hasLater = laterCount < split.later.length;

  return (
    <section
      ref={panelRef}
      aria-labelledby="journey-results-title"
      className="min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)] max-[380px]:p-4.5 desktop:p-8"
    >
      <h2 id="journey-results-title" className="text-xl font-[700]">
        {t('journey.results')}
      </h2>
      {result === null ? (
        <p className="mt-4 text-sm text-muted" role="status">
          {t('journey.chooseLocations')}
        </p>
      ) : total === 0 ? (
        <p className="mt-4 text-sm text-muted" role="status">
          {t('journey.empty')}
        </p>
      ) : (
        <>
          {hasEarlier && (
            <button
              type="button"
              className="mt-3 flex min-h-11 items-center gap-1 text-sm font-[650] text-accent hover:underline"
              onClick={() => setEarlierCount((count) => count + 4)}
            >
              <span aria-hidden="true">↑</span>
              {t('journey.earlierDepartures')}
            </button>
          )}
          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-muted" role="status">
              {t('journey.noLater')}
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {visible.map(({ journey, boardingIndex, alightingIndex }) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  dataset={dataset}
                  defaultBoardingIndex={boardingIndex}
                  defaultAlightingIndex={alightingIndex}
                />
              ))}
            </div>
          )}
          {hasLater && (
            <button
              type="button"
              className="mt-3 flex min-h-11 items-center gap-1 text-sm font-[650] text-accent hover:underline"
              onClick={() => setLaterCount((count) => count + 4)}
            >
              {t('journey.laterDepartures')}
              <span aria-hidden="true">↓</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}
