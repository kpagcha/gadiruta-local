import { useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocationOptions, searchLocations, type LocationOption } from '../data/location-search.ts';
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
  const options = useMemo(
    () => (state.status === 'ready' ? createLocationOptions(places, state.dataset) : []),
    [state],
  );
  const disabled = state.status !== 'ready';

  return (
    <section
      aria-labelledby="trip-search-title"
      className="min-w-0 rounded-3xl border border-line bg-surface-card p-6 shadow-[var(--shadow-card)] max-[380px]:p-4.5 desktop:p-8"
    >
      <h2 id="trip-search-title" className="sr-only">
        {t('search.title')}
      </h2>
      <div>
        <LocationField
          disabled={disabled}
          id="origin"
          label={t('search.origin')}
          placeholder={t('search.originPlaceholder')}
          onChange={(value) => setEndpoints((current) => ({ ...current, origin: value }))}
          options={options}
          value={endpoints.origin}
        />
        <div className="flex min-h-16 items-center justify-end gap-3">
          <span className="h-px flex-1 translate-y-3.5 bg-line-subtle" aria-hidden="true" />
          <button
            aria-label={t('search.swap')}
            className="grid size-11 shrink-0 translate-y-3.5 place-items-center rounded-full border border-line bg-paper text-accent transition-colors hover:bg-surface-hover disabled:opacity-45"
            disabled={disabled || (!endpoints.origin.text && !endpoints.destination.text)}
            onClick={() => setEndpoints(({ origin, destination }) => ({ origin: destination, destination: origin }))}
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
          onChange={(value) => setEndpoints((current) => ({ ...current, destination: value }))}
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
        <p className="sr-only" id="trip-action-unavailable">
          {t('search.unavailable')}
        </p>
        <button
          aria-describedby="trip-action-unavailable"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-input bg-surface-input px-4 text-sm font-[650] disabled:opacity-80"
          disabled
          type="button"
        >
          <Icon name="clock" size={19} />
          {t('search.now')}
        </button>
        <button
          aria-describedby="trip-action-unavailable"
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-[700] text-on-accent disabled:opacity-45"
          disabled
          type="button"
        >
          <Icon name="route" size={18} />
          {t('search.findTransport')}
        </button>
      </div>
    </section>
  );
}
