import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { version } from 'react-data-import';
import { describe, expect, it } from 'vitest';
import { releaseStage } from '../src/lib/version';

describe('releaseStage', () => {
  it('reads the stage from a prerelease version, and null from a final one', () => {
    expect(releaseStage('1.0.0-alpha.2')).toBe('alpha');
    expect(releaseStage('1.0.0-beta.0')).toBe('beta');
    expect(releaseStage('1.0.0-rc.1')).toBe('rc');
    expect(releaseStage('1.0.0')).toBeNull();
  });

  it('the installed react-data-import is the exact version package.json pins', () => {
    const pkg = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(version).toBe(pkg.dependencies['react-data-import']);
  });
});
