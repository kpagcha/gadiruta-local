import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { locationLabel } from '../data/location-search.ts';
import type { JourneySearch } from '../data/journey-search.ts';
import { Icon } from './Icon';
import { AppTooltip } from './ui/tooltip';

/** Show recent routes at their natural width, with controls when the row overflows. */
export function RecentSearches({
  searches,
  onSelect,
}: {
  searches: readonly JourneySearch[];
  onSelect: (search: JourneySearch) => void;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ previous: false, next: false });

  /** Keep the arrow and fade cues in sync with scrolling and layout changes. */
  function updateScrollEdges() {
    const list = listRef.current;
    if (list === null) return;
    const previous = list.scrollLeft > 1;
    const next = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setCanScroll((current) => (current.previous === previous && current.next === next ? current : { previous, next }));
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    // A submitted route is prepended; always reveal it instead of retaining the old scroll offset.
    list.scrollLeft = 0;
    updateScrollEdges();
    const observer = new ResizeObserver(updateScrollEdges);
    observer.observe(list);
    // A changed recent-search count can change the content width without resizing the viewport.
    for (const child of list.children) observer.observe(child);
    return () => observer.disconnect();
  }, [searches]);

  /** Move one visible row width, respecting reduced-motion preferences. */
  function scrollPage(direction: -1 | 1) {
    const list = listRef.current;
    if (list === null) return;
    list.scrollBy({
      left: direction * list.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  if (searches.length === 0) return null;

  const routes = searches.map((search) => {
    const origin = locationLabel(search.origin, t('search.allStops'));
    const destination = locationLabel(search.destination, t('search.allStops'));
    return { search, origin, destination, label: `${origin} → ${destination}` };
  });
  return (
    <div className="relative mt-3 min-w-0">
      <div
        ref={listRef}
        aria-label={t('search.recentSearches')}
        className="recent-searches-scroll flex min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain [overflow-anchor:none]"
        onScroll={updateScrollEdges}
        role="group"
      >
        {routes.map(({ search, origin, destination, label }) => (
          <AppTooltip
            content={label}
            key={`${search.origin.kind}:${search.origin.id}:${search.destination.kind}:${search.destination.id}`}
          >
            <button
              aria-label={t('search.repeatRecentSearch', { origin, destination })}
              className="recent-search-chip motion-interactive flex min-h-9 snap-start items-center gap-1.5 overflow-hidden rounded-full border border-line-input bg-surface-card px-2.5 text-left text-xs font-[650] text-ink hover:bg-surface-hover max-[380px]:gap-1 max-[380px]:px-2"
              onClick={() => onSelect(search)}
              type="button"
            >
              <Icon name="search" className="shrink-0" size={15} />
              <span className="min-w-0 truncate">{label}</span>
            </button>
          </AppTooltip>
        ))}
      </div>
      {canScroll.previous && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-surface-card to-transparent"
          />
          <button
            aria-label={t('search.scrollRecentPrevious')}
            className="motion-interactive absolute top-1/2 left-0 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface-card text-accent shadow-sm hover:bg-surface-hover"
            onClick={() => scrollPage(-1)}
            type="button"
          >
            <Icon name="chevronLeft" size={15} />
          </button>
        </>
      )}
      {canScroll.next && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-surface-card to-transparent"
          />
          <button
            aria-label={t('search.scrollRecentNext')}
            className="motion-interactive absolute top-1/2 right-0 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-surface-card text-accent shadow-sm hover:bg-surface-hover"
            onClick={() => scrollPage(1)}
            type="button"
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </>
      )}
    </div>
  );
}
