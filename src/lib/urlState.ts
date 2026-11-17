// The shareable part of the setup, in the query string. An uploaded file never
// goes into the URL (it never leaves the browser); a sample is named by its id.
import type { ColumnMapping } from 'react-data-import';
import { isCodeStyle, type CodeStyle } from './codegen';
import { isLocaleId, type LocaleId } from './locales';
import { sampleById } from './samples';
import { SCHEMAS } from './schemas';

export interface UrlState {
  sample: string | null;
  schema: string;
  locale: LocaleId;
  validate: boolean;
  worker: boolean;
  code: CodeStyle;
  /** Mapping overrides: field → column key (or null for "not mapped"). */
  mapping: ColumnMapping;
}

export const DEFAULT_STATE: UrlState = {
  sample: null,
  schema: 'contacts',
  locale: 'auto',
  validate: true,
  worker: true,
  code: 'component',
  mapping: {},
};

function encodeMapping(m: ColumnMapping): string {
  const bytes = new TextEncoder().encode(JSON.stringify(m));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeMapping(s: string): ColumnMapping {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ColumnMapping = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === '__proto__') continue;
      if (typeof v === 'string' || v === null) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function parseUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const sample = sampleById(p.get('sample'));
  const schemaParam = p.get('schema');
  const schema = SCHEMAS.some((s) => s.id === schemaParam) ? schemaParam! : (sample?.schemaId ?? DEFAULT_STATE.schema);
  const locale = p.get('locale');
  const code = p.get('code');
  const m = p.get('map');
  return {
    sample: sample?.id ?? null,
    schema,
    locale: isLocaleId(locale) ? locale : (sample?.locale ?? DEFAULT_STATE.locale),
    validate: p.get('zod') !== '0',
    worker: p.get('worker') !== '0',
    code: isCodeStyle(code) ? code : DEFAULT_STATE.code,
    mapping: m ? decodeMapping(m) : {},
  };
}

export function serializeUrlState(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.sample) p.set('sample', s.sample);
  if (s.schema !== DEFAULT_STATE.schema) p.set('schema', s.schema);
  if (s.locale !== DEFAULT_STATE.locale) p.set('locale', s.locale);
  if (!s.validate) p.set('zod', '0');
  if (!s.worker) p.set('worker', '0');
  if (s.code !== DEFAULT_STATE.code) p.set('code', s.code);
  if (Object.keys(s.mapping).length) p.set('map', encodeMapping(s.mapping));
  const q = p.toString();
  return q ? `?${q}` : '';
}
