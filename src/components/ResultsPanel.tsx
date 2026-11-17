import { useMemo, useState, type ReactElement } from 'react';
import type { ImportIssue, ImportResult } from 'react-data-import';
import { rowsToJson } from '../lib/pipeline';
import { DataTable } from './DataTable';
import { Badge, Card } from './ui';

export const SHOWN_ROWS = 100;
export const SHOWN_ISSUES = 200;

interface Props {
  result: ImportResult;
  validated: boolean;
  typeName: string;
}

export function ResultsPanel({ result, validated, typeName }: Props): ReactElement {
  const [view, setView] = useState<'table' | 'json'>('table');
  const errors = result.issues.filter((i) => i.severity === 'error').length;
  const warnings = result.issues.length - errors;
  const rows = result.data.slice(0, SHOWN_ROWS);
  return (
    <>
      <Card
        id="rows-title"
        title={`3. Typed rows (${result.data.length.toLocaleString('en-US')})`}
        actions={
          <div role="group" aria-label="Rows view" className="segmented">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>
              Table
            </button>
            <button type="button" aria-pressed={view === 'json'} onClick={() => setView('json')}>
              JSON
            </button>
          </div>
        }
      >
        <p className="hint mb-2">
          {validated ? (
            <>
              Rows that passed the Zod schema, as <code>{typeName}[]</code>. Rows with an error are left out and listed under issues.
            </>
          ) : (
            <>Rows mapped to the schema without validation (a cast). Rows with a type or required-field error are still left out.</>
          )}{' '}
          Every row has every schema field; an unmapped one is <code>null</code>.
        </p>
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="font-semibold">columns</span> ({result.columns.length}):{' '}
          {result.columns.map((c, i) => (
            <span key={c.key}>
              {i ? ', ' : ''}
              <code>{c.key}</code>
              {c.letter ? ` ← ${c.letter} "${c.title}"` : ' ← not mapped'} <span className="text-slate-500 dark:text-slate-400">({c.type})</span>
            </span>
          ))}
        </p>
        {view === 'table' ? (
          <DataTable
            label={`${result.data.length} valid rows${result.data.length > SHOWN_ROWS ? `, first ${SHOWN_ROWS} shown` : ''}`}
            columns={result.columns.map((c) => ({ key: c.key, title: c.key, note: c.letter ? `from ${c.title || c.letter}` : 'not mapped' }))}
            rows={rows as Array<Record<string, unknown>>}
            rowNumbers={result.rowNumbers.slice(0, SHOWN_ROWS)}
            showNull
          />
        ) : (
          <pre className="code max-h-96" tabIndex={0} aria-label="Rows as JSON">
            <code>{rowsToJson(rows.slice(0, 20) as Array<Record<string, unknown>>)}</code>
          </pre>
        )}
        {result.data.length === 0 ? <p className="hint mt-2">No row is valid yet; see the issues below.</p> : null}
        {result.data.length > (view === 'table' ? SHOWN_ROWS : 20) ? (
          <p className="hint mt-2">First {view === 'table' ? SHOWN_ROWS : 20} rows shown; the counts are complete.</p>
        ) : null}
      </Card>
      <IssuesCard issues={result.issues} errors={errors} warnings={warnings} />
    </>
  );
}

function IssuesCard({ issues, errors, warnings }: { issues: readonly ImportIssue[]; errors: number; warnings: number }): ReactElement {
  const [code, setCode] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of issues) m.set(i.code, (m.get(i.code) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [issues]);
  const active = code && counts.some(([c]) => c === code) ? code : null;
  const shown = (active ? issues.filter((i) => i.code === active) : issues).slice(0, SHOWN_ISSUES);
  return (
    <Card id="issues-title" title={`4. Issues (${issues.length.toLocaleString('en-US')})`}>
      {issues.length === 0 ? (
        <p className="hint">None: every row is valid.</p>
      ) : (
        <>
          <p className="hint mb-2">
            {errors} error{errors === 1 ? '' : 's'}, {warnings} warning{warnings === 1 ? '' : 's'}. Row numbers are spreadsheet rows as Excel shows them; row 0 is a file-level issue. Field is the schema field (the key in the rows); column and cell point into the file.
          </p>
          <div role="group" aria-label="Filter issues by code" className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" className="chip" aria-pressed={active === null} onClick={() => setCode(null)}>
              All ({issues.length})
            </button>
            {counts.map(([c, n]) => (
              <button key={c} type="button" className="chip" aria-pressed={active === c} onClick={() => setCode(active === c ? null : c)}>
                {c} ({n})
              </button>
            ))}
          </div>
          <div className="table-scroll max-h-96" tabIndex={0} role="region" aria-label="Issues by spreadsheet row">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                <tr>
                  {['Row', 'Cell', 'Field', 'Column', 'Code', 'Severity', 'Message'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((i, n) => (
                  <tr key={n} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-3 py-1.5 font-mono text-xs">{i.row || 'file'}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{i.ref ?? ''}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{i.field ?? ''}</td>
                    <td className="px-3 py-1.5 text-xs">{i.column ?? ''}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{i.code}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone={i.severity === 'error' ? 'red' : 'amber'}>{i.severity}</Badge>
                    </td>
                    <td className="px-3 py-1.5">{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(active ? (counts.find(([c]) => c === active)?.[1] ?? 0) : issues.length) > SHOWN_ISSUES ? <p className="hint mt-2">First {SHOWN_ISSUES} shown.</p> : null}
        </>
      )}
    </Card>
  );
}
