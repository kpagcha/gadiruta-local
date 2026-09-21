/** Check translation keys against the English source catalogue at compile time. */
import 'i18next';
import type en from './en.json';

declare module 'i18next' {
  /** Use the bundled English catalogue as the default translation namespace. */
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
