/** Render the global application shell and synchronize its document metadata. */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppFooter } from './components/AppFooter';
import { AppHeader } from './components/AppHeader';
import { HomePage } from './pages/HomePage';

/** Render the bilingual static application shell. */
export default function App() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('app.title');
  }, [language, t]);

  return (
    <div className="mx-auto w-[calc(100%-40px)] max-w-280 max-[380px]:w-[calc(100%-28px)]">
      <a
        className="skip-link fixed top-3 left-3 z-100 rounded-lg bg-accent px-5 py-3 text-on-accent"
        href="#main-content"
      >
        {t('app.skipToContent')}
      </a>
      <AppHeader />
      <HomePage />
      <AppFooter />
    </div>
  );
}
