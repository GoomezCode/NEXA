import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'nexa-openapi-'));
const generatedPath = join(temporaryDirectory, 'openapi.d.ts');
const cliPath = resolve('node_modules/openapi-typescript/bin/cli.js');

try {
  const result = spawnSync(
    process.execPath,
    [cliPath, 'src/api/openapi.snapshot.json', '-o', generatedPath],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) process.exit(result.status ?? 1);

  const expected = readFileSync('src/api/generated/openapi.d.ts', 'utf8');
  const actual = readFileSync(generatedPath, 'utf8');
  if (actual !== expected) {
    console.error('OpenAPI types are stale. Run `npm run api:types` and commit the result.');
    process.exitCode = 1;
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
