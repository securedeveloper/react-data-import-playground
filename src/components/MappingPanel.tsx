import type { ReactElement } from 'react';
import type { UseColumnMapping } from 'react-data-import';
import { show } from '../lib/pipeline';
import { Badge, Card } from './ui';

interface Props {
  mapping: UseColumnMapping;
  auto: UseColumnMapping['mapping'];
}

export function MappingPanel({ mapping, auto }: Props): ReactElement {
  const changed = mapping.fields.some((f) => (auto[f.name] ?? null) !== f.column);
  return (
    <Card
      id="mapping-title"
      title="2. Map columns to fields"
      actions={
        <button type="button" className="btn-secondary" onClick={mapping.reset} disabled={!changed}>
          Reset to automatic
        </button>
      }
    >
      <p className="hint mb-3">
        Columns were matched to the schema by name and alias (case, spaces, <code>-</code>, <code>_</code> and accents ignored; no fuzzy guessing). Change any of them.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {mapping.fields.map((f) => {
          const col = mapping.columns.find((c) => c.key === f.column);
          const manual = (auto[f.name] ?? null) !== f.column;
          return (
            <li key={f.name} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <label htmlFor={`map-${f.name}`} className="font-mono text-sm font-semibold">
                  {f.name}
                </label>
                {f.required ? <Badge tone="amber">required</Badge> : <Badge>optional</Badge>}
                {f.column === null ? (
                  f.required ? (
                    <Badge tone="red">MAPPING_MISSING</Badge>
                  ) : (
                    <Badge tone="violet">null in every row</Badge>
                  )
                ) : manual ? (
                  <Badge tone="green">set by hand</Badge>
                ) : (
                  <Badge tone="green">auto</Badge>
                )}
              </div>
              <select id={`map-${f.name}`} className="input w-full" value={f.column ?? ''} onChange={(e) => mapping.set(f.name, e.target.value || null)}>
                <option value="">Not mapped</option>
                {mapping.columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.letter ? `${c.letter}: ` : ''}
                    {c.title || c.key}
                    {c.takenBy && c.takenBy !== f.name ? ` (now ${c.takenBy})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
                {col ? `e.g. ${col.sample.map(show).filter(Boolean).slice(0, 3).join(', ') || '(empty)'}` : ' '}
              </p>
            </li>
          );
        })}
      </ul>
      {mapping.missingRequired.length ? (
        <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300" id="mapping-missing">
          Map a column to: {mapping.missingRequired.join(', ')}. Until then the import reports MAPPING_MISSING and every row fails.
        </p>
      ) : null}
    </Card>
  );
}
