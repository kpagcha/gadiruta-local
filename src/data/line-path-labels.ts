/**
 * Looks up reviewed names for exact line paths in the checked-in CTAN catalogue.
 * The browser bundles this small file; paths added by a later data refresh use generated names
 * until someone reviews them.
 */
import catalog from '../../data/reviewed/ctan/line-path-labels.json' with { type: 'json' };
import type { NetworkRoute } from './network-schema.ts';

type PathLabels = { en: string; es: string };
const lines: Record<string, Record<string, PathLabels>> = catalog.lines;

/** Find a reviewed path name using the public line label and its existing shareable path alias. */
export function reviewedLinePathLabel(route: NetworkRoute, pathAlias: string, language: string): string | undefined {
  const labels = route.shortName === null ? undefined : lines[route.shortName]?.[pathAlias];
  return language.toLowerCase().startsWith('es') ? labels?.es : labels?.en;
}
