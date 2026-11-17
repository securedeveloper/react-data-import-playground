// The two calls the playground makes, as plain functions so tests can run them
// without React: a raw read (the file as it is, for the preview and the mapping
// screen) and the import (schema mapping plus Zod validation).
import { importFile, isExcelError, type ColumnMapping, type ImportResult } from 'react-data-import';
import type { WorkerClient } from 'javascript-excel/worker';
import { LOCALES, type LocaleId } from './locales';
import type { ExampleSchema } from './schemas';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export interface Timed<T> {
  result: T;
  ms: number;
}

export interface ReadSettings {
  locale: LocaleId;
  worker?: WorkerClient | undefined;
}

export function readOptions(settings: ReadSettings): { maxFileBytes: number; locale?: NonNullable<(typeof LOCALES)[LocaleId]['locale']>; worker?: WorkerClient } {
  const locale = LOCALES[settings.locale].locale;
  return { maxFileBytes: MAX_FILE_BYTES, ...(locale ? { locale } : {}), ...(settings.worker ? { worker: settings.worker } : {}) };
}

export async function readRaw(file: File, settings: ReadSettings): Promise<Timed<ImportResult>> {
  const t0 = performance.now();
  const result = await importFile(file, readOptions(settings));
  return { result, ms: performance.now() - t0 };
}

export interface ImportSettings extends ReadSettings {
  schema: ExampleSchema;
  mapping: ColumnMapping;
  validate: boolean;
}

export async function runImport(file: File, settings: ImportSettings): Promise<Timed<ImportResult>> {
  const t0 = performance.now();
  const result = await importFile(file, {
    ...readOptions(settings),
    schema: settings.schema.importSchema,
    mapping: settings.mapping,
    ...(settings.validate ? { validate: settings.schema.zod } : {}),
  });
  return { result, ms: performance.now() - t0 };
}

/** Friendly text for javascript-excel's error codes; the rest falls back to the message. */
export function describeError(err: unknown): string {
  if (isExcelError(err)) {
    switch (err.code) {
      case 'UNSUPPORTED_FORMAT':
        return (err.details as { format?: string } | undefined)?.format === 'cfb'
          ? 'This is an old .xls or a password-protected file. Save it as .xlsx and try again.'
          : 'This file type is not supported. Use .xlsx or .csv.';
      case 'NOT_XLSX':
        return "This doesn't look like an Excel file.";
      case 'LIMIT_EXCEEDED':
        return `The file is too large for the playground (limit ${MAX_FILE_BYTES / 1024 / 1024} MiB).`;
      default:
        return `${err.code}: ${err.message}`;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/** Cell text for display. Values from the file are untrusted: React escapes them; nothing goes through innerHTML. */
export function show(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === 'object') return 'error' in v ? String((v as { error: unknown }).error) : JSON.stringify(v);
  return String(v);
}

/** Rows as JSON for the JSON view: dates as local dates, nulls kept. */
export function rowsToJson(rows: ReadonlyArray<Record<string, unknown>>): string {
  return JSON.stringify(
    rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? show(v) : v]))),
    null,
    2,
  );
}
