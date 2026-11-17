// Recent runs, kept in this browser only (localStorage). File contents are never stored.
import type { LocaleId } from './locales';

export interface HistoryEntry {
  id: string;
  at: number;
  fileName: string;
  /** Set for samples, which can be loaded again; uploads have to be chosen again. */
  sample: string | null;
  schema: string;
  locale: LocaleId;
  rows: number;
  valid: number;
  errors: number;
  readMs: number;
  importMs: number;
  worker: boolean;
}

const KEY = 'rdi-playground:history';
export const MAX_HISTORY = 20;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).filter((e) => e && typeof e.id === 'string').slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // Storage can be full or blocked (private mode); history is a convenience.
  }
}

export function addEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  // The same file with the same setup replaces its older entry.
  const same = (e: HistoryEntry): boolean => e.fileName === entry.fileName && e.schema === entry.schema && e.locale === entry.locale && e.sample === entry.sample;
  return [entry, ...entries.filter((e) => !same(e))].slice(0, MAX_HISTORY);
}
