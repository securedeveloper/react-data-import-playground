import { describe, expect, it } from 'vitest';
import type { ColumnMapping, ImportResult } from 'react-data-import';
import { readRaw, runImport } from '../src/lib/pipeline';
import { LARGE_ROWS, sampleById } from '../src/lib/samples';
import { schemaById } from '../src/lib/schemas';

async function run(id: string, mapping: ColumnMapping = {}, validate = true): Promise<{ raw: ImportResult; result: ImportResult }> {
  const sample = sampleById(id)!;
  const file = await sample.build();
  const raw = (await readRaw(file, { locale: sample.locale })).result;
  const result = (await runImport(file, { locale: sample.locale, schema: schemaById(sample.schemaId), mapping, validate })).result;
  return { raw, result };
}

const codes = (r: ImportResult): string[] => [...new Set(r.issues.map((i) => i.code))].sort();
const messagesByRow = (r: ImportResult): Record<number, string[]> => {
  const out: Record<number, string[]> = {};
  for (const i of r.issues) (out[i.row] ??= []).push(i.message);
  return out;
};

describe('sample files through mapping and Zod validation', () => {
  it('title row and aliases: header detected below the title, aliases matched, three rows fail', async () => {
    const { raw, result } = await run('title-row');
    expect(raw.meta.header).toMatchObject({ rows: [2], detected: true });
    expect(result.meta.mapping).toEqual({ name: 'Full name', email: 'E-mail', joined: 'Since', amount: 'Amount' });
    expect(result.data).toHaveLength(3);
    expect(result.rowNumbers).toEqual([4, 5, 9]);
    expect(messagesByRow(result)).toEqual({ 6: ['Not an e-mail address'], 7: ['Name is empty'], 8: ['Amount is negative'] });
  });

  it('wrong headers: email is MAPPING_MISSING until mapped by hand; unmapped optional fields are null', async () => {
    const before = await run('wrong-headers');
    expect(before.result.meta.mapping).toEqual({ name: 'Name', email: null, joined: null, amount: null });
    expect(before.result.issues[0]).toMatchObject({ row: 0, field: 'email', code: 'MAPPING_MISSING', severity: 'error' });
    expect(before.result.data).toHaveLength(0);
    // No per-row "email is null" issues on top of MAPPING_MISSING; only the other fields' real problems.
    expect(before.result.issues.filter((i) => i.field === 'email')).toHaveLength(1);
    expect(before.result.issues.map((i) => [i.row, i.field, i.code])).toEqual([
      [0, 'email', 'MAPPING_MISSING'],
      [5, 'name', 'INVALID'],
    ]);

    const after = await run('wrong-headers', { email: 'Kontakt' });
    expect(after.result.issues.map((i) => [i.row, i.field, i.column, i.ref, i.message])).toEqual([
      [4, 'email', 'Kontakt', 'B4', 'Not an e-mail address'],
      [5, 'name', 'Name', 'A5', 'Name is empty'],
    ]);
    expect(after.result.data).toHaveLength(4);
    // Every row has the schema's shape; joined and amount have no column, so they are null.
    for (const row of after.result.data) {
      expect(Object.keys(row).sort()).toEqual(['amount', 'email', 'joined', 'name']);
      expect(row.joined).toBeNull();
      expect(row.amount).toBeNull();
    }
    expect(after.result.columns.map((c) => [c.key, c.title, c.type])).toEqual([
      ['name', 'Name', 'string'],
      ['email', 'Kontakt', 'string'],
      ['joined', '', 'empty'],
      ['amount', '', 'empty'],
    ]);

    // With the European locale the German columns convert once they are mapped.
    const full = await run('wrong-headers', { email: 'Kontakt', joined: 'Seit', amount: 'Betrag' });
    expect(full.result.data[0]).toMatchObject({ name: 'Mira Okafor', amount: 1250.5 });
    expect((full.result.data[0]!.joined as Date).getFullYear()).toBe(2024);
    expect(messagesByRow(full.result)[6]).toEqual(['Amount is negative']);
  });

  it('missing columns: every row is valid, with joined and amount null, and columns list every field', async () => {
    const { result } = await run('missing-columns');
    expect(result.issues).toEqual([]);
    expect(result.data).toHaveLength(4);
    expect(result.columns.map((c) => c.key)).toEqual(['name', 'email', 'joined', 'amount']);
    expect(result.data.every((r) => r.joined === null && r.amount === null)).toBe(true);
  });

  it('bad values: one issue per bad cell, with the schema field, the source column and the cell', async () => {
    const { result } = await run('bad-values');
    expect(result.rowNumbers).toEqual([2, 9]);
    expect(result.issues.map((i) => [i.row, i.field, i.column, i.ref, i.code, i.message])).toEqual([
      [3, 'quantity', 'Qty', 'D3', 'TYPE', 'D3: "two" is not a number.'],
      [4, 'date', 'Order date', 'B4', 'TYPE', 'B4: "next Tuesday" is not a date.'],
      [8, 'orderId', 'Order ID', 'A8', 'REQUIRED', 'Row 8: "orderId" is required.'],
      [5, 'quantity', 'Qty', 'D5', 'INVALID', 'Quantity is not a whole number'],
      [6, 'unitPrice', 'Unit price', 'E6', 'INVALID', 'Price is negative'],
      [7, 'status', 'Status', 'F7', 'INVALID', 'Unknown status'],
    ]);
    // Empty optional cells are null, not ''.
    expect(result.data[1]).toMatchObject({ orderId: 'A-1008', customer: null, status: null });
  });

  it('extra columns: unmapped columns are reported and dropped', async () => {
    const { result } = await run('extra-columns');
    expect(result.meta.unmappedColumns).toEqual(['Sales rep', 'Internal note', 'Region']);
    expect(result.issues).toEqual([]);
    expect(Object.keys(result.data[0]!)).toEqual(['orderId', 'date', 'customer', 'quantity', 'unitPrice', 'status']);
  });

  it('missing required column: MAPPING_MISSING, then mapping Ref to sku leaves the real problems', async () => {
    const before = await run('missing-required');
    expect(before.result.issues.filter((i) => i.code === 'MAPPING_MISSING').map((i) => i.field)).toEqual(['sku']);
    expect(before.result.issues.filter((i) => i.field === 'sku')).toHaveLength(1);
    const after = await run('missing-required', { sku: 'Ref' });
    expect(after.result.data.map((r) => r.sku)).toEqual(['ABC-1001', 'ABC-1002', 'XYZ-2003']);
    expect(after.result.data[0]).toMatchObject({ active: true, stock: 12 });
    const rows = messagesByRow(after.result);
    expect(rows[4]).toEqual(['SKU must look like ABC-1234']);
    expect(rows[5]).toEqual(['Price must be above 0']);
    expect(rows[6]).toEqual(['E6: "yes" is not a boolean.', 'Stock is not a whole number']);
    expect(after.result.issues.find((i) => i.code === 'TYPE')).toMatchObject({ field: 'active', column: 'Enabled', ref: 'E6' });
  });

  it('without Zod, rows are only mapped: type errors still drop a row, Zod rules do not', async () => {
    const { result } = await run('bad-values', {}, false);
    expect(codes(result)).toEqual(['REQUIRED', 'TYPE']);
    expect(result.data).toHaveLength(5);
  });

  it(`large file: ${LARGE_ROWS} rows, one bad quantity in 500`, async () => {
    const { raw, result } = await run('large');
    expect(raw.data).toHaveLength(LARGE_ROWS);
    expect(result.data).toHaveLength(LARGE_ROWS - LARGE_ROWS / 500);
    expect(result.issues).toHaveLength(LARGE_ROWS / 500);
    expect(result.issues.every((i) => i.code === 'TYPE' && i.field === 'quantity' && i.column === 'Qty')).toBe(true);
  });
});
