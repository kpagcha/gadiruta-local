import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExplorePage, type ExploreView } from '../pages/ExplorePage';
import { HomePage } from '../pages/HomePage';
import { AppHeader } from './AppHeader';

/** Read the small set of shareable browse views from the URL path. */
function exploreViewFromPath(path: string): ExploreView | null {
  if (path === '/') return null;
  const parts = path.split('/').filter(Boolean);
  if (parts[0] !== 'explore') return { kind: 'missing' };
  if (parts.length === 1 || (parts[1] === 'places' && parts.length === 2)) return { kind: 'places' };
  if (parts[1] === 'lines' && parts.length === 2) return { kind: 'lines' };
  if (parts[1] === 'places' && parts.length === 4 && parts[3] === 'all') {
    try {
      const id = decodeURIComponent(parts[2]!);
      if (id !== '') return { kind: 'place', id: `${id}/all` };
    } catch {
      // A malformed shared link has the same visible treatment as an unknown item.
    }
  }
  if ((parts[1] === 'places' || parts[1] === 'lines') && parts.length === 3) {
    try {
      const id = decodeURIComponent(parts[2]!);
      if (id !== '') return { kind: parts[1] === 'places' ? 'place' : 'line', id };
    } catch {
      // A malformed shared link has the same visible treatment as an unknown item.
    }
  }
  return { kind: 'missing' };
}

/** Keep the visible page, active navigation link, and title in step with browser history. */
export function AppRoutes() {
  const { t } = useTranslation();
  const [exploreView, setExploreView] = useState<ExploreView | null>(() =>
    exploreViewFromPath(window.location.pathname),
  );
  // Only the first document visit should play Search's entrance animation.
  const [hasNavigated, setHasNavigated] = useState(false);
  const firstRoute = useRef(true);

  useEffect(() => {
    document.title = exploreView === null ? t('app.title') : `${t('explore.title')} · ${t('app.name')}`;
  }, [exploreView, t]);

  useEffect(() => {
    /** Restore the visible page when browser Back or Forward changes the path. */
    function restoreView() {
      setHasNavigated(true);
      setExploreView(exploreViewFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', restoreView);
    return () => window.removeEventListener('popstate', restoreView);
  }, []);

  useEffect(() => {
    /** Follow local page links without reloading the checked-in network asset. */
    function handlePageLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      ) {
        return;
      }
      const url = new URL(anchor.href);
      if (
        url.origin !== window.location.origin ||
        url.hash !== '' ||
        (url.pathname !== '/' && url.pathname !== '/explore' && !url.pathname.startsWith('/explore/'))
      ) {
        return;
      }
      event.preventDefault();
      const nextUrl = `${url.pathname}${url.search}`;
      if (nextUrl === `${window.location.pathname}${window.location.search}`) return;
      window.history.pushState(null, '', nextUrl);
      // Notify both the page selector and the home form's existing history listener.
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    document.addEventListener('click', handlePageLink);
    return () => document.removeEventListener('click', handlePageLink);
  }, []);

  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    document.getElementById('main-content')?.focus();
  }, [exploreView]);

  return (
    <>
      <AppHeader exploring={exploreView !== null} />
      {exploreView === null ? <HomePage animateArrival={!hasNavigated} /> : <ExplorePage view={exploreView} />}
    </>
  );
}
