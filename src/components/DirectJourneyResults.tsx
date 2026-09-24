import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { clockTime, type DirectJourney } from '../data/direct-journeys.ts';
import { getRouteLabel } from '../data/network.ts';
import type { NetworkDataset } from '../data/network-schema.ts';

/** A submitted search and the labels needed to identify its results. */
export interface JourneySearchResult {
  originName: string;
  destinationName: string;
  journeys: DirectJourney[];
}

/** Show one trip and allow a rider to choose another reachable stop pair on that trip. */
function JourneyCard({ journey, dataset }: { journey: DirectJourney; dataset: NetworkDataset }) {
  const { t } = useTranslation();
  const [boardingIndex, setBoardingIndex] = useState(0);
  const [alightingIndex, setAlightingIndex] = useState(0);
  const boarding = journey.boardings[boardingIndex]!;
  const alighting = boarding.alightings[alightingIndex]!;
  const stopNames = new Map(dataset.stops.map((stop) => [stop.id, stop.name]));
  const route = dataset.routes.find((route) => route.id === journey.routeId);
  const duration = alighting.arrivalMinute - boarding.departureMinute;

  return (
    <article className="journey-card min-w-0 rounded-2xl border border-line-subtle bg-surface-input p-5">
      <h3 className="text-base font-[700]">{route === undefined ? journey.routeId : getRouteLabel(route)}</h3>
      {route?.shortName && route.longName && <p className="mt-1 text-sm text-muted">{route.longName}</p>}
      <div className="journey-card-fields mt-4 grid gap-3 text-sm">
        <div className="min-w-0">
          {journey.boardings.length > 1 ? (
            <label className="block font-[650]" htmlFor={`${journey.id}-board`}>
              {t('journey.boardAt')}
            </label>
          ) : (
            <span className="block font-[650]">{t('journey.boardAt')}</span>
          )}
          {journey.boardings.length > 1 ? (
            <select
              id={`${journey.id}-board`}
              className="mt-1 min-h-11 w-full rounded-lg border border-line-input bg-surface-card px-2"
              value={boardingIndex}
              onChange={(event) => {
                setBoardingIndex(Number(event.target.value));
                setAlightingIndex(0);
              }}
            >
              {journey.boardings.map((choice, index) => (
                <option key={choice.index} value={index}>
                  {clockTime(choice.departureMinute)} · {stopNames.get(choice.stopId)}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 wrap-anywhere">
              {clockTime(boarding.departureMinute)} · {stopNames.get(boarding.stopId)}
            </p>
          )}
        </div>
        <div className="min-w-0">
          {boarding.alightings.length > 1 ? (
            <label className="block font-[650]" htmlFor={`${journey.id}-alight`}>
              {t('journey.alightAt')}
            </label>
          ) : (
            <span className="block font-[650]">{t('journey.alightAt')}</span>
          )}
          {boarding.alightings.length > 1 ? (
            <select
              id={`${journey.id}-alight`}
              className="mt-1 min-h-11 w-full rounded-lg border border-line-input bg-surface-card px-2"
              value={alightingIndex}
              onChange={(event) => setAlightingIndex(Number(event.target.value))}
            >
              {boarding.alightings.map((choice, index) => (
                <option key={choice.index} value={index}>
                  {clockTime(choice.arrivalMinute)} · {stopNames.get(choice.stopId)}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 wrap-anywhere">
              {clockTime(alighting.arrivalMinute)} · {stopNames.get(alighting.stopId)}
            </p>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        {t('journey.duration', { count: duration })}
        {alighting.arrivalMinute >= 1440 && ` · ${t('journey.nextDay')}`}
      </p>
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
  const [visibleCount, setVisibleCount] = useState(20);

  return (
    <section
      ref={panelRef}
      aria-labelledby="journey-results-title"
      className="journey-results-transition min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)] max-[380px]:p-4.5 desktop:p-8"
    >
      <h2 id="journey-results-title" className="text-xl font-[700]">
        {t('journey.results')}
      </h2>
      {result === null ? (
        <p className="mt-4 text-sm text-muted" role="status">
          {t('journey.searchAgain')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm wrap-anywhere text-muted">
            {t('journey.resultsRoute', { origin: result.originName, destination: result.destinationName })}
          </p>
          {result.journeys.length === 0 ? (
            <p className="mt-4 text-sm text-muted" role="status">
              {t('journey.empty')}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted" role="status">
                {t('journey.resultCount', { count: result.journeys.length })}
              </p>
              <div className="mt-4 grid gap-4">
                {result.journeys.slice(0, visibleCount).map((journey) => (
                  <JourneyCard key={journey.id} journey={journey} dataset={dataset} />
                ))}
              </div>
              {visibleCount < result.journeys.length && (
                <button
                  type="button"
                  className="mt-5 min-h-11 rounded-xl border border-line-input px-5 text-sm font-[650]"
                  onClick={() => setVisibleCount((count) => count + 20)}
                >
                  {t('journey.showMore')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
