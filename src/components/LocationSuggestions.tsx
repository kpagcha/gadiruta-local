import { motion, useReducedMotion } from 'motion/react';
import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { locationLabel, type LocationOption } from '../data/location-search.ts';
import { Icon } from './Icon';

/** One visible suggestion group with stable keyboard positions for its buttons. */
export interface SuggestionGroup {
  id: string;
  label: string;
  choices: readonly LocationOption[];
  expanded: boolean;
  visible: readonly LocationOption[];
  focusStart: number;
  toggleIndex: number;
}

/** Render grouped suggestions while preserving list navigation and the waiting announcement. */
export function LocationSuggestions({
  groups,
  totalResults,
  isWaitingForResults,
  resultRefs,
  onSelect,
  onResultKeyDown,
  onToggleGroup,
}: {
  groups: readonly SuggestionGroup[];
  totalResults: number;
  isWaitingForResults: boolean;
  resultRefs: RefObject<Array<HTMLButtonElement | null>>;
  onSelect: (choice: LocationOption) => void;
  onResultKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onToggleGroup: (id: string, expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
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
                <p className="px-3 pt-2.5 pb-1 text-xs font-[700] tracking-wide text-muted uppercase">{group.label}</p>
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
                          onClick={() => onSelect(result)}
                          onKeyDown={(event) => onResultKeyDown(event, index)}
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
                        onClick={() => onToggleGroup(group.id, expanded)}
                        onKeyDown={(event) => onResultKeyDown(event, toggleIndex)}
                        type="button"
                      >
                        {expanded ? t('search.showLess') : t('search.showMore', { count: group.choices.length - 5 })}
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
  );
}
