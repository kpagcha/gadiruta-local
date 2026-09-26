import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { DirectJourneyResults } from '../components/DirectJourneyResults';
import { Icon } from '../components/Icon';
import { TripLocationPicker } from '../components/TripLocationPicker';
import { madridToday } from '../data/calendar-date.ts';
import {
  submitJourneySearch,
  type TripSearchDraft,
  type JourneySearchResult,
  type JourneySearch,
} from '../data/journey-search.ts';
import { createLocationOptions, isSameLocationChoice, locationLabel } from '../data/location-search.ts';
import { places } from '../data/places.ts';
import { loadRecentSearches, persistRecentSearches, prependRecentSearch } from '../data/recent-searches.ts';
import { resolveSearchUrl } from '../data/search-url.ts';
import { useNetworkDataset, type NetworkDatasetState } from '../hooks/use-network-dataset.ts';

/** Remount search state only when the network loads or browser history selects another URL. */
export function HomePage() {
  const networkState = useNetworkDataset();
  const [historyVersion, setHistoryVersion] = useState(0);
  const [initialNetworkStatus] = useState(networkState.status);

  useEffect(() => {
    /** Restore the URL's submitted criteria when browser Back or Forward is used. */
    function restoreHistorySearch() {
      setHistoryVersion((version) => version + 1);
    }
    window.addEventListener('popstate', restoreHistorySearch);
    return () => window.removeEventListener('popstate', restoreHistorySearch);
  }, []);

  return (
    <SearchContent
      key={`${networkState.status}:${historyVersion}`}
      networkState={networkState}
      animateArrival={networkState.status === initialNetworkStatus && historyVersion === 0}
    />
  );
}

