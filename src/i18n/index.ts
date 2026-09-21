/** Initialize bundled translations with an explicit preference and an English fallback. */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

/** The two interface languages supported by this application. */
export type Language = 'en' | 'es';

const STORAGE_KEY = 'gadiruta-local.language';
const resources: Record<Language, { translation: typeof en }> = {
  en: { translation: en },
  es: { translation: es },
};

/** Prefer a saved explicit choice, then the first supported browser language. */
function initialLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Storage may be blocked; browser preferences still work without persistence.
  }
  for (const locale of navigator.languages.length ? navigator.languages : [navigator.language]) {
    const language = locale.toLowerCase().split('-')[0];
    if (language === 'en' || language === 'es') return language;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  supportedLngs: ['en', 'es'],
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

/** Switch immediately and remember the choice when browser storage is available. */
export function changeLanguage(language: Language): void {
  void i18n.changeLanguage(language);
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // A denied storage write must not prevent changing the current interface language.
  }
}

export default i18n;
