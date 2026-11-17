import { useEffect, useRef, type ReactElement } from 'react';
import type { Shortcut } from '../hooks/useKeyboardShortcuts';
import { keyLabel } from '../lib/keys';

export function ShortcutsDialog({ open, onClose, shortcuts }: { open: boolean; onClose: () => void; shortcuts: readonly Shortcut[] }): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="shortcuts-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-lg font-semibold">
            Keyboard shortcuts
          </h2>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {shortcuts.map((s) => (
              <tr key={`${s.mod ? 'mod-' : ''}${s.key}`} className="border-t border-slate-200 dark:border-slate-700">
                <td className="py-1.5 pr-4">
                  <kbd className="kbd">{keyLabel(s)}</kbd>
                </td>
                <td className="py-1.5">{s.description}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 dark:border-slate-700">
              <td className="py-1.5 pr-4">
                <kbd className="kbd">Esc</kbd>
              </td>
              <td className="py-1.5">Close this dialog</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Single keys are ignored while a form field has focus.</p>
      </div>
    </dialog>
  );
}
