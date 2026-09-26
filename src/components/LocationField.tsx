import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCATION_SEARCH_DEBOUNCE_MS } from '../config.ts';
import {
  hasMinimumLocationQuery,
  locationLabel,
  searchLocations,
  type LocationMunicipality,
  type LocationOption,
} from '../data/location-search.ts';
import type { LocationFieldValue } from '../data/journey-search.ts';
import { Icon } from './Icon';
import { LocationPlacePicker } from './LocationPlacePicker';
import { LocationSuggestions, type SuggestionGroup } from './LocationSuggestions';
import { AppTooltip } from './ui/tooltip';

/** One of the two identical search controls in the trip picker. */
interface LocationFieldProps {
  id: 'origin' | 'destination';
  label: string;
  placeholder: string;
  options: readonly LocationOption[];
  municipalities: readonly LocationMunicipality[];
  disabled: boolean;
  invalid: boolean;
  value: LocationFieldValue;
  onChange: (value: LocationFieldValue, committed: boolean) => void;
}

/** Render text suggestions and a pin-triggered place picker for one end of a journey. */
export function LocationField({
  id,
  label,
  placeholder,
  options,
  municipalities,
  disabled,
  invalid,
  value,
  onChange,
}: LocationFieldProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'municipalities' | 'areas'>('municipalities');
  const [pendingChoice, setPendingChoice] = useState<LocationOption | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerSettledRef = useRef(false);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const query = value.choice === null && isOpen && !pickerOpen ? value.text : '';
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const isWaitingForResults = query !== debouncedQuery;

  // Keep the popup mounted during the debounce; stale choices remain inert until they match the input.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), LOCATION_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const results = searchLocations(options, debouncedQuery);
  // Assign keyboard positions once, including each group's expand/collapse button.
  let visibleCount = 0;
  const groups: SuggestionGroup[] = [
    { id: 'places', label: t('search.places'), choices: results.places },
    { id: 'areas', label: t('search.areas'), choices: results.areas },
    { id: 'stops', label: t('search.stops'), choices: results.stops },
  ]
    .filter((group) => group.choices.length > 0)
    .map((group) => {
      const expanded = expandedGroups.includes(group.id);
      const visible = expanded ? group.choices : group.choices.slice(0, 5);
      const focusStart = visibleCount;
      const toggleIndex = focusStart + visible.length;
      visibleCount += visible.length + (group.choices.length > 5 ? 1 : 0);
      return { ...group, expanded, visible, focusStart, toggleIndex };
    });
  const totalResults = groups.reduce((count, group) => count + group.choices.length, 0);
  const showResults =
    !pickerOpen &&
    !disabled &&
    value.choice === null &&
    isOpen &&
    hasMinimumLocationQuery(query) &&
    hasMinimumLocationQuery(debouncedQuery);
  const displayText = pickerOpen && pendingChoice ? locationLabel(pendingChoice, t('search.allStops')) : value.text;

  /** Commit the municipality's All choice once when the picker closes normally. */
  const finishPicker = useCallback(() => {
    if (!pickerSettledRef.current && pendingChoice && pendingChoice.id !== value.choice?.id) {
      pickerSettledRef.current = true;
      onChange({ text: locationLabel(pendingChoice, t('search.allStops')), choice: pendingChoice }, true);
    }
    setPickerOpen(false);
  }, [pendingChoice, value.choice, onChange, t]);

  /** Clear this end without changing the other end. */
  function clearLocation() {
    pickerSettledRef.current = true;
    onChange({ text: '', choice: null }, false);
    setIsOpen(false);
    setPickerOpen(false);
    setExpandedGroups([]);
    inputRef.current?.focus();
  }

  /** Select a municipality directly when it has no narrower area choices. */
  function selectMunicipality(municipality: LocationMunicipality) {
    if (municipality.areas.length <= 1) {
      pickerSettledRef.current = true;
      onChange({ text: locationLabel(municipality.choice, t('search.allStops')), choice: municipality.choice }, true);
      setPickerOpen(false);
      triggerRef.current?.focus();
      return;
    }
    setPendingChoice(municipality.choice);
    setPickerStep('areas');
  }

  /** Commit one narrower area and return focus to the trigger. */
  function selectArea(choice: LocationOption) {
    pickerSettledRef.current = true;
    onChange({ text: locationLabel(choice, t('search.allStops')), choice }, true);
    setPickerOpen(false);
    triggerRef.current?.focus();
  }

  // Focus or a pointer press outside accepts a pending All choice; Escape discards it.
  useEffect(() => {
    if (!pickerOpen) return;

    /** Close only after focus or pointer input leaves the entire location field. */
    function handleOutside(event: PointerEvent | globalThis.FocusEvent) {
      if (!fieldRef.current?.contains(event.target as Node)) finishPicker();
    }

    /** Cancel the pending choice without losing keyboard position. */
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      pickerSettledRef.current = true;
      setPickerOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('focusin', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('focusin', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [pickerOpen, finishPicker]);

  /** Close suggestions only when focus leaves this field and its result buttons. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
  }

  /** Let the input's down arrow reach the first result without changing the typed query. */
  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' && showResults && !isWaitingForResults && visibleCount > 0) {
      event.preventDefault();
      resultRefs.current[0]?.focus();
    }
  }

  /** Keep result navigation within the small suggestion list and return upward to the input. */
  function handleResultKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'Escape') {
      inputRef.current?.focus();
      setIsOpen(false);
    } else if (event.key === 'ArrowDown' && index < visibleCount - 1) {
      event.preventDefault();
      resultRefs.current[index + 1]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else resultRefs.current[index - 1]?.focus();
    }
  }

  /** Commit a suggestion and return focus to the text input. */
  function selectSuggestion(choice: LocationOption) {
    onChange({ text: locationLabel(choice, t('search.allStops')), choice }, true);
    inputRef.current?.focus();
    setIsOpen(false);
  }

  /** Expand or collapse one group without changing the typed query. */
  function toggleGroup(id: string, expanded: boolean) {
    setExpandedGroups((current) => (expanded ? current.filter((groupId) => groupId !== id) : [...current, id]));
  }

  return (
    <div ref={fieldRef} className="relative min-w-0 focus-within:z-40" onBlur={handleBlur}>
      <div className="relative">
        <label className="sr-only" htmlFor={id + '-search'}>
          {label}
        </label>
        <input
          ref={inputRef}
          aria-describedby={invalid ? 'same-location-error' : undefined}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className={`motion-field h-15 w-full min-w-0 rounded-xl border border-line-input bg-surface-card pl-9 text-[17px] text-ink placeholder:text-muted-soft focus:shadow-[var(--shadow-field-focus)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 max-[380px]:text-base ${displayText ? 'pr-12' : 'pr-4'}`}
          disabled={disabled}
          id={id + '-search'}
          onChange={(event) => {
            const text = event.target.value;
            onChange({ text, choice: null }, false);
            setPickerOpen(false);
            if (!hasMinimumLocationQuery(text)) setDebouncedQuery('');
            setIsOpen(true);
            setExpandedGroups([]);
          }}
          onBlur={() => setIsInputFocused(false)}
          onFocus={() => {
            if (pickerOpen) finishPicker();
            setIsInputFocused(true);
            if (value.choice === null && hasMinimumLocationQuery(value.text)) setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder={isInputFocused ? placeholder : ''}
          role="searchbox"
          type="text"
          value={displayText}
        />
        {!isInputFocused && displayText === '' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 text-[17px] font-[700] text-accent max-[380px]:text-base"
          >
            {label}
          </span>
        )}
        {displayText !== '' && !disabled && (
          <button
            aria-label={t(id === 'origin' ? 'search.clearOrigin' : 'search.clearDestination')}
            className="motion-interactive absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-muted hover:text-ink"
            onClick={clearLocation}
            title={t(id === 'origin' ? 'search.clearOrigin' : 'search.clearDestination')}
            type="button"
          >
            <Icon name="close" size={17} />
          </button>
        )}
        <AppTooltip content={t('search.chooseFromList')} disabled={disabled || pickerOpen}>
          <button
            ref={triggerRef}
            aria-controls={id + '-place-picker'}
            aria-expanded={pickerOpen}
            aria-label={label + ': ' + t('search.chooseFromList')}
            className="motion-interactive absolute top-1/2 left-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => {
              setIsOpen(false);
              if (pickerOpen) {
                finishPicker();
              } else {
                pickerSettledRef.current = false;
                setPendingChoice(value.choice?.kind === 'place' ? value.choice : null);
                setPickerStep(value.choice?.kind === 'place' ? 'areas' : 'municipalities');
                setPickerOpen(true);
              }
            }}
            type="button"
          >
            <Icon
              name="chevronDown"
              className={
                pickerOpen
                  ? 'rotate-180 motion-safe:transition-transform motion-safe:duration-150'
                  : 'motion-safe:transition-transform motion-safe:duration-150'
              }
              size={17}
            />
          </button>
        </AppTooltip>
      </div>
      <LocationPlacePicker
        id={id}
        label={label}
        municipalities={municipalities}
        isOpen={pickerOpen}
        step={pickerStep}
        pendingChoice={pendingChoice}
        onSelectMunicipality={selectMunicipality}
        onSelectArea={selectArea}
        onBack={() => setPickerStep('municipalities')}
      />
      {showResults && (
        <LocationSuggestions
          groups={groups}
          totalResults={totalResults}
          isWaitingForResults={isWaitingForResults}
          resultRefs={resultRefs}
          onSelect={selectSuggestion}
          onResultKeyDown={handleResultKeyDown}
          onToggleGroup={toggleGroup}
        />
      )}
    </div>
  );
}
