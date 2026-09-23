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
  options: readonly LocationOption[];
  disabled: boolean;
  value: LocationFieldValue;
  onChange: (value: LocationFieldValue) => void;
}

/** Render a labelled search input with keyboard-accessible place and stop suggestions. */
function LocationField({ id, label, options, disabled, value, onChange }: LocationFieldProps) {
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
    <div className="relative" onBlur={handleBlur}>
      <label className="mb-2 block text-sm font-[650]" htmlFor={`${id}-search`}>
        {label}
      </label>
      <input
        ref={inputRef}
        aria-describedby="trip-search-hint"
        autoComplete="off"
        className="w-full rounded-xl border border-line-input bg-surface-input px-4 py-3 text-base text-ink placeholder:text-muted-soft focus:shadow-[var(--shadow-field-focus)] disabled:cursor-not-allowed disabled:opacity-60"
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
        placeholder={t('search.placeholder')}
        type="search"
        value={value.text}
      />
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
                        <span className="block text-xs leading-5 text-muted">
                          {t(`search.${result.kind}`)}
                          {result.kind === 'stop' && result.routeLabels.length > 0 && (
                            <>
                              {' · '}
                              {result.routeLabels.slice(0, 2).join(', ')}
                              {extraLines > 0 && ` (+${extraLines})`}
                            </>
                          )}
                        </span>
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
  const [origin, setOrigin] = useState<LocationFieldValue>({ text: '', choice: null });
  const [destination, setDestination] = useState<LocationFieldValue>({ text: '', choice: null });
  const options = useMemo(
    () => (state.status === 'ready' ? createLocationOptions(places, state.dataset) : []),
    [state],
  );
  const disabled = state.status !== 'ready';

  return (
    <section
      aria-labelledby="trip-search-title"
      className="mt-10 rounded-2xl border border-line bg-surface-card p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <h2 id="trip-search-title" className="text-xl font-[650] tracking-[-0.5px]">
        {t('search.title')}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-muted">{t('search.description')}</p>
      <div className="mt-6 grid gap-5">
        <LocationField
          disabled={disabled}
          id="origin"
          label={t('search.origin')}
          onChange={setOrigin}
          options={options}
          value={origin}
        />
        <LocationField
          disabled={disabled}
          id="destination"
          label={t('search.destination')}
          onChange={setDestination}
          options={options}
          value={destination}
        />
      </div>
      <p className="mt-4 text-xs leading-5 text-muted" id="trip-search-hint">
        {disabled ? t('search.waiting') : t('search.hint')}
      </p>
      <p className="mt-3 border-t border-line-subtle pt-3 text-xs leading-5 text-muted">{t('search.nextStep')}</p>
    </section>
  );
}
