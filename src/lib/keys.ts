const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export function keyLabel(s: { mod?: boolean | undefined; label: string }): string {
  return s.mod ? `${isMac ? '⌘' : 'Ctrl'} + ${s.label}` : s.label;
}
