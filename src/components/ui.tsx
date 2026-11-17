import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { copyText } from '../lib/clipboard';

export function Card({ id, title, actions, children }: { id: string; title: ReactNode; actions?: ReactNode; children: ReactNode }): ReactElement {
  return (
    <section aria-labelledby={id} className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function CopyButton({ text, label, className = 'btn-secondary' }: { text: string | (() => string); label: string; className?: string }): ReactElement {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        const ok = await copyText(typeof text === 'function' ? text() : text);
        setState(ok ? 'copied' : 'failed');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState('idle'), 1500);
      }}
    >
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'red' | 'amber' | 'green' | 'violet' }): ReactElement {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
