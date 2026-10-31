import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const outputDir = resolve('dist');
const html = await readFile(resolve(outputDir, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.js)"/g)]
  .map((match) => match[1]);

if (assets.length === 0) {
  throw new Error('Nenhum bundle JavaScript inicial encontrado em dist/index.html.');
}

let gzipBytes = 0;
for (const asset of assets) {
  const path = resolve(outputDir, asset.slice(1));
  const content = await readFile(path);
  gzipBytes += gzipSync(content).byteLength;
}

const budget = 200_000;
console.log(`JavaScript inicial: ${(gzipBytes / 1000).toFixed(2)} kB gzip / ${(budget / 1000).toFixed(0)} kB`);
if (gzipBytes > budget) {
  throw new Error(`Bundle inicial excede o orçamento de ${budget / 1000} kB gzip.`);
}
