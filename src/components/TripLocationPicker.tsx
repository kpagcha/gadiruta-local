import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createLocationMunicipalities,
  isSameLocationChoice,
  locationLabel,
  type LocationOption,
} from '../data/location-search.ts';
import { madridToday } from '../data/calendar-date.ts';
import { currentMadridQuarterHour } from '../data/journey-time.ts';
import type { TripSearchDraft, JourneySearch } from '../data/journey-search.ts';
import type { NetworkDatasetState } from '../hooks/use-network-dataset.ts';
import { LocationField } from './LocationField';
import { Icon } from './Icon';
import { JourneyDatePill } from './JourneyDatePill';
import { JourneyTimePill } from './JourneyTimePill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AppTooltip } from './ui/tooltip';

/** Compose the location and departure controls for a direct journey search. */
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
  recentSearches: readonly JourneySearch[];
  onSelectRecentSearch: (search: JourneySearch) => void;
  urlError: boolean;
}) {
  const { t } = useTranslation();
  const disabled = state.status !== 'ready';
  const municipalities = useMemo(
    () => (state.status === 'ready' ? createLocationMunicipalities(options, state.dataset) : []),
    [options, state],
  );
  const swapDisabled = disabled || (!draft.origin.text && !draft.destination.text);
  const coverage = state.status === 'ready' ? state.dataset.coverage : null;
  const today = madridToday();
  const earliestDate = coverage === null ? draft.date : coverage.startDate > today ? coverage.startDate : today;
  const departureDisabled = disabled || (coverage !== null && earliestDate > coverage.endDate);
  const sameLocation = isSameLocationChoice(draft.origin.choice, draft.destination.choice);

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
                invalid={sameLocation}
                label={t('search.origin')}
                placeholder={t('search.originPlaceholder')}
                municipalities={municipalities}
                onChange={(value, committed) => {
                  changeDraft({ ...draft, origin: value }, committed);
                }}
                options={options}
                value={draft.origin}
              />
              <LocationField
                disabled={disabled}
                id="destination"
                invalid={sameLocation}
                label={t('search.destination')}
                placeholder={t('search.destinationPlaceholder')}
                municipalities={municipalities}
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
              className="motion-interactive grid size-11 place-items-center rounded-full text-ink enabled:hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-muted disabled:opacity-100 max-[380px]:size-9"
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
        {sameLocation && (
          <p className="mt-3 text-sm text-warning" id="same-location-error" role="alert">
            {t('search.sameLocation')}
          </p>
        )}
        {recentSearches.length > 0 && (
          <div
            aria-label={t('search.recentSearches')}
            className="mt-3 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto max-[380px]:gap-1"
            role="group"
          >
            {recentSearches.map((search) => {
              const origin = locationLabel(search.origin, t('search.allStops'));
              const destination = locationLabel(search.destination, t('search.allStops'));
              const route = `${origin} → ${destination}`;
              return (
                <AppTooltip
                  content={route}
                  key={`${search.origin.kind}:${search.origin.id}:${search.destination.kind}:${search.destination.id}`}
                >
                  <button
                    aria-label={t('search.repeatRecentSearch', {
                      origin,
                      destination,
                    })}
                    className="motion-list-item motion-interactive flex min-h-9 max-w-48 min-w-16 flex-[0_1_auto] items-center gap-1.5 overflow-hidden rounded-full border border-line-input bg-surface-card px-2.5 text-left text-xs font-[650] text-ink hover:bg-surface-hover max-[380px]:gap-1 max-[380px]:px-2"
                    onClick={() => onSelectRecentSearch(search)}
                    type="button"
                  >
                    <Icon name="search" className="shrink-0" size={15} />
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
              <div className="motion-popover flex w-max max-w-full shrink-0 flex-wrap items-center gap-1.5">
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
          {coverage !== null && today > coverage.endDate && (
            <p className="mt-3 text-sm text-warning" role="alert">
              {t('search.expiredData', { date: coverage.endDate })}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
