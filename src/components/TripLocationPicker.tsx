import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RECENT_SEARCH_LIMIT } from '../config.ts';
import { searchLocations, type LocationOption } from '../data/location-search.ts';
import { madridToday } from '../data/direct-journeys.ts';
import { currentMadridQuarterHour, type DepartureMode } from '../data/journey-time.ts';
import type { RecentSearch } from '../data/recent-searches.ts';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { Icon } from './Icon';
import { JourneyDatePill } from './JourneyDatePill';
import { JourneyTimePill } from './JourneyTimePill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AppTooltip } from './ui/tooltip';

/** Text being edited and the exact choice, if the rider selected one. */
export interface LocationFieldValue {
  text: string;
  choice: LocationOption | null;
}

/** The editable inputs for one direct-journey search. */
export interface TripSearchDraft {
  origin: LocationFieldValue;
  destination: LocationFieldValue;
  date: string;
  departAfter: string;
  departureMode: DepartureMode;
}

/** One of the two identical search controls in the trip picker. */
interface LocationFieldProps {
  id: 'origin' | 'destination';
  label: string;
  placeholder: string;
  options: readonly LocationOption[];
  disabled: boolean;
  value: LocationFieldValue;
  onChange: (value: LocationFieldValue, committed: boolean) => void;
}

