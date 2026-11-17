import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';

const status = (): string => screen.getByRole('status').textContent ?? '';

describe('playground', () => {
  it('an example maps, validates and lists issues; a manual mapping fixes MAPPING_MISSING and goes into the URL', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Wrong headers/ }));
    await waitFor(() => expect(status()).toMatch(/^Read kontakte\.csv: 6 rows, 4 columns\./));
    expect((screen.getByLabelText('Numbers and dates') as HTMLSelectElement).value).toBe('eu');

    const email = screen.getByLabelText('email') as HTMLSelectElement;
    expect(email.value).toBe('');
    expect(screen.getByText(/^Map a column to: email\./)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('heading', { name: /^4\. Issues/ })).toBeTruthy());
    const issues = (): HTMLElement => screen.getByRole('region', { name: 'Issues by spreadsheet row' });
    expect(within(issues()).getAllByText('MAPPING_MISSING')).toHaveLength(1);

    fireEvent.change(email, { target: { value: 'Kontakt' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: '3. Typed rows (4)' })).toBeTruthy());
    expect(within(issues()).queryByText('MAPPING_MISSING')).toBeNull();
    expect(within(issues()).getByText('Not an e-mail address')).toBeTruthy();
    expect(within(issues()).getByText('Name is empty')).toBeTruthy();
    // Each issue names the schema field, the source column and the cell.
    const emailRow = within(issues()).getByText('Not an e-mail address').closest('tr')!;
    expect([...emailRow.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['4', 'B4', 'email', 'Kontakt', 'INVALID', 'error', 'Not an e-mail address']);

    // Unmapped optional fields are shown as null in every row.
    const rows = screen.getByRole('region', { name: '4 valid rows' });
    expect(within(rows).getAllByText('null')).toHaveLength(8);

    const params = new URLSearchParams(window.location.search);
    expect(params.get('sample')).toBe('wrong-headers');
    expect(JSON.parse(atob(params.get('map')!.replace(/-/g, '+').replace(/_/g, '/')))).toEqual({ email: 'Kontakt' });
    expect(screen.getByRole('tabpanel').textContent).toContain("const mapping: ColumnMapping = { email: 'Kontakt' };");
  });

  it('restores a setup from the URL, mapping included', async () => {
    window.history.replaceState(null, '', '/?sample=missing-required&code=function&map=' + btoa('{"sku":"Ref"}'));
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: '3. Typed rows (3)' })).toBeTruthy());
    expect((screen.getByLabelText('sku') as HTMLSelectElement).value).toBe('Ref');
    expect(screen.getByRole('tabpanel').textContent).toContain('export async function importProducts(file: File)');
  });

  it('a file that is not a spreadsheet gives a readable error', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.change(screen.getByLabelText('Choose an .xlsx or .csv'), { target: { files: [new File([new Uint8Array([0, 1, 2])], 'x.bin')] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('This file type is not supported. Use .xlsx or .csv.'));
  });
});
