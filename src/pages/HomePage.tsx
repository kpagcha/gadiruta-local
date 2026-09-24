import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DirectJourneyResults, type JourneySearchResult } from '../components/DirectJourneyResults';
import { Icon } from '../components/Icon';
import { TripLocationPicker, type TripSearchDraft } from '../components/TripLocationPicker';
import { findDirectJourneys, madridToday } from '../data/direct-journeys.ts';
import { normalizeJourneyTime } from '../data/journey-time.ts';
import { createLocationOptions, type LocationOption } from '../data/location-search.ts';
import type { NetworkDataset } from '../data/network-schema.ts';
import { places } from '../data/places.ts';
import { resolveSearchUrl, searchQuery } from '../data/search-url.ts';
import { useNetworkDataset, type NetworkDatasetState } from '../data/use-network-dataset.ts';

/** Search the checked-in timetable and retain the criteria needed by the result card. */
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
  const options = useMemo(
    () => (networkState.status === 'ready' ? createLocationOptions(places, networkState.dataset) : []),
    [networkState],
  );
  // This component remounts after data loading or history navigation, so URL values seed state once.
  const restored =
    networkState.status === 'ready'
      ? resolveSearchUrl(window.location.search, options, networkState.dataset.coverage, madridToday())
      : null;
  const [draft, setDraft] = useState<TripSearchDraft>(() => ({
    origin: { text: restored?.origin?.name ?? '', choice: restored?.origin ?? null },
    destination: { text: restored?.destination?.name ?? '', choice: restored?.destination ?? null },
    date: restored?.date ?? madridToday(),
    departAfter: restored?.departAfter ?? '',
  }));
  const [urlError, setUrlError] = useState(restored?.invalid ?? false);
  const [hasSearched, setHasSearched] = useState(restored?.complete ?? false);
  const [result, setResult] = useState<JourneySearchResult | null>(() =>
    restored?.complete && restored.origin !== null && restored.destination !== null && networkState.status === 'ready'
      ? localSearch(networkState.dataset, restored.date, restored.origin, restored.destination, restored.departAfter)
      : null,
  );
  const [searchNumber, setSearchNumber] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);

  /** Bring the results heading into view when the newly submitted card is below the viewport. */
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

  /** Search local data and animate the first switch from introduction to results when supported. */
  function handleSearch() {
    if (networkState.status !== 'ready' || draft.origin.choice === null || draft.destination.choice === null) return;
    const departAfter = normalizeJourneyTime(draft.departAfter);
    const nextResult = localSearch(
      networkState.dataset,
      draft.date,
      draft.origin.choice,
      draft.destination.choice,
      departAfter,
    );
    const query = searchQuery(draft.origin.choice, draft.destination.choice, draft.date, departAfter);
    if (query !== window.location.search) {
      window.history.pushState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
    }
    setUrlError(false);

    /** Commit all related state together so the browser captures one complete new layout. */
    function showResult() {
      if (departAfter !== draft.departAfter) setDraft({ ...draft, departAfter });
      setResult(nextResult);
      setHasSearched(true);
      setSearchNumber((number) => number + 1);
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
      revealResults();
    }
  }

  /** Keep both cards after an edit while asking for another deliberate submission. */
  function handleDraftChange(nextDraft: TripSearchDraft) {
    setDraft(nextDraft);
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