/** Render a labelled search input with keyboard-accessible place and stop suggestions. */
function LocationField({ id, label, placeholder, options, disabled, value, onChange }: LocationFieldProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
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
    <div className="relative min-w-0 focus-within:z-40" onBlur={handleBlur}>
      <label className="sr-only" htmlFor={`${id}-search`}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          autoComplete="off"
          className={`h-15 w-full min-w-0 rounded-xl border border-line-input bg-surface-card text-[17px] text-ink placeholder:text-muted-soft focus:shadow-[var(--shadow-field-focus)] disabled:cursor-not-allowed disabled:opacity-60 max-[380px]:text-base ${
            isInputFocused ? 'pl-11 max-[380px]:pl-10' : 'pl-4 max-[380px]:pl-3'
          } ${isInputFocused && value.text === '' ? 'pr-4' : 'pr-12'}`}
          disabled={disabled}
          id={`${id}-search`}
          onChange={(event) => {
            onChange({ text: event.target.value, choice: null }, false);
            setIsOpen(true);
          }}
          onBlur={() => setIsInputFocused(false)}
          onFocus={() => {
            setIsInputFocused(true);
            if (value.choice === null && value.text.trim() !== '') {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={isInputFocused ? placeholder : ''}
          role="searchbox"
          type="text"
          value={value.text}
        />
        {!isInputFocused && value.text === '' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[17px] font-[700] text-accent max-[380px]:left-3 max-[380px]:text-base"
          >
            {label}
          </span>
        )}
        {isInputFocused && (
          <Icon
            name="search"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-accent max-[380px]:left-3"
            size={18}
          />
        )}
        {value.text !== '' && !disabled ? (
          <button
            aria-label={t(id === 'origin' ? 'search.clearOrigin' : 'search.clearDestination')}
            className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
            onClick={() => {
              onChange({ text: '', choice: null }, false);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            title={t(id === 'origin' ? 'search.clearOrigin' : 'search.clearDestination')}
            type="button"
          >
            <Icon name="close" size={17} />
          </button>
        ) : value.text === '' && !isInputFocused ? (
          <Icon
            name="stop"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-icon-muted"
            size={19}
          />
        ) : null}
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
                        onChange({ text: result.name, choice: result }, true);
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
export function TripLocationPicker({
  state,
  options,
  draft,
  onSearch,
  onDraftChange,
  recentSearches,
  onSelectRecentSearch,
  urlError,
}: {
  state: NetworkDatasetState;
  options: readonly LocationOption[];
  draft: TripSearchDraft;
  onSearch: (draft: TripSearchDraft) => void;
  onDraftChange: (draft: TripSearchDraft) => void;
  recentSearches: readonly RecentSearch[];
  onSelectRecentSearch: (search: RecentSearch) => void;
  urlError: boolean;
}) {
  const { t } = useTranslation();
  const disabled = state.status !== 'ready';
  const swapDisabled = disabled || (!draft.origin.text && !draft.destination.text);
  const coverage = state.status === 'ready' ? state.dataset.coverage : null;
  const today = madridToday();
  const earliestDate = coverage === null ? draft.date : coverage.startDate > today ? coverage.startDate : today;
  const departureDisabled = disabled || (coverage !== null && earliestDate > coverage.endDate);
  const sameExactStop =
    draft.origin.choice?.kind === 'stop' &&
    draft.destination.choice?.kind === 'stop' &&
    draft.origin.choice.id === draft.destination.choice.id;

  /** Update edited text immediately, and search once a choice or time is committed. */
  function changeDraft(nextDraft: TripSearchDraft, committed: boolean) {
    onDraftChange(nextDraft);
    if (committed) onSearch(nextDraft);
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
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2 max-[380px]:grid-cols-[minmax(0,1fr)_2.25rem] max-[380px]:gap-1">
          <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-2 max-[380px]:gap-1.5">
            <div className="relative grid grid-rows-2 gap-2" aria-hidden="true">
              <span className="grid h-15 place-items-center">
                <span className="size-2.5 rounded-full border-2 border-accent" />
              </span>
              <span className="grid h-15 place-items-center">
                <span className="size-2.5 rounded-sm bg-accent" />
              </span>
              <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
                <span className="size-0.75 rounded-full bg-icon-muted" />
                <span className="size-0.75 rounded-full bg-icon-muted" />
                <span className="size-0.75 rounded-full bg-icon-muted" />
              </span>
            </div>
            <div className="grid min-w-0 gap-2">
              <LocationField
                disabled={disabled}
                id="origin"
                label={t('search.origin')}
                placeholder={t('search.originPlaceholder')}
                onChange={(value, committed) => {
                  changeDraft({ ...draft, origin: value }, committed);
                }}
                options={options}
                value={draft.origin}
              />
              <LocationField
                disabled={disabled}
                id="destination"
                label={t('search.destination')}
                placeholder={t('search.destinationPlaceholder')}
                onChange={(value, committed) => {
                  changeDraft({ ...draft, destination: value }, committed);
                }}
                options={options}
                value={draft.destination}
              />
            </div>
          </div>
          <AppTooltip content={t('search.swap')} disabled={swapDisabled}>
            <button
              aria-label={t('search.swap')}
              className="grid size-11 place-items-center rounded-full text-ink transition-colors enabled:hover:bg-surface-hover disabled:opacity-75 max-[380px]:size-9"
              disabled={swapDisabled}
              onClick={() => {
                changeDraft({ ...draft, origin: draft.destination, destination: draft.origin }, true);
              }}
              type="button"
            >
              <span aria-hidden="true" className="relative block h-8 w-7">
                <ArrowUp className="absolute top-0.5 left-0" size={18} strokeWidth={3.2} />
                <ArrowDown className="absolute top-3.5 left-2" size={18} strokeWidth={3.2} />
              </span>
            </button>
          </AppTooltip>
        </div>
        {recentSearches.length > 0 && (
          <div
            aria-label={t('search.recentSearches')}
            className="mt-4 grid min-w-0 gap-2 max-[380px]:gap-1.5"
            role="group"
            style={{ gridTemplateColumns: `repeat(${RECENT_SEARCH_LIMIT}, minmax(0, 1fr))` }}
          >
            {recentSearches.map((search) => {
              const route = `${search.origin.name} → ${search.destination.name}`;
              return (
                <AppTooltip
                  content={route}
                  key={`${search.origin.kind}:${search.origin.id}:${search.destination.kind}:${search.destination.id}`}
                >
                  <button
                    aria-label={t('search.repeatRecentSearch', {
                      origin: search.origin.name,
                      destination: search.destination.name,
                    })}
                    className="flex min-h-10 min-w-0 items-center gap-2 overflow-hidden rounded-full border border-line-input bg-surface-card px-3 text-left text-sm font-[650] text-ink transition-colors hover:bg-surface-hover max-[380px]:gap-1.5 max-[380px]:px-2"
                    onClick={() => onSelectRecentSearch(search)}
                    type="button"
                  >
                    <Icon name="search" className="shrink-0" size={17} />
                    <span className="min-w-0 truncate">{route}</span>
                  </button>
                </AppTooltip>
              );
            })}
          </div>
        )}
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
        {urlError && state.status === 'ready' && (
          <p className="mt-4 text-sm text-warning" role="alert">
            {t('search.invalidLink')}
          </p>
        )}
        <div className="mt-7 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              items={[
                { value: 'leave-now', label: t('search.leaveNow') },
                { value: 'depart-at', label: t('search.departAt') },
              ]}
              value={draft.departureMode}
              onValueChange={(departureMode) => {
                if (departureMode !== 'leave-now' && departureMode !== 'depart-at') return;
                const now = new Date();
                changeDraft(
                  {
                    ...draft,
                    departureMode,
                    date:
                      departureMode === 'depart-at' && (draft.departAfter === '' || draft.date < earliestDate)
                        ? earliestDate
                        : draft.date,
                    departAfter:
                      departureMode === 'depart-at' && draft.departAfter === ''
                        ? currentMadridQuarterHour(now)
                        : draft.departAfter,
                  },
                  true,
                );
              }}
            >
              <SelectTrigger
                aria-label={t('search.departureMode')}
                className="min-h-12 shrink-0 rounded-full border border-line-input bg-surface-input py-2 pr-3 pl-4 text-sm font-[650] focus:shadow-[var(--shadow-field-focus)]"
                disabled={disabled}
                id="departure-mode"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leave-now">{t('search.leaveNow')}</SelectItem>
                <SelectItem value="depart-at">{t('search.departAt')}</SelectItem>
              </SelectContent>
            </Select>
            {draft.departureMode === 'depart-at' && (
              <div className="flex w-max max-w-full shrink-0 flex-wrap items-center gap-1.5">
                <JourneyDatePill
                  value={draft.date}
                  onChange={(date) => changeDraft({ ...draft, date }, true)}
                  minimum={earliestDate}
                  maximum={coverage?.endDate ?? draft.date}
                  disabled={departureDisabled}
                />
                <JourneyTimePill
                  date={draft.date}
                  value={draft.departAfter}
                  onChange={(date, departAfter, committed) => changeDraft({ ...draft, date, departAfter }, committed)}
                  minimum={earliestDate}
                  maximum={coverage?.endDate ?? draft.date}
                  disabled={departureDisabled}
                />
              </div>
            )}
          </div>
          {coverage !== null && madridToday() > coverage.endDate && (
            <p className="mt-3 text-sm text-warning" role="alert">
              {t('search.expiredData', { date: coverage.endDate })}
            </p>
          )}
          {sameExactStop && <p className="mt-3 text-sm text-warning">{t('search.sameStop')}</p>}
        </div>
      </form>
    </section>
  );
}
