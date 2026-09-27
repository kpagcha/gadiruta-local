/** Share browser-local development settings with pages and controls. */
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { DevSettings } from '../data/dev-settings.ts';

export type DevSettingsContextValue = {
  settings: DevSettings;
  setSettings: Dispatch<SetStateAction<DevSettings>>;
  resetSettings: () => void;
};

export const DevSettingsContext = createContext<DevSettingsContextValue | null>(null);

/** Read the active browser-local settings from any application view. */
export function useDevSettings(): DevSettingsContextValue {
  const context = useContext(DevSettingsContext);
  if (context === null) throw new Error('DevSettingsProvider is missing.');
  return context;
}
