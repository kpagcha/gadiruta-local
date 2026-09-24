import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DirectJourneyResults, type JourneySearchResult } from '../components/DirectJourneyResults';
import { Icon } from '../components/Icon';
import { TripLocationPicker } from '../components/TripLocationPicker';
import { findDirectJourneys } from '../data/direct-journeys.ts';
import type { LocationOption } from '../data/location-search.ts';
import { useNetworkDataset } from '../data/use-network-dataset.ts';

/** Put the search beside the introduction at first, then beside its own results card. */
export function HomePage() {
  const { t } = useTranslation();
  const networkState = useNetworkDataset();
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<JourneySearchResult | null>(null);
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
  function handleSearch(date: string, origin: LocationOption, destination: LocationOption) {
    if (networkState.status !== 'ready') return;
    const nextResult: JourneySearchResult = {
      originName: origin.name,
      destinationName: destination.name,
      journeys: findDirectJourneys(networkState.dataset, date, origin, destination),
    };

    /** Commit all related state together so the browser captures one complete new layout. */
    function showResult() {
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
        <TripLocationPicker state={networkState} onSearch={handleSearch} onDraftChange={() => setResult(null)} />
      </div>
      {hasSearched && networkState.status === 'ready' && (
        <DirectJourneyResults key={searchNumber} dataset={networkState.dataset} result={result} panelRef={resultsRef} />
      )}
    </main>
  );
}
