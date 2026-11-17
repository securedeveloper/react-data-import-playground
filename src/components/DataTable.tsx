import type { ReactElement, ReactNode } from 'react';
import { show } from '../lib/pipeline';

export interface TableColumn {
  key: string;
  title: ReactNode;
  note?: ReactNode;
}

interface Props {
  label: string;
  columns: readonly TableColumn[];
  rows: ReadonlyArray<Record<string, unknown>>;
  rowNumbers?: readonly number[] | undefined;
  /** Show null cells as a visible "null" instead of blank. */
  showNull?: boolean;
}

/** A scrollable, keyboard-reachable table with scoped headers. */
export function DataTable({ label, columns, rows, rowNumbers, showNull }: Props): ReactElement {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
          <tr>
            {rowNumbers ? (
              <th scope="col" className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                Row
              </th>
            ) : null}
            {columns.map((c) => (
              <th scope="col" key={c.key} className="px-3 py-2 align-bottom font-semibold whitespace-nowrap text-slate-800 dark:text-slate-100">
                {c.title}
                {c.note ? <span className="block text-xs font-normal text-slate-600 dark:text-slate-300">{c.note}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowNumbers?.[i] ?? i} className="border-t border-slate-200 dark:border-slate-700">
              {rowNumbers ? (
                <th scope="row" className="px-3 py-1.5 font-mono text-xs font-normal text-slate-600 dark:text-slate-300">
                  {rowNumbers[i]}
                </th>
              ) : null}
              {columns.map((c) => {
                const v = r[c.key];
                const isNull = v === null || v === undefined;
                return (
                  <td key={c.key} className={`px-3 py-1.5 whitespace-nowrap ${typeof v === 'number' ? 'text-right tabular-nums' : ''}`}>
                    {isNull && showNull ? <span className="font-mono text-xs text-violet-700 italic dark:text-violet-300">null</span> : show(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
