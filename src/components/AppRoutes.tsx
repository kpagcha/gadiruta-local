import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExplorePage, type ExploreView } from '../pages/ExplorePage';
import { HomePage } from '../pages/HomePage';
import { AppHeader } from './AppHeader';
import { PageSkeleton } from './PageSkeleton';

const DevSettingsPage = import.meta.env.DEV ? lazy(() => import('../pages/DevSettingsPage')) : null;

type AppView = { kind: 'search' } | { kind: 'settings' } | { kind: 'explore'; view: ExploreView };

/** Read the small set of shareable browse views from the URL path. */
function exploreViewFromPath(path: string): ExploreView {
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

/** Keep the developer page out of production while routing all other paths normally. */
function appViewFromPath(path: string): AppView {
  if (path === '/') return { kind: 'search' };
  if (import.meta.env.DEV && path === '/dev/settings') return { kind: 'settings' };
  return { kind: 'explore', view: exploreViewFromPath(path) };
}

/** Keep the visible page, active navigation link, and title in step with browser history. */
export function AppRoutes() {
  const { t } = useTranslation();
  const [appView, setAppView] = useState<AppView>(() => appViewFromPath(window.location.pathname));
  // Only the first document visit should play Search's entrance animation.
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    document.title =
      appView.kind === 'search'
        ? t('app.title')
        : `${t(appView.kind === 'settings' ? 'devSettings.title' : 'explore.title')} · ${t('app.name')}`;
  }, [appView, t]);

  useEffect(() => {
    /** Restore the visible page when browser Back or Forward changes the path. */
    function restoreView() {
      setHasNavigated(true);
      setAppView(appViewFromPath(window.location.pathname));
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
        (url.pathname !== '/' &&
          url.pathname !== '/explore' &&
          !url.pathname.startsWith('/explore/') &&
          !(import.meta.env.DEV && url.pathname === '/dev/settings'))
      ) {
        return;
      }
      event.preventDefault();
      const nextUrl = `${url.pathname}${url.search}`;
      if (nextUrl === `${window.location.pathname}${window.location.search}`) return;
      const currentView = appViewFromPath(window.location.pathname);
      const nextView = appViewFromPath(url.pathname);
      const fromDirectory =
        currentView.kind === 'explore' && (currentView.view.kind === 'places' || currentView.view.kind === 'lines');
      const opensDetail =
        nextView.kind === 'explore' && (nextView.view.kind === 'place' || nextView.view.kind === 'line');
      window.history.pushState(null, '', nextUrl);
      // A directory link should open its detail at the top, as a normal page visit would.
      if (fromDirectory && opensDetail) window.scrollTo(0, 0);
      // Notify both the page selector and the home form's existing history listener.
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    document.addEventListener('click', handlePageLink);
    return () => document.removeEventListener('click', handlePageLink);
  }, []);

  useEffect(() => {
    // Strict Mode replays mount effects in development; only a real navigation moves focus.
    if (!hasNavigated || appView.kind === 'settings') return;
    document.getElementById('main-content')?.focus({ preventScroll: true });
  }, [appView, hasNavigated]);

  return (
    <>
      <AppHeader activePage={appView.kind === 'settings' ? null : appView.kind === 'search' ? 'search' : 'explore'} />
      {appView.kind === 'search' ? (
        <HomePage animateArrival={!hasNavigated} />
      ) : appView.kind === 'settings' ? (
        DevSettingsPage === null ? null : (
          <Suspense
            fallback={
              <main id="main-content" className="flex-1 pt-8 pb-12 focus:outline-none" tabIndex={-1}>
                <PageSkeleton variant="settings" label={t('devSettings.loading')} />
              </main>
            }
          >
            <DevSettingsPage focusOnLoad={hasNavigated} />
          </Suspense>
        )
      ) : (
        <ExplorePage view={appView.view} />
      )}
    </>
  );
}
