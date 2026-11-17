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

  it('the pinned react-data-import is the 1.0 beta', () => {
    expect(version).toBe('1.0.0-beta.0');
    expect(releaseStage(version)).toBe('beta');
  });
});
