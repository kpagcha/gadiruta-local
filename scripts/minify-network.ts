/**
 * Compacts the network JSON that Vite copies into the production site.
 *
 * This runs after the website build. The checked-in source stays formatted so data changes remain
 * easy to review, while the browser downloads a smaller file from `dist/data/`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve('dist/data/bahia-cadiz-network.json');

/** Replace the copied network file with equivalent JSON without formatting whitespace. */
async function minifyNetwork(): Promise<void> {
  const contents = await readFile(outputPath, 'utf8');
  const dataset: unknown = JSON.parse(contents);
  await writeFile(outputPath, JSON.stringify(dataset));
}

await minifyNetwork();
