import { useEffect, useRef } from 'react';

export interface Shortcut {
  /** `KeyboardEvent.key`, e.g. '?', 't', 'Enter'. */
  key: string;
  /** Needs Ctrl (or Cmd on macOS). */
  mod?: boolean;
  label: string;
  description: string;
  action: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** Single-key shortcuts are ignored while typing in a field; modifier shortcuts always work. */
export function useKeyboardShortcuts(shortcuts: readonly Shortcut[]): void {
  const ref = useRef(shortcuts);
  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey) return;
      const mod = e.ctrlKey || e.metaKey;
      for (const s of ref.current) {
        if (s.key.toLowerCase() !== e.key.toLowerCase()) continue;
        if (Boolean(s.mod) !== mod) continue;
        if (!s.mod && isTyping(e.target)) continue;
        if (document.querySelector('dialog[open]') && s.key !== '?') continue;
        e.preventDefault();
        s.action();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
