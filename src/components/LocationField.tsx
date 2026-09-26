import { Check, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
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
  const reducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'municipalities' | 'areas'>('municipalities');
  const [pendingChoice, setPendingChoice] = useState<LocationOption | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLButtonElement>(null);
  const firstPickerChoiceRef = useRef<HTMLButtonElement>(null);
  const pickerSettledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const groups = [
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
  const selectedMunicipality = municipalities.find(
    (municipality) =>
      pendingChoice?.kind === 'place' &&
      (pendingChoice.municipalityId === municipality.id || pendingChoice.parentMunicipalityId === municipality.id),
  );
  const selectedAreaId = pendingChoice?.kind === 'place' ? (pendingChoice.localAreaId ?? 'all') : 'all';
  const selectedAreaName =
    selectedAreaId === 'all'
      ? t('search.allAreas')
      : (selectedMunicipality?.areas.find((area) => area.id === selectedAreaId)?.name ?? t('search.allAreas'));
  const displayText = pickerOpen && pendingChoice ? locationLabel(pendingChoice, t('search.allStops')) : value.text;

  /** Commit a place through the same draft path as a text suggestion. */
  function choosePlace(choice: LocationOption) {
    onChange({ text: locationLabel(choice, t('search.allStops')), choice }, true);
  }

  /** Clear this end without changing the other end. */
  function clearLocation() {
    pickerSettledRef.current = true;
    onChange({ text: '', choice: null }, false);
    setIsOpen(false);
    setPickerOpen(false);
    setExpandedGroups([]);
    inputRef.current?.focus();
  }

  /** Keep All as the default when the panel closes after a municipality was picked. */
  function finishPicker() {
    if (!pickerSettledRef.current && pendingChoice && pendingChoice.id !== value.choice?.id) {
      pickerSettledRef.current = true;
      choosePlace(pendingChoice);
    }
    setPickerOpen(false);
  }

  // Leaving the panel accepts All; Escape leaves the current field unchanged.
  useEffect(() => {
    if (!pickerOpen) return;
    /** Commit a pending place once when pointer or keyboard focus leaves the picker. */
    function handleOutside(event: PointerEvent | globalThis.FocusEvent) {
      if (fieldRef.current?.contains(event.target as Node)) return;
      if (!pickerSettledRef.current && pendingChoice && pendingChoice.id !== value.choice?.id) {
        pickerSettledRef.current = true;
        onChange({ text: locationLabel(pendingChoice, t('search.allStops')), choice: pendingChoice }, true);
      }
      setPickerOpen(false);
    }
    /** Cancel the pending choice and return keyboard focus to the trigger. */
    function handlePickerEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      pickerSettledRef.current = true;
      setPickerOpen(false);
      pinRef.current?.focus();
    }
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('focusin', handleOutside);
    document.addEventListener('keydown', handlePickerEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('focusin', handleOutside);
      document.removeEventListener('keydown', handlePickerEscape);
    };
  }, [pickerOpen, pendingChoice, value.choice, onChange, t]);

  /** Put keyboard focus on the first choice after opening or changing picker steps. */
  useEffect(() => {
    if (pickerOpen) firstPickerChoiceRef.current?.focus();
  }, [pickerOpen, pickerStep]);

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
      if (index === 0) {
        inputRef.current?.focus();
      } else {
        resultRefs.current[index - 1]?.focus();
      }
    }
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
            ref={pinRef}
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
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            id={id + '-place-picker'}
            aria-label={label + ': ' + t('search.chooseFromList')}
            className="absolute right-0 left-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line-popover bg-surface-card p-2 shadow-[var(--shadow-popover)]"
            initial={reducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            role="dialog"
          >
            <AnimatePresence mode="wait" initial={false}>
              {pickerStep === 'municipalities' ? (
                <motion.div
                  key="municipalities"
                  className="max-h-[min(22rem,65dvh)] space-y-1 overflow-y-auto"
                  initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, x: -10 }}
                  transition={{ duration: 0.1 }}
                  onAnimationComplete={() => firstPickerChoiceRef.current?.focus()}
                >
                  {municipalities.map((municipality, index) => (
                    <button
                      key={municipality.id}
                      ref={
                        municipality.id === selectedMunicipality?.id || (!selectedMunicipality && index === 0)
                          ? firstPickerChoiceRef
                          : undefined
                      }
                      className="motion-interactive flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-[650] text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                      onClick={() => {
                        if (municipality.areas.length <= 1) {
                          pickerSettledRef.current = true;
                          choosePlace(municipality.choice);
                          setPickerOpen(false);
                          pinRef.current?.focus();
                          return;
                        }
                        setPendingChoice(municipality.choice);
                        setPickerStep('areas');
                      }}
                      type="button"
                    >
                      <span>{municipality.name}</span>
                      {municipality.areas.length > 1 && (
                        <Plus aria-hidden="true" className="shrink-0 text-muted" size={16} strokeWidth={1.8} />
                      )}
                    </button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="areas"
                  initial={reducedMotion ? false : { opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, x: 10 }}
                  transition={{ duration: 0.1 }}
                  onAnimationComplete={() => firstPickerChoiceRef.current?.focus()}
                >
                  <div className="flex min-w-0 items-center gap-2 border-b border-line px-1 pb-2">
                    <button
                      className="motion-interactive min-w-0 rounded-lg bg-surface-hover px-2.5 py-2 text-left text-sm font-[700] text-ink hover:bg-surface-active focus-visible:outline-2 focus-visible:outline-accent"
                      onClick={() => setPickerStep('municipalities')}
                      type="button"
                    >
                      <span className="block truncate">{selectedMunicipality?.name}</span>
                    </button>
                    <Icon name="arrow" className="shrink-0 text-accent" size={17} />
                    <span className="min-w-0 truncate text-sm font-[700] text-accent">{selectedAreaName}</span>
                  </div>
                  <div className="max-h-[min(18rem,52dvh)] space-y-1 overflow-y-auto pt-1">
                    {selectedMunicipality &&
                      [
                        { id: 'all', name: t('search.allAreas'), choice: selectedMunicipality.choice },
                        ...selectedMunicipality.areas,
                      ].map((area) => (
                        <button
                          key={area.id}
                          ref={selectedAreaId === area.id ? firstPickerChoiceRef : undefined}
                          aria-pressed={selectedAreaId === area.id}
                          className={
                            selectedAreaId === area.id
                              ? 'motion-interactive flex min-h-8 w-full items-center justify-between gap-3 rounded-xl bg-surface-selected px-3 py-2 text-left text-sm font-[700] text-accent focus-visible:outline-2 focus-visible:outline-accent'
                              : 'motion-interactive flex min-h-8 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-[650] text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none'
                          }
                          onClick={() => {
                            pickerSettledRef.current = true;
                            choosePlace(area.choice);
                            setPickerOpen(false);
                            pinRef.current?.focus();
                          }}
                          type="button"
                        >
                          <span>{area.name}</span>
                          {selectedAreaId === area.id && <Check aria-hidden="true" className="shrink-0" size={16} />}
                        </button>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      {showResults && (
        <div
          aria-busy={isWaitingForResults}
          className="motion-popover absolute z-30 mt-2 min-h-12 w-full rounded-xl border border-line-popover bg-surface-card p-1.5 shadow-[var(--shadow-popover)]"
        >
          {!isWaitingForResults && (
            <p className="sr-only" role="status">
              {t('search.resultCount', { count: totalResults })}
            </p>
          )}
          {!isWaitingForResults && totalResults === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">{t('search.noResults')}</p>
          ) : totalResults > 0 ? (
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto" inert={isWaitingForResults}>
              {groups.map((group) => {
                const { expanded, visible, focusStart, toggleIndex } = group;
                return (
                  <div key={group.id}>
                    <p className="px-3 pt-2.5 pb-1 text-xs font-[700] tracking-wide text-muted uppercase">
                      {group.label}
                    </p>
                    <ul aria-label={group.label}>
                      {visible.map((result, choiceIndex) => {
                        const index = focusStart + choiceIndex;
                        const extraLines = result.kind === 'stop' ? result.routeLabels.length - 2 : 0;
                        return (
                          <motion.li
                            key={`${result.kind}:${result.id}`}
                            initial={expanded && choiceIndex >= 5 && !reducedMotion ? { opacity: 0, y: 5 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                          >
                            <button
                              ref={(button) => {
                                resultRefs.current[index] = button;
                              }}
                              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-hover focus-visible:bg-surface-hover"
                              onClick={() => {
                                onChange({ text: locationLabel(result, t('search.allStops')), choice: result }, true);
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
                                <span className="block text-sm font-[650]">
                                  {locationLabel(result, t('search.allStops'))}
                                </span>
                                {result.kind === 'stop' && (result.areaName || result.routeLabels.length > 0) && (
                                  <span className="block text-xs leading-5 text-muted">
                                    {result.areaName}
                                    {result.areaName && result.routeLabels.length > 0 && ' · '}
                                    {result.routeLabels.length > 0 &&
                                      `${result.routeLabels.slice(0, 2).join(', ')}${extraLines > 0 ? ` (+${extraLines})` : ''}`}
                                  </span>
                                )}
                              </span>
                            </button>
                          </motion.li>
                        );
                      })}
                      {group.choices.length > 5 && (
                        <li key={`${group.id}-toggle`}>
                          <button
                            ref={(button) => {
                              resultRefs.current[toggleIndex] = button;
                            }}
                            className="motion-interactive w-full rounded-lg px-3 py-2 text-left text-sm font-[650] text-accent hover:bg-surface-hover focus-visible:bg-surface-hover"
                            onClick={() =>
                              setExpandedGroups((current) =>
                                expanded ? current.filter((id) => id !== group.id) : [...current, group.id],
                              )
                            }
                            onKeyDown={(event) => handleResultKeyDown(event, toggleIndex)}
                            type="button"
                          >
                            {expanded
                              ? t('search.showLess')
                              : t('search.showMore', { count: group.choices.length - 5 })}
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
