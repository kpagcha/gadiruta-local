import { motion, useReducedMotion } from 'motion/react';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { splitDirectJourneys } from '../data/direct-journeys.ts';
import type { JourneySearchResult } from '../data/journey-search.ts';
import type { NetworkDataset } from '../data/network-schema.ts';
import { JourneyCard } from './JourneyCard';

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
  const reducedMotion = useReducedMotion();
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
              {visible.map(({ journey, boardingIndex, alightingIndex }, index) => (
                <motion.div
                  key={journey.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 300, damping: 35 },
                    opacity: { duration: 0.2, delay: Math.min(index, 3) * 0.035 },
                    y: { duration: 0.2, delay: Math.min(index, 3) * 0.035 },
                  }}
                >
                  <JourneyCard
                    journey={journey}
                    dataset={dataset}
                    defaultBoardingIndex={boardingIndex}
                    defaultAlightingIndex={alightingIndex}
                  />
                </motion.div>
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
