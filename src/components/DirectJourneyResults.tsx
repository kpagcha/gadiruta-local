import { Select as SelectPrimitive } from '@base-ui/react/select';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  alightableTripStopIndices,
  boardableTripStopIndices,
  clockTime,
  splitDirectJourneys,
  type DirectJourney,
} from '../data/direct-journeys.ts';
import { getRouteLabel } from '../data/network.ts';
import type { NetworkDataset } from '../data/network-schema.ts';
import { Icon, type IconName } from './Icon';
import { Select, SelectContent, SelectTrigger, SelectValue } from './ui/select';
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

/** Show one stop visit and highlight it when it is selected on this trip. */
function StopTimelineOption({
  index,
  count,
  time,
  name,
  selected,
  selectable,
}: {
  index: number;
  count: number;
  time: string;
  name: string;
  selected: boolean;
  selectable: boolean;
}) {
  return (
    <SelectPrimitive.Item
      value={String(index)}
      label={name}
      disabled={!selectable}
      className={`flex min-h-9 w-full items-stretch rounded-lg px-2 py-1.5 outline-none ${selected ? 'font-[700] text-accent' : ''} ${selectable ? 'cursor-pointer hover:text-accent-strong data-[highlighted]:text-accent-strong' : 'cursor-default text-muted'}`}
    >
      <SelectPrimitive.ItemText className="grid min-w-0 flex-1 grid-cols-[3rem_1rem_minmax(0,1fr)] items-start gap-x-2 leading-5">
        <span className="tabular-nums">{time}</span>
        <span aria-hidden="true" className="relative self-stretch">
          <span
            className={`absolute left-1/2 w-0.5 -translate-x-1/2 bg-line-brand ${index === 0 ? 'top-2.5' : '-top-2'} ${index === count - 1 ? 'bottom-[calc(100%-0.625rem)]' : '-bottom-2'}`}
          />
          <span
            className={`absolute top-[5px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 ${selected ? 'border-accent bg-accent' : 'border-icon-muted bg-surface-card'}`}
          />
        </span>
        <span className="min-w-0 wrap-anywhere">{name}</span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

/** Show one trip and allow a rider to choose another reachable stop pair on that trip. */
function JourneyCard({
  journey,
  dataset,
  defaultBoardingIndex,
}: {
  journey: DirectJourney;
  dataset: NetworkDataset;
  defaultBoardingIndex: number;
}) {
  const { t } = useTranslation();
  const initialBoarding = journey.boardings[defaultBoardingIndex]!;
  const [boardingIndex, setBoardingIndex] = useState(initialBoarding.index);
  const [alightingIndex, setAlightingIndex] = useState(initialBoarding.alightings[0]!.index);
  const stopNames = new Map(dataset.stops.map((stop) => [stop.id, stop.name]));
  const route = dataset.routes.find((route) => route.id === journey.routeId);
  const trip = dataset.trips.find((trip) => trip.id === journey.tripId)!;
  const boarding = trip.stopTimes[boardingIndex]!;
  const alighting = trip.stopTimes[alightingIndex]!;
  // The journey's recorded boarding time gives every trip visit the same service-day offset.
  const firstBoarding = journey.boardings[0]!;
  const minuteOffset = firstBoarding.departureMinute - trip.stopTimes[firstBoarding.index]!.departureMinutes;
  const boardableIndices = boardableTripStopIndices(trip);
  const alightableIndices = alightableTripStopIndices(trip, boardingIndex);
  const duration = alighting.arrivalMinutes - boarding.departureMinutes;
  const hasLongNameTooltip = Boolean(route?.shortName && route.longName);
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
          {boardableIndices.length > 1 ? (
            <label className="block text-xs font-[650]" htmlFor={`${journey.id}-board`}>
              {t('journey.boardAt')}
            </label>
          ) : (
            <span className="block text-xs font-[650]">{t('journey.boardAt')}</span>
          )}
          {boardableIndices.length > 1 ? (
            <Select
              items={trip.stopTimes.map((time, index) => ({
                value: String(index),
                label: stopNames.get(time.stopId) ?? time.stopId,
              }))}
              value={String(boardingIndex)}
              onValueChange={(stopIndex) => {
                if (stopIndex === null) return;
                const nextBoardingIndex = Number(stopIndex);
                if (!boardableIndices.includes(nextBoardingIndex)) return;
                const nextAlightings = alightableTripStopIndices(trip, nextBoardingIndex);
                setBoardingIndex(nextBoardingIndex);
                if (!nextAlightings.includes(alightingIndex)) setAlightingIndex(nextAlightings[0]!);
              }}
            >
              <SelectTrigger
                id={`${journey.id}-board`}
                className="-ml-2 min-h-6 w-[calc(100%+0.5rem)] rounded-lg px-2 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:shadow-[var(--shadow-field-focus)]"
              >
                <SelectValue className="min-w-0 truncate">
                  {stopNames.get(boarding.stopId) ?? boarding.stopId}
                </SelectValue>
              </SelectTrigger>
              <SelectContent wide>
                {trip.stopTimes.map((time, index) => (
                  <StopTimelineOption
                    key={index}
                    index={index}
                    count={trip.stopTimes.length}
                    time={clockTime(time.departureMinutes + minuteOffset)}
                    name={stopNames.get(time.stopId) ?? time.stopId}
                    selected={index === boardingIndex}
                    selectable={boardableIndices.includes(index)}
                  />
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="mt-1 wrap-anywhere">{stopNames.get(boarding.stopId)}</p>
          )}
        </div>
        <div className="min-w-0">
          {alightableIndices.length > 1 ? (
            <label className="block text-xs font-[650]" htmlFor={`${journey.id}-alight`}>
              {t('journey.alightAt')}
            </label>
          ) : (
            <span className="block text-xs font-[650]">{t('journey.alightAt')}</span>
          )}
          {alightableIndices.length > 1 ? (
            <Select
              items={trip.stopTimes.map((time, index) => ({
                value: String(index),
                label: stopNames.get(time.stopId) ?? time.stopId,
              }))}
              value={String(alightingIndex)}
              onValueChange={(stopIndex) => {
                if (stopIndex === null) return;
                const nextAlightingIndex = Number(stopIndex);
                if (alightableIndices.includes(nextAlightingIndex)) setAlightingIndex(nextAlightingIndex);
              }}
            >
              <SelectTrigger
                id={`${journey.id}-alight`}
                className="-ml-2 min-h-6 w-[calc(100%+0.5rem)] rounded-lg px-2 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:shadow-[var(--shadow-field-focus)]"
              >
                <SelectValue className="min-w-0 truncate">
                  {stopNames.get(alighting.stopId) ?? alighting.stopId}
                </SelectValue>
              </SelectTrigger>
              <SelectContent wide>
                {trip.stopTimes.map((time, index) => (
                  <StopTimelineOption
                    key={index}
                    index={index}
                    count={trip.stopTimes.length}
                    time={clockTime(time.arrivalMinutes + minuteOffset)}
                    name={stopNames.get(time.stopId) ?? time.stopId}
                    selected={index === alightingIndex}
                    selectable={alightableIndices.includes(index)}
                  />
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="mt-1 wrap-anywhere">{stopNames.get(alighting.stopId)}</p>
          )}
        </div>
      </div>
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
              {visible.map(({ journey, boardingIndex }) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  dataset={dataset}
                  defaultBoardingIndex={boardingIndex}
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
