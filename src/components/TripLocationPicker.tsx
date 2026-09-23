import { useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocationOptions, searchLocations, type LocationOption } from '../data/location-search.ts';
import { clockTime, findDirectJourneys, madridToday, type DirectJourney } from '../data/direct-journeys.ts';
import { getRouteLabel } from '../data/network.ts';
import type { NetworkDataset } from '../data/network-schema.ts';
import { places } from '../data/places.ts';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { Icon } from './Icon';

/** Text being edited and the exact choice, if the rider selected one. */
interface LocationFieldValue {
  text: string;
  choice: LocationOption | null;
}

/** One of the two identical search controls in the trip picker. */
interface LocationFieldProps {
  id: 'origin' | 'destination';
  label: string;
  placeholder: string;
  options: readonly LocationOption[];
  disabled: boolean;
  value: LocationFieldValue;
  onChange: (value: LocationFieldValue) => void;
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
    <article className="rounded-2xl border border-line bg-surface-card p-5 shadow-[var(--shadow-card)]">
      <h4 className="text-base font-[700]">{route === undefined ? journey.routeId : getRouteLabel(route)}</h4>
      {route?.shortName && route.longName && <p className="mt-1 text-sm text-muted">{route.longName}</p>}
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
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
              className="mt-1 min-h-11 w-full rounded-lg border border-line-input bg-surface-input px-2"
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
            <p className="mt-1">
              {clockTime(boarding.departureMinute)} · {stopNames.get(boarding.stopId)}
            </p>
          )}
        </div>
        <div>
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
              className="mt-1 min-h-11 w-full rounded-lg border border-line-input bg-surface-input px-2"
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
            <p className="mt-1">
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

