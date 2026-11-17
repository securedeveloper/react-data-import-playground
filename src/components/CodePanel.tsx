import { useMemo, useState, type ReactElement } from 'react';
import { CODE_STYLES, allCode, generateCode, type CodeGenInput, type CodeStyle } from '../lib/codegen';
import { Card, CopyButton } from './ui';

interface Props {
  input: CodeGenInput;
  onStyle: (s: CodeStyle) => void;
}

export function CodePanel({ input, onStyle }: Props): ReactElement {
  const generated = useMemo(() => generateCode(input), [input]);
  const [fileIdx, setFileIdx] = useState(1);
  const idx = Math.min(fileIdx, generated.files.length - 1);
  const file = generated.files[idx]!;
  return (
    <Card id="code-title" title="5. Code for this setup" actions={<CopyButton text={() => allCode(input)} label="Copy all files" />}>
      <div role="group" aria-label="Code style" className="segmented mb-3 flex-wrap">
        {CODE_STYLES.map((s) => (
          <button key={s.id} type="button" title={s.hint} aria-pressed={input.style === s.id} onClick={() => onStyle(s.id)}>
            <code>{s.label}</code>
          </button>
        ))}
      </div>
      <p className="hint mb-1">Install</p>
      <div className="mb-3 flex items-center gap-2">
        <pre className="code flex-1 py-2">
          <code>{generated.install}</code>
        </pre>
        <CopyButton text={generated.install} label="Copy" />
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Generated files" className="flex flex-wrap gap-1">
          {generated.files.map((f, i) => (
            <button
              key={f.name}
              type="button"
              role="tab"
              id={`file-tab-${i}`}
              aria-selected={i === idx}
              aria-controls="file-panel"
              className="tab"
              onClick={() => setFileIdx(i)}
            >
              {f.name}
            </button>
          ))}
        </div>
        <CopyButton text={file.code} label={`Copy ${file.name}`} />
      </div>
      <pre id="file-panel" role="tabpanel" aria-labelledby={`file-tab-${idx}`} className="code max-h-[32rem]" tabIndex={0}>
        <code>{file.code}</code>
      </pre>
    </Card>
  );
}
