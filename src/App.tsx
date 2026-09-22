/** Render the global application shell and synchronize its document metadata. */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { HomePage } from './pages/HomePage';

/** Render the bilingual static application shell. */
export default function App() {
  // `t` renders catalogue entries; `i18n` exposes the language that was actually resolved.
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    // Keep browser-level metadata in step with the visible interface language and title.
    document.documentElement.lang = language;
    document.title = t('app.title');
  }, [language, t]);

  return (
    <div className="mx-auto w-[calc(100%-40px)] max-w-280 max-[380px]:w-[calc(100%-28px)]">
      {/* The first focusable control lets keyboard users bypass the persistent header. */}
      <a
        className="skip-link fixed top-3 left-3 z-100 rounded-lg bg-accent px-5 py-3 text-on-accent"
        href="#main-content"
      >
        {t('app.skipToContent')}
      </a>
      {/* The page shell owns persistent chrome; the page component owns the main content. */}
      <AppHeader />
      <HomePage />
      <AppFooter />
    </div>
  );
}