/** Put the search beside the introduction at first, then beside its own results card. */
function SearchContent({
  networkState,
  animateArrival,
}: {
  networkState: NetworkDatasetState;
  animateArrival: boolean;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [restoredNow] = useState(() => new Date());
  const options = useMemo(
    () => (networkState.status === 'ready' ? createLocationOptions(places, networkState.dataset) : []),
    [networkState],
  );
  // This component remounts after data loading or history navigation, so URL values seed state once.
  const restored = useMemo(
    () =>
      networkState.status === 'ready'
        ? resolveSearchUrl(window.location.search, options, networkState.dataset.coverage, madridToday(restoredNow))
        : null,
    [networkState, options, restoredNow],
  );
  const [draft, setDraft] = useState<TripSearchDraft>(() => ({
    origin: {
      text: restored?.origin ? locationLabel(restored.origin, t('search.allStops')) : '',
      choice: restored?.origin ?? null,
    },
    destination: {
      text: restored?.destination ? locationLabel(restored.destination, t('search.allStops')) : '',
      choice: restored?.destination ?? null,
    },
    date: restored?.date ?? madridToday(),
    departAfter: restored?.departAfter ?? '',
    departureMode: restored?.departureMode ?? 'leave-now',
  }));
  const [urlError, setUrlError] = useState(restored?.invalid ?? false);
  const [hasSearched, setHasSearched] = useState(restored?.complete ?? false);
  const [result, setResult] = useState<JourneySearchResult | null>(() =>
    restored?.complete && networkState.status === 'ready'
      ? (submitJourneySearch(networkState.dataset, draft, restoredNow)?.result ?? null)
      : null,
  );
  const [searchNumber, setSearchNumber] = useState(0);
  const [recentSearches, setRecentSearches] = useState<JourneySearch[]>(() => {
    if (networkState.status !== 'ready') return [];
    const saved = loadRecentSearches(options, networkState.dataset.coverage, madridToday(restoredNow));
    // A valid link already ran a search while restoring the page, so it belongs in recent history.
    if (restored?.complete && restored.origin !== null && restored.destination !== null) {
      return prependRecentSearch(saved, {
        origin: restored.origin,
        destination: restored.destination,
        departureMode: restored.departureMode,
        date: restored.date,
        departAfter: restored.departAfter,
      });
    }
    return saved;
  });
  const resultsRef = useRef<HTMLElement>(null);
  const revealAfterEntrance = useRef(false);

  useEffect(() => {
    if (networkState.status === 'ready') persistRecentSearches(recentSearches);
  }, [networkState.status, recentSearches]);

  /** Bring the first results card into view when it is below the viewport. */
  function revealResults() {
    requestAnimationFrame(() => {
      const panel = resultsRef.current;
      if (panel === null) return;
      const { top, bottom } = panel.getBoundingClientRect();
      if (top < 0 || top + 72 > window.innerHeight || bottom <= 0) {
        panel.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    });
  }

  /** Search immediately after a committed location, departure mode, date, or time change. */
  function handleSearch(nextDraft: TripSearchDraft) {
    if (networkState.status !== 'ready') return;
    const submitted = submitJourneySearch(networkState.dataset, nextDraft, new Date());
    if (submitted === null) return;
    const { query, search, result: nextResult } = submitted;
    if (query !== window.location.search) {
      window.history.pushState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
    }
    setUrlError(false);

    // Commit the draft and result together before revealing the panel.
    setDraft({
      ...nextDraft,
      departAfter: nextDraft.departureMode === 'depart-at' ? search.departAfter : nextDraft.departAfter,
    });
    setResult(nextResult);
    setHasSearched(true);
    setSearchNumber((number) => number + 1);
    setRecentSearches((current) => prependRecentSearch(current, search));

    // Only a fresh search waits for the results card entrance before scrolling to it.
    revealAfterEntrance.current = !hasSearched && !reducedMotion;
    if (!hasSearched && reducedMotion) revealResults();
  }

  /** Apply a recent route through the same validation and URL update as a new search. */
  function handleRecentSearch(search: JourneySearch) {
    const today = madridToday();
    const departureMode =
      search.departureMode === 'depart-at' && search.date < today ? 'leave-now' : search.departureMode;
    handleSearch({
      origin: { text: locationLabel(search.origin, t('search.allStops')), choice: search.origin },
      destination: { text: locationLabel(search.destination, t('search.allStops')), choice: search.destination },
      departureMode,
      date: departureMode === 'leave-now' ? today : search.date,
      departAfter: departureMode === 'leave-now' ? '' : search.departAfter,
    });
  }

  /** Keep current results while editing time, but clear them when a location is unresolved. */
  function handleDraftChange(nextDraft: TripSearchDraft) {
    setDraft(nextDraft);
    if (
      nextDraft.origin.choice === null ||
      nextDraft.destination.choice === null ||
      isSameLocationChoice(nextDraft.origin.choice, nextDraft.destination.choice)
    )
      setResult(null);
    setUrlError(false);
  }

  const displayedDraft: TripSearchDraft = {
    ...draft,
    origin: draft.origin.choice
      ? { ...draft.origin, text: locationLabel(draft.origin.choice, t('search.allStops')) }
      : draft.origin,
    destination: draft.destination.choice
      ? { ...draft.destination, text: locationLabel(draft.destination.choice, t('search.allStops')) }
      : draft.destination,
  };

  return (
    <main
      id="main-content"
      className={`relative grid flex-1 gap-8 pt-4 pb-12 desktop:items-start desktop:py-20 ${
        hasSearched
          ? 'desktop:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] desktop:gap-8'
          : 'desktop:grid-cols-[1fr_1.12fr] desktop:gap-16'
      }`}
      tabIndex={-1}
    >
      {/* The heading stays available after the visible introduction leaves. */}
      <h1 className="sr-only">{t('hero.title')}</h1>
      <AnimatePresence mode="popLayout">
        {!hasSearched && (
          <motion.section
            key="intro"
            className="sr-only desktop:not-sr-only desktop:pt-8"
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p className="mb-5 text-xs font-[650] tracking-[1.8px] text-accent uppercase">{t('hero.eyebrow')}</p>
            <p
              aria-hidden="true"
              className="text-[clamp(44px,7vw,76px)] leading-[1.05] font-[650] tracking-[-2.8px] whitespace-pre-line"
            >
              {t('hero.title')}
            </p>
            <p className="mt-6 max-w-92.5 text-[17px] leading-[1.65] text-muted">{t('hero.description')}</p>
            <p className="mt-8.5 flex items-center gap-3 text-[13px] text-muted">
              <span
                className="grid size-9 place-items-center rounded-full border border-line-brand text-accent"
                aria-hidden="true"
              >
                <Icon name="gadiruta" size={21} />
              </span>
              {t('hero.footnote')}
            </p>
          </motion.section>
        )}

        <motion.div
          key="search"
          className="relative z-1 min-w-0"
          layout={!reducedMotion}
          initial={animateArrival && !reducedMotion ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            layout: { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 },
            opacity: { duration: 0.24, delay: animateArrival ? 0.04 : 0 },
            y: { duration: 0.24, delay: animateArrival ? 0.04 : 0 },
          }}
        >
          <motion.div layout={!reducedMotion}>
            <TripLocationPicker
              state={networkState}
              options={options}
              draft={displayedDraft}
              onSearch={handleSearch}
              onDraftChange={handleDraftChange}
              recentSearches={recentSearches}
              onSelectRecentSearch={handleRecentSearch}
              urlError={urlError}
            />
          </motion.div>
        </motion.div>
        {hasSearched && networkState.status === 'ready' && (
          <motion.div
            key="results"
            className="min-w-0"
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              y: { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 },
              opacity: { duration: 0.26, delay: 0.08 },
            }}
            onAnimationComplete={() => {
              if (!revealAfterEntrance.current) return;
              revealAfterEntrance.current = false;
              revealResults();
            }}
          >
            <motion.div
              key={searchNumber}
              initial={searchNumber > 1 && !reducedMotion ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DirectJourneyResults dataset={networkState.dataset} result={result} panelRef={resultsRef} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
