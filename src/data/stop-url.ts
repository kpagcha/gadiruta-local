/** Makes readable stop values for shared searches while keeping source IDs out of new links. */
import { urlAlias } from './url-alias.ts';

/** Put the readable name before the token used to identify an exact stop. */
export function stopUrlValue(stop: { id: string; name: string }): string {
  return urlAlias(stop.id, stop.name, 'stop');
}
