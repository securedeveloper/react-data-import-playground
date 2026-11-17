import type { ImportLocale } from 'react-data-import';

export type LocaleId = 'auto' | 'eu' | 'us';

export const LOCALES: Record<LocaleId, { label: string; locale: ImportLocale | undefined }> = {
  auto: { label: 'Plain (1234.56, ISO dates)', locale: undefined },
  eu: { label: 'European (1.234,56, DD.MM.YYYY)', locale: { decimal: ',', group: '.', dateOrder: 'DMY' } },
  us: { label: 'US (1,234.56, MM/DD/YYYY)', locale: { decimal: '.', group: ',', dateOrder: 'MDY' } },
};

export function isLocaleId(v: unknown): v is LocaleId {
  return v === 'auto' || v === 'eu' || v === 'us';
}