/** Render a labelled search input with keyboard-accessible place and stop suggestions. */
function LocationField({ id, label, placeholder, options, disabled, value, onChange }: LocationFieldProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const results = value.choice === null && isOpen ? searchLocations(options, value.text) : [];
  const showResults = !disabled && value.choice === null && isOpen && value.text.trim() !== '';

  /** Close suggestions only when focus leaves this field and its result buttons. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  }

  /** Let the input's down arrow reach the first result without changing the typed query. */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      resultRefs.current[0]?.focus();
    }
  }

  /** Keep result navigation within the small suggestion list and return upward to the input. */
  function handleResultKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      inputRef.current?.focus();
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' && index < results.length - 1) {
      event.preventDefault();
      resultRefs.current[index + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) {
        inputRef.current?.focus();
      } else {
        resultRefs.current[index - 1]?.focus();
      }
    }
  }

  return (
    <div className="relative focus-within:z-40" onBlur={handleBlur}>
      <label className="mb-2 flex items-center gap-2.25 text-[13px] font-[650]" htmlFor={`${id}-search`}>
        <span
          aria-hidden="true"
          className={id === 'origin' ? 'size-2.5 rounded-full border-2 border-accent' : 'size-2.5 rounded-sm bg-accent'}
        />
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          autoComplete="off"
          className="min-h-15 w-full rounded-xl border border-line-input bg-surface-card py-4.5 pr-12 pl-4 text-[17px] text-ink placeholder:text-muted-soft focus:shadow-[var(--shadow-field-focus)] disabled:cursor-not-allowed disabled:opacity-60 max-[380px]:pl-3 max-[380px]:text-base"
          disabled={disabled}
          id={`${id}-search`}
          onChange={(event) => {
            onChange({ text: event.target.value, choice: null });
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.choice === null && value.text.trim() !== '') {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          type="search"
          value={value.text}
        />
        {value.text === '' && (
          <Icon
            name="stop"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-icon-muted"
            size={19}
          />
        )}
      </div>
      {showResults && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-line-popover bg-surface-card p-1.5 shadow-[var(--shadow-popover)]">
          <p className="sr-only" role="status">
            {t('search.resultCount', { count: results.length })}
          </p>
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">{t('search.noResults')}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {results.map((result, index) => {
                const extraLines = result.kind === 'stop' ? result.routeLabels.length - 2 : 0;
                return (
                  <li key={`${result.kind}:${result.id}`}>
                    <button
                      ref={(button) => {
                        resultRefs.current[index] = button;
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-hover focus-visible:bg-surface-hover"
                      onClick={() => {
                        onChange({ text: result.name, choice: result });
                        inputRef.current?.focus();
                        setIsOpen(false);
                      }}
                      onKeyDown={(event) => handleResultKeyDown(event, index)}
                      type="button"
                    >
                      <span className="mt-0.5 text-accent">
                        <Icon name={result.kind === 'place' ? 'place' : 'stop'} size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-[650]">{result.name}</span>
                        {result.kind === 'stop' && (
                          <span className="block text-xs leading-5 text-muted">
                            {t('search.stop')}
                            {result.routeLabels.length > 0 && (
                              <>
                                {' · '}
                                {result.routeLabels.slice(0, 2).join(', ')}
                                {extraLines > 0 && ` (+${extraLines})`}
                              </>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Let a rider select a place or exact stop independently for each end of a future direct trip. */
export function TripLocationPicker({ state }: { state: NetworkDatasetState }) {
  const { t } = useTranslation();
  const [endpoints, setEndpoints] = useState<{ origin: LocationFieldValue; destination: LocationFieldValue }>({
    origin: { text: '', choice: null },
    destination: { text: '', choice: null },
  });
  const [travelDate, setTravelDate] = useState(madridToday);
  const [journeys, setJourneys] = useState<DirectJourney[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const options = useMemo(
    () => (state.status === 'ready' ? createLocationOptions(places, state.dataset) : []),
    [state],
  );
  const disabled = state.status !== 'ready';
  const coverage = state.status === 'ready' ? state.dataset.coverage : null;
  const dateValid = coverage !== null && travelDate >= coverage.startDate && travelDate <= coverage.endDate;
  const sameExactStop =
    endpoints.origin.choice?.kind === 'stop' &&
    endpoints.destination.choice?.kind === 'stop' &&
    endpoints.origin.choice.id === endpoints.destination.choice.id;
  const canSearch =
    state.status === 'ready' &&
    dateValid &&
    endpoints.origin.choice !== null &&
    endpoints.destination.choice !== null &&
    !sameExactStop;

  /** Clear the submitted list whenever a location, direction, or date changes. */
  function clearJourneys() {
    setJourneys(null);
    setVisibleCount(20);
  }

  return (
    <section
      aria-labelledby="trip-search-title"
      className="min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)] max-[380px]:p-4.5 desktop:p-8"
    >
      <h2 id="trip-search-title" className="sr-only">
        {t('search.title')}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !canSearch ||
            state.status !== 'ready' ||
            endpoints.origin.choice === null ||
            endpoints.destination.choice === null
          )
            return;
          setJourneys(
            findDirectJourneys(state.dataset, travelDate, endpoints.origin.choice, endpoints.destination.choice),
          );
          setVisibleCount(20);
        }}
      >
        <div>
          <LocationField
            disabled={disabled}
            id="origin"
            label={t('search.origin')}
            placeholder={t('search.originPlaceholder')}
            onChange={(value) => {
              setEndpoints((current) => ({ ...current, origin: value }));
              clearJourneys();
            }}
            options={options}
            value={endpoints.origin}
          />
          <div className="flex min-h-16 items-center justify-end gap-3">
            <span className="h-px flex-1 translate-y-3.5 bg-line-subtle" aria-hidden="true" />
            <button
              aria-label={t('search.swap')}
              className="grid size-11 shrink-0 translate-y-3.5 place-items-center rounded-full border border-line bg-paper text-accent transition-colors hover:bg-surface-hover disabled:opacity-45"
              disabled={disabled || (!endpoints.origin.text && !endpoints.destination.text)}
              onClick={() => {
                setEndpoints(({ origin, destination }) => ({ origin: destination, destination: origin }));
                clearJourneys();
              }}
              title={t('search.swap')}
              type="button"
            >
              <Icon name="swap" size={20} />
            </button>
          </div>
          <LocationField
            disabled={disabled}
            id="destination"
            label={t('search.destination')}
            placeholder={t('search.destinationPlaceholder')}
            onChange={(value) => {
              setEndpoints((current) => ({ ...current, destination: value }));
              clearJourneys();
            }}
            options={options}
            value={endpoints.destination}
          />
        </div>
        {state.status === 'loading' && (
          <p className="mt-4 text-sm text-muted" role="status">
            {t('search.loading')}
          </p>
        )}
        {state.status === 'error' && (
          <p className="mt-4 text-sm text-warning" role="alert">
            {t('search.error')}
          </p>
        )}
        <div className="mt-7 border-t border-line pt-5">
          <label className="block text-sm font-[650]" htmlFor="travel-date">
            {t('search.travelDate')}
          </label>
          <input
            id="travel-date"
            type="date"
            className="mt-2 min-h-11 w-full rounded-xl border border-line-input bg-surface-input px-4 text-ink"
            min={coverage?.startDate}
            max={coverage?.endDate}
            value={travelDate}
            onChange={(event) => {
              setTravelDate(event.target.value);
              clearJourneys();
            }}
            disabled={disabled}
          />
          {coverage !== null && madridToday() > coverage.endDate && (
            <p className="mt-3 text-sm text-warning" role="alert">
              {t('search.expiredData', { date: coverage.endDate })}
            </p>
          )}
          {sameExactStop && <p className="mt-3 text-sm text-warning">{t('search.sameStop')}</p>}
          <button
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-[700] text-on-accent disabled:opacity-45"
            disabled={!canSearch}
            type="submit"
          >
            <Icon name="route" size={18} />
            {t('search.findTransport')}
          </button>
        </div>
      </form>
      {journeys !== null && state.status === 'ready' && (
        <section className="mt-8" aria-live="polite" aria-labelledby="journey-results-title">
          <h3 id="journey-results-title" className="text-xl font-[700]">
            {t('journey.results')}
          </h3>
          {journeys.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t('journey.empty')}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">{t('journey.resultCount', { count: journeys.length })}</p>
              <div className="mt-4 grid gap-4">
                {journeys.slice(0, visibleCount).map((journey) => (
                  <JourneyCard key={journey.id} journey={journey} dataset={state.dataset} />
                ))}
              </div>
              {visibleCount < journeys.length && (
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
        </section>
      )}
    </section>
  );
}
