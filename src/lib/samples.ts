// Messy sample files, generated in the browser (src/lib/sampleFiles.ts). No
// third-party data: every name, address and number is made up here.
import type { LocaleId } from './locales';

export interface Sample {
  id: string;
  label: string;
  /** What the sample shows, in one sentence. */
  description: string;
  tags: string[];
  fileName: string;
  schemaId: string;
  locale: LocaleId;
  build(): Promise<File>;
}

export const LARGE_ROWS = 25_000;

// The builders (and the xlsx writer they need) load on first use, not with the page.
export const SAMPLES: readonly Sample[] = [
  {
    id: 'title-row',
    label: 'Title row and aliases',
    description: 'An .xlsx with a title above the header and headers that differ from the field names ("Full name", "E-mail", "Since"). Three rows fail validation.',
    tags: ['.xlsx', 'header detection', 'bad values'],
    fileName: 'contacts.xlsx',
    schemaId: 'contacts',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['title-row']!()),
  },
  {
    id: 'wrong-headers',
    label: 'Wrong headers',
    description: 'A European CSV (semicolons, 1.234,56, DD.MM.YYYY) with German headers. Only "Name" matches; map "Kontakt" to email by hand. Unmapped optional fields stay null.',
    tags: ['.csv', 'manual mapping', 'locale'],
    fileName: 'kontakte.csv',
    schemaId: 'contacts',
    locale: 'eu',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['wrong-headers']!()),
  },
  {
    id: 'missing-columns',
    label: 'Missing columns',
    description: 'A CSV with only a name and an e-mail column. The optional fields joined and amount are null in every row, and still listed in columns.',
    tags: ['.csv', 'null fields'],
    fileName: 'contacts-short.csv',
    schemaId: 'contacts',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['missing-columns']!()),
  },
  {
    id: 'bad-values',
    label: 'Bad values',
    description: 'Orders in an .xlsx with text where numbers and dates belong, a fractional quantity, a negative price, an unknown status and an empty order ID.',
    tags: ['.xlsx', 'type errors', 'Zod errors'],
    fileName: 'orders.xlsx',
    schemaId: 'orders',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['bad-values']!()),
  },
  {
    id: 'extra-columns',
    label: 'Extra columns',
    description: 'An orders CSV with columns the schema does not ask for (sales rep, internal note, region). They are reported as unmapped and dropped.',
    tags: ['.csv', 'unmapped columns'],
    fileName: 'orders-export.csv',
    schemaId: 'orders',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['extra-columns']!()),
  },
  {
    id: 'missing-required',
    label: 'Missing required column',
    description: 'Products where the SKU column is called "Ref", so the required sku field is unmapped (MAPPING_MISSING). Map it by hand; one SKU and one "yes" still fail.',
    tags: ['.csv', 'MAPPING_MISSING', 'booleans'],
    fileName: 'products.csv',
    schemaId: 'products',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['missing-required']!()),
  },
  {
    id: 'large',
    label: 'Large file',
    description: `${LARGE_ROWS.toLocaleString('en-US')} orders (over 1 MiB), parsed in a worker when the worker setting is on. One row in 500 has a bad quantity.`,
    tags: ['.csv', 'worker', 'performance'],
    fileName: 'orders-large.csv',
    schemaId: 'orders',
    locale: 'auto',
    build: () => import('./sampleFiles').then((m) => m.BUILDERS['large']!()),
  },
];

export function sampleById(id: string | null | undefined): Sample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
