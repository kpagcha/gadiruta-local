/** Check that the bilingual line path catalogue still matches the reviewed network snapshot. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import catalog from '../../../data/reviewed/ctan/line-path-labels.json' with { type: 'json' };
import { reviewedLinePathLabel } from '../../../src/data/line-path-labels.ts';
import { linePathAlias } from '../../../src/data/line-timetable.ts';
import { lineStopPatterns, stopLocality } from '../../../src/data/network-browse.ts';
import type { NetworkDataset, NetworkStop } from '../../../src/data/network-schema.ts';

const snapshot = JSON.parse(readFileSync('public/data/bahia-cadiz-network.json', 'utf8')) as NetworkDataset;

/** Compare path ends using the locality names that appear in the line picker. */
function locality(stop: NetworkStop): string {
  return stopLocality(snapshot, stop) ?? stop.name;
}

test('reviewed path labels cover every line beyond a simple outward and return pair', () => {
  const affectedLines = new Set<string>();
  for (const route of snapshot.routes) {
    const patterns = lineStopPatterns(snapshot, route.id);
    if (patterns.length === 0) continue;
    const reciprocal =
      patterns.length === 2 &&
      locality(patterns[0]!.stops[0]!) === locality(patterns[1]!.stops.at(-1)!) &&
      locality(patterns[0]!.stops.at(-1)!) === locality(patterns[1]!.stops[0]!);
    if (reciprocal) continue;
    assert.ok(route.shortName, `Line ${route.id} needs a public label for the catalogue.`);
    affectedLines.add(route.shortName);

    const aliases = patterns.map((pattern) => linePathAlias(snapshot, pattern, patterns));
    const labels = catalog.lines[route.shortName as keyof typeof catalog.lines];
    assert.ok(labels, `Missing path labels for ${route.shortName}.`);
    assert.deepEqual(Object.keys(labels).sort(), aliases.sort(), route.shortName);
    for (const language of ['en', 'es'] as const) {
      const names = aliases.map((alias) => reviewedLinePathLabel(route, alias, language));
      assert.ok(
        names.every((name) => typeof name === 'string' && name.length > 0),
        route.shortName,
      );
      assert.equal(new Set(names).size, names.length, `Repeated ${language} label on ${route.shortName}.`);
    }
  }
  assert.deepEqual(Object.keys(catalog.lines).sort(), [...affectedLines].sort());
});

test('reviewed names follow the selected language and leave unknown paths to the generated fallback', () => {
  const route = snapshot.routes.find((item) => item.shortName === 'M-960')!;
  assert.equal(
    reviewedLinePathLabel(route, 'cadiz-to-chipiona-26-stops', 'en'),
    'Cádiz → Chipiona, via Centro P. Puerto',
  );
  assert.equal(
    reviewedLinePathLabel(route, 'cadiz-to-chipiona-26-stops', 'es'),
    'Cádiz → Chipiona, por Centro P. Puerto',
  );
  assert.equal(reviewedLinePathLabel(route, 'unknown', 'es'), undefined);
});
