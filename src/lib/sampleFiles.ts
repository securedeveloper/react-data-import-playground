// Builds the sample files with javascript-excel. Every name, address and number is made up.
import { fromDataset, toUint8Array, XLSX_MIME } from 'javascript-excel';
import { toCsv } from 'javascript-excel/csv';
import { LARGE_ROWS } from './samples';

const pad = (n: number): string => String(n).padStart(2, '0');
const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function csvFile(name: string, rows: Array<Array<string | number>>, delimiter = ','): File {
  // Our own data, so the formula guard (which quotes text starting with '-', '=', …) is not needed.
  const text = toCsv(rows, { delimiter, escapeFormulas: false });
  return new File([text], name, { type: 'text/csv' });
}

async function xlsxFile(name: string, sheet: ReturnType<typeof fromDataset>): Promise<File> {
  const bytes = await toUint8Array({ sheets: [sheet] });
  return new File([bytes as BlobPart], name, { type: XLSX_MIME });
}

const people = [
  { name: 'Mira Okafor', mail: 'mira@example.org', since: new Date(2024, 0, 15), amount: 1250.5 },
  { name: 'Jonas Lindqvist', mail: 'jonas@example.org', since: new Date(2023, 5, 1), amount: 980 },
  { name: 'Priya Raman', mail: 'priya(at)example.org', since: new Date(2022, 10, 30), amount: 310.25 },
  { name: '', mail: 'nobody@example.org', since: new Date(2021, 2, 3), amount: 15 },
  { name: 'Tomás Herrera', mail: 'tomas@example.org', since: new Date(2020, 7, 26), amount: -40 },
  { name: 'Lena Fischer', mail: 'lena@example.org', since: new Date(2019, 4, 11), amount: 2200 },
];

