/** The release stage of a version: 'alpha', 'beta' or 'rc' for a prerelease (1.0.0-beta.0), or null for a final version (1.0.0). */
export function releaseStage(version: string): string | null {
  const pre = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)(?:\.\d+)?$/.exec(version);
  return pre ? pre[1]! : null;
}
