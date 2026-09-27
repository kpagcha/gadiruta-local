import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppFooter } from './components/AppFooter';
import { AppRoutes } from './components/AppRoutes';

/** Render the bilingual static application shell. */
export default function App() {
  // The resolved language is also the language announced for the whole document.
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="mx-auto flex min-h-screen w-[calc(100%-40px)] max-w-280 flex-col max-[380px]:w-[calc(100%-28px)]">
      {/* The first focusable control lets keyboard users bypass the persistent header. */}
      <a
        className="skip-link fixed top-3 left-3 z-100 rounded-lg bg-accent px-5 py-3 text-on-accent"
        href="#main-content"
        onClick={(event) => {
          // Focus the main content without adding a fragment to its shareable URL.
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {t('app.skipToContent')}
      </a>
      {/* Navigation and the selected page stay together while the footer remains shared. */}
      <AppRoutes />
      <AppFooter />
    </div>
  );
}
