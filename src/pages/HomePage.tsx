import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DirectJourneyResults, type JourneySearchResult } from '../components/DirectJourneyResults';
import { Icon } from '../components/Icon';
import { TripLocationPicker, type TripSearchDraft } from '../components/TripLocationPicker';
import { isCalendarDate } from '../data/calendar-date.ts';
import { findDirectJourneys, madridToday } from '../data/direct-journeys.ts';
import { currentMadridTime, normalizeJourneyTime } from '../data/journey-time.ts';
import { createLocationOptions, type LocationOption } from '../data/location-search.ts';
import type { NetworkDataset } from '../data/network-schema.ts';
import { places } from '../data/places.ts';
import { resolveSearchUrl, searchQuery } from '../data/search-url.ts';
import { useNetworkDataset, type NetworkDatasetState } from '../data/use-network-dataset.ts';

/** Search the checked-in timetable and retain the cutoff needed by the result card. */
function localSearch(
  dataset: NetworkDataset,
  date: string,
  origin: LocationOption,
  destination: LocationOption,
  departAfter: string,
): JourneySearchResult {
  return {
    departAfter,
    journeys: findDirectJourneys(dataset, date, origin, destination),
  };
}

/** Remount search state only when the network loads or browser history selects another URL. */
export function HomePage() {
  const networkState = useNetworkDataset();
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    /** Restore the URL's submitted criteria when browser Back or Forward is used. */
    function restoreHistorySearch() {
      setHistoryVersion((version) => version + 1);
    }
    window.addEventListener('popstate', restoreHistorySearch);
    return () => window.removeEventListener('popstate', restoreHistorySearch);
  }, []);

  return <SearchContent key={`${networkState.status}:${historyVersion}`} networkState={networkState} />;
}

/** Put the search beside the introduction at first, then beside its own results card. */
function SearchContent({ networkState }: { networkState: NetworkDatasetState }) {
  const { t } = useTranslation();
  const restoredNow = new Date();
  const options = useMemo(
    () => (networkState.status === 'ready' ? createLocationOptions(places, networkState.dataset) : []),
    [networkState],
  );
  // This component remounts after data loading or history navigation, so URL values seed state once.
  const restored =
    networkState.status === 'ready'
      ? resolveSearchUrl(window.location.search, options, networkState.dataset.coverage, madridToday(restoredNow))
      : null;
  const [draft, setDraft] = useState<TripSearchDraft>(() => ({
    origin: { text: restored?.origin?.name ?? '', choice: restored?.origin ?? null },
    destination: { text: restored?.destination?.name ?? '', choice: restored?.destination ?? null },
    date: restored?.date ?? madridToday(),
    departAfter: restored?.departAfter ?? '',
    departureMode: restored?.departureMode ?? 'leave-now',
  }));
  const [urlError, setUrlError] = useState(restored?.invalid ?? false);
  const [hasSearched, setHasSearched] = useState(restored?.complete ?? false);
  const [result, setResult] = useState<JourneySearchResult | null>(() =>
    restored?.complete && restored.origin !== null && restored.destination !== null && networkState.status === 'ready'
      ? localSearch(
          networkState.dataset,
          restored.departureMode === 'leave-now' ? madridToday(restoredNow) : restored.date,
          restored.origin,
          restored.destination,
          restored.departureMode === 'leave-now' ? currentMadridTime(restoredNow) : restored.departAfter,
        )
      : null,
  );
  const [searchNumber, setSearchNumber] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchSequence = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    return () => {
      searchSequence.current += 1;
    };
  }, []);

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

  /** Search after a committed change or form submit, allowing one paint for loading feedback. */
  function handleSearch(nextDraft: TripSearchDraft) {
    const origin = nextDraft.origin.choice;
    const destination = nextDraft.destination.choice;
    if (networkState.status !== 'ready' || origin === null || destination === null) return;
    const now = new Date();
    const date = nextDraft.departureMode === 'leave-now' ? madridToday(now) : nextDraft.date;
    const { startDate, endDate } = networkState.dataset.coverage;
    if (!isCalendarDate(date) || date < startDate || date > endDate) return;
    if (origin.kind === 'stop' && destination.kind === 'stop' && origin.id === destination.id) return;

    const departAfter =
      nextDraft.departureMode === 'leave-now' ? currentMadridTime(now) : normalizeJourneyTime(nextDraft.departAfter);
    const sequence = ++searchSequence.current;
    setIsSearching(true);

    // Two animation frames let the busy button paint before the local calculation begins.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (sequence !== searchSequence.current) return;
        const nextResult = localSearch(networkState.dataset, date, origin, destination, departAfter);
        const query = searchQuery(origin, destination, nextDraft.departureMode, date, departAfter);
        if (query !== window.location.search) {
          window.history.pushState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
        }
        setUrlError(false);

        /** Commit all related state together so the first layout transition has complete results. */
        function showResult() {
          setDraft({
            ...nextDraft,
            departAfter: nextDraft.departureMode === 'depart-at' ? departAfter : nextDraft.departAfter,
          });
          setResult(nextResult);
          setHasSearched(true);
          setSearchNumber((number) => number + 1);
          setIsSearching(false);
        }

        const canAnimate =
          !hasSearched &&
          typeof document.startViewTransition === 'function' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (canAnimate) {
          const transition = document.startViewTransition(() => flushSync(showResult));
          void transition.finished.then(revealResults);
        } else {
          showResult();
          if (!hasSearched) revealResults();
        }
      });
    });
  }

  /** Keep current results while editing time, but clear them when a location is unresolved. */
  function handleDraftChange(nextDraft: TripSearchDraft) {
    searchSequence.current += 1;
    setIsSearching(false);
    setDraft(nextDraft);
    if (
      nextDraft.origin.choice === null ||
      nextDraft.destination.choice === null ||
      (nextDraft.origin.choice.kind === 'stop' &&
        nextDraft.destination.choice.kind === 'stop' &&
        nextDraft.origin.choice.id === nextDraft.destination.choice.id)
    )
      setResult(null);
    setUrlError(false);
  }

  return (
    <main
      id="main-content"
      className={`grid flex-1 gap-8 pt-4 pb-12 desktop:items-start desktop:py-20 ${
        hasSearched
          ? 'desktop:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] desktop:gap-8'
          : 'desktop:grid-cols-[1fr_1.12fr] desktop:gap-16'
      }`}
      tabIndex={-1}
    >
      {/* Keep a real page heading for assistive technology without pushing search below the mobile fold. */}
      <section className={hasSearched ? 'sr-only' : 'home-intro-transition sr-only desktop:not-sr-only desktop:pt-8'}>
        <p className="mb-5 text-xs font-[650] tracking-[1.8px] text-accent uppercase">{t('hero.eyebrow')}</p>
        <h1 className="text-[clamp(44px,7vw,76px)] leading-[1.05] font-[650] tracking-[-2.8px] whitespace-pre-line">
          {t('hero.title')}
        </h1>
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
      </section>

      <div className="journey-search-transition min-w-0">
        <TripLocationPicker
          state={networkState}
          options={options}
          draft={draft}
          isSearching={isSearching}
          onSearch={handleSearch}
          onDraftChange={handleDraftChange}
          urlError={urlError}
        />
      </div>
      {hasSearched && networkState.status === 'ready' && (
        <DirectJourneyResults key={searchNumber} dataset={networkState.dataset} result={result} panelRef={resultsRef} />
      )}
    </main>
  );
}