/** A small deterministic generator, so the large sample is the same on every load. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const CUSTOMERS = ['Northwind Bakery', 'Blue Harbor Co.', 'Cedar & Pine', 'Atlas Cycles', 'Lumen Studio', 'Kite Labs'];
const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];



export const BUILDERS: Record<string, () => Promise<File>> = {
  'title-row': () => {
    const sheet = fromDataset(
      {
        columns: [
          { title: 'Full name', key: 'name' },
          { title: 'E-mail', key: 'mail' },
          { title: 'Since', key: 'since', type: 'date', numFmt: 'yyyy-mm-dd' },
          { title: 'Amount', key: 'amount', numFmt: '#,##0.00' },
        ],
        data: people,
      },
      { name: 'Contacts', origin: 'A3', freezeHeader: true, autoWidth: true },
    );
    sheet.rows[0] = ['Contacts export, November 2026'];
    return xlsxFile('contacts.xlsx', sheet);
  },
  'wrong-headers': async () => {
    const rows: Array<Array<string | number>> = [['Name', 'Kontakt', 'Seit', 'Betrag']];
    for (const p of people) {
      const d = p.since;
      rows.push([p.name, p.mail, `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`, p.amount.toFixed(2).replace('.', ',')]);
    }
    return csvFile('kontakte.csv', rows, ';');
  },
  'missing-columns': async () => {
    const rows: Array<Array<string | number>> = [['Full name', 'E-mail']];
    for (const p of people.filter((x) => x.name && x.mail.includes('@'))) rows.push([p.name, p.mail]);
    return csvFile('contacts-short.csv', rows);
  },
  'bad-values': () => {
    const data: Array<Record<string, unknown>> = [
      { id: 'A-1001', date: new Date(2026, 9, 1), customer: 'Northwind Bakery', qty: 3, price: 4.5, status: 'paid' },
      { id: 'A-1002', date: new Date(2026, 9, 2), customer: 'Blue Harbor Co.', qty: 'two', price: 12, status: 'pending' },
      { id: 'A-1003', date: 'next Tuesday', customer: 'Cedar & Pine', qty: 1, price: 99.99, status: 'shipped' },
      { id: 'A-1004', date: new Date(2026, 9, 4), customer: 'Atlas Cycles', qty: 1.5, price: 20, status: 'paid' },
      { id: 'A-1005', date: new Date(2026, 9, 5), customer: 'Lumen Studio', qty: 2, price: -8, status: 'paid' },
      { id: 'A-1006', date: new Date(2026, 9, 6), customer: 'Kite Labs', qty: 5, price: 3.2, status: 'refunded' },
      { id: '', date: new Date(2026, 9, 7), customer: 'Northwind Bakery', qty: 1, price: 7, status: 'pending' },
      { id: 'A-1008', date: new Date(2026, 9, 8), customer: '', qty: 10, price: 1.25, status: '' },
    ];
    const sheet = fromDataset(
      {
        columns: [
          { title: 'Order ID', key: 'id' },
          { title: 'Order date', key: 'date', numFmt: 'yyyy-mm-dd' },
          { title: 'Customer', key: 'customer' },
          { title: 'Qty', key: 'qty' },
          { title: 'Unit price', key: 'price', numFmt: '0.00' },
          { title: 'Status', key: 'status' },
        ],
        data,
      },
      { name: 'Orders', freezeHeader: true, autoWidth: true },
    );
    return xlsxFile('orders.xlsx', sheet);
  },
  'extra-columns': async () => {
    const rows: Array<Array<string | number>> = [['Order #', 'Order date', 'Client', 'Sales rep', 'Qty', 'Unit price', 'State', 'Internal note', 'Region']];
    const rnd = lcg(7);
    for (let i = 0; i < 12; i++) {
      rows.push([
        `B-${2001 + i}`,
        iso(new Date(2026, 8, 1 + i)),
        CUSTOMERS[i % CUSTOMERS.length]!,
        ['Ana', 'Ravi', 'Sam'][i % 3]!,
        1 + Math.floor(rnd() * 9),
        Math.round(rnd() * 5000) / 100,
        STATUSES[i % 3]!,
        i % 4 === 0 ? 'call before delivery' : '',
        ['North', 'South', 'East', 'West'][i % 4]!,
      ]);
    }
    return csvFile('orders-export.csv', rows);
  },
  'missing-required': async () => {
    return csvFile('products.csv', [
      ['Ref', 'Product', 'Unit price', 'On hand', 'Enabled'],
      ['ABC-1001', 'Desk lamp', 39.9, 12, 'TRUE'],
      ['ABC-1002', 'Notebook, dotted', 6.5, 140, 'TRUE'],
      ['abc-12', 'Pen set', 9, 30, 'FALSE'],
      ['XYZ-2001', 'Monitor arm', 0, 4, 'TRUE'],
      ['XYZ-2002', 'Cable tray', 18, 2.5, 'yes'],
      ['XYZ-2003', 'Footrest', 27, 0, 'FALSE'],
    ]);
  },
  'header-groups': async () => {
    // Header groups as a CSV has them: no merges, the group title only above its first column.
    return csvFile('stock-by-site.csv', [
      ['SKU', 'Product', 'Unit price', 'Stock', '', 'Enabled'],
      ['', '', '', 'Berlin', 'Paris', ''],
      ['ABC-1001', 'Desk lamp', 39.9, 12, 4, 'TRUE'],
      ['ABC-1002', 'Notebook, dotted', 6.5, 140, 60, 'TRUE'],
      ['ABC-1003', 'Pen set', 9, 30, 0, 'FALSE'],
      ['XYZ-2001', 'Monitor arm', 49, 4, 7, 'TRUE'],
    ]);
  },
  'large': async () => {
    const rnd = lcg(42);
    const rows: Array<Array<string | number>> = [['Order ID', 'Order date', 'Customer', 'Qty', 'Unit price', 'Status']];
    const start = new Date(2025, 0, 1).getTime();
    for (let i = 0; i < LARGE_ROWS; i++) {
      rows.push([
        `C-${100000 + i}`,
        iso(new Date(start + Math.floor(i / 50) * 86_400_000)),
        CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)]!,
        i % 500 === 499 ? 'many' : 1 + Math.floor(rnd() * 20),
        Math.round(rnd() * 20000) / 100,
        STATUSES[Math.floor(rnd() * STATUSES.length)]!,
      ]);
    }
    return csvFile('orders-large.csv', rows);
  },
};
