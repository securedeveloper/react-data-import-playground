import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { VERSION as ENGINE_VERSION } from 'javascript-excel';
import { createWorkerClient, type WorkerClient } from 'javascript-excel/worker';
import { DataImport, useColumnMapping, version, type ColumnMapping, type ImportResult } from 'react-data-import';
import { CodePanel } from './components/CodePanel';
import { DataTable } from './components/DataTable';
import { MappingPanel } from './components/MappingPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Badge, Card, CopyButton } from './components/ui';
import { copyText } from './lib/clipboard';
import { useKeyboardShortcuts, type Shortcut } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';
import { allCode, type CodeGenInput, type CodeStyle } from './lib/codegen';
import { addEntry, loadHistory, saveHistory, type HistoryEntry } from './lib/history';
import { LOCALES, type LocaleId } from './lib/locales';
import { describeError, readOptions, readRaw, runImport, type Timed } from './lib/pipeline';
import { SAMPLES, sampleById, type Sample } from './lib/samples';
import { SCHEMAS, schemaById } from './lib/schemas';
import { parseUrlState, serializeUrlState, type UrlState } from './lib/urlState';
import { releaseStage } from './lib/version';

/** 'beta' for 1.0.0-beta.0; null once a final version is pinned (then there is no prerelease note). */
const stage = releaseStage(version);

const PREVIEW_ROWS = 8;
const LINKS = {
  github: 'https://github.com/securedeveloper/react-data-import',
  npm: 'https://www.npmjs.com/package/react-data-import',
  docs: 'https://github.com/securedeveloper/react-data-import/blob/main/docs/api.md',
  source: 'https://github.com/securedeveloper/react-data-import-playground',
};

type Settings = Omit<UrlState, 'mapping'>;

function useWorker(): WorkerClient | undefined {
  // One worker for the page; files of 1 MiB or more are parsed there (DEFAULT_WORKER_THRESHOLD).
  return useMemo(
    () => (typeof Worker === 'undefined' ? undefined : createWorkerClient(new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' }))),
    [],
  );
}

const ms = (n: number): string => (n < 10 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US')) + ' ms';
const kb = (n: number): string => (n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1024 / 1024).toFixed(2)} MiB`);

/** Fields whose column differs from the automatic match. */
function diffMapping(current: ColumnMapping, auto: ColumnMapping): ColumnMapping {
  const out: ColumnMapping = {};
  for (const [f, c] of Object.entries(current)) if ((auto[f] ?? null) !== (c ?? null)) out[f] = c ?? null;
  return out;
}

export function App(): ReactElement {
  const initial = useMemo(() => parseUrlState(typeof window === 'undefined' ? '' : window.location.search), []);
  const [settings, setSettings] = useState<Settings>(() => {
    const { mapping: _ignored, ...rest } = initial;
    void _ignored;
    return rest;
  });
  const pendingMapping = useRef<ColumnMapping | null>(Object.keys(initial.mapping).length ? initial.mapping : null);
  const workerClient = useWorker();
  const worker = settings.worker ? workerClient : undefined;
  const schema = schemaById(settings.schema);
  const { theme, toggle: toggleTheme } = useTheme();

  const [file, setFile] = useState<File | null>(null);
  const [raw, setRaw] = useState<Timed<ImportResult> | null>(null);
  const [final, setFinal] = useState<(Timed<ImportResult> & { key: object }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('Pick an example or choose a file.');
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [helpOpen, setHelpOpen] = useState(false);
  // While the sample named in the URL loads, sections below it stay hidden so they don't jump (layout shift).
  const [booting, setBooting] = useState(() => Boolean(sampleById(initial.sample)));

  const mapping = useColumnMapping(raw?.result ?? null, schema.importSchema);
  // A second instance that is never edited: the automatic mapping, to tell what the user changed.
  const auto = useColumnMapping(raw?.result ?? null, schema.importSchema);
  const overrides = useMemo(() => (raw ? diffMapping(mapping.mapping, auto.mapping) : {}), [raw, mapping.mapping, auto.mapping]);

  const latest = useRef<File | null>(null);
  const uploadStart = useRef(0);
  const openDialog = useRef<() => void>(() => {});
  const importToken = useRef(0);

  // Settings and mapping overrides -> query string.
  useEffect(() => {
    const qs = serializeUrlState({ ...settings, mapping: pendingMapping.current ?? overrides });
    const url = `${window.location.pathname}${qs}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, '', url);
  }, [settings, overrides]);

  // Apply a mapping from the URL once its file has been read.
  useEffect(() => {
    const pending = pendingMapping.current;
    if (!pending || !raw) return;
    pendingMapping.current = null;
    for (const [f, c] of Object.entries(pending)) {
      try {
        mapping.set(f, c);
      } catch {
        // A field or column that this file/schema doesn't have: ignore it.
      }
    }
  }, [raw, mapping]);

  const showRead = useCallback((f: File, r: Timed<ImportResult>) => {
    setRaw(r);
    setError(null);
    const h = r.result.meta.header;
    setMessage(
      `Read ${f.name}: ${r.result.data.length.toLocaleString('en-US')} rows, ${r.result.columns.length} columns. ` +
        (h.rows.length ? `Header: row ${h.rows.map((x) => x + 1).join('–')}${h.detected ? ` (detected, ${h.confidence ?? 'high'} confidence)` : ''}.` : 'No header row.'),
    );
  }, []);

  const fail = useCallback((err: unknown) => {
    setBooting(false);
    setRaw(null);
    setFinal(null);
    setError(describeError(err));
    setMessage('');
  }, []);

  const read = useCallback(
    async (f: File, locale: LocaleId, useWorker: boolean) => {
      latest.current = f;
      setFile(f);
      setRaw(null);
      setFinal(null);
      setReading(true);
      setMessage(`Reading ${f.name}…`);
      try {
        const r = await readRaw(f, { locale, worker: useWorker ? workerClient : undefined });
        if (latest.current === f) showRead(f, r);
      } catch (err) {
        if (latest.current === f) fail(err);
      } finally {
        if (latest.current === f) setReading(false);
      }
    },
    [workerClient, showRead, fail],
  );

  const loadSample = useCallback(
    async (s: Sample) => {
      setSettings((prev) => ({ ...prev, sample: s.id, schema: s.schemaId, locale: s.locale }));
      const f = await s.build();
      await read(f, s.locale, settings.worker);
    },
    [read, settings.worker],
  );

  // Load the sample named in the URL on first render.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const s = sampleById(initial.sample);
    if (s) {
      void (async () => {
        const f = await s.build();
        await read(f, initial.locale, initial.worker);
      })();
    }
  }, [initial, read]);

  // One identity per set of import inputs: the result on screen is current when its key matches.
  const importKey = useMemo(
    () => ({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, file, schema, mapping.mapping, settings.validate, settings.locale, worker],
  );
  const importing = Boolean(raw && file && final?.key !== importKey);
  const busy = reading || importing;

  // Import with the schema, mapping and validator whenever any of them changes.
  useEffect(() => {
    if (!raw || !file) return;
    const token = ++importToken.current;
    runImport(file, { locale: settings.locale, worker, schema, mapping: mapping.mapping, validate: settings.validate })
      .then((r) => {
        if (token !== importToken.current) return;
        setFinal({ ...r, key: importKey });
        setBooting(false);
        const errors = r.result.issues.filter((i) => i.severity === 'error').length;
        setHistory((h) => {
          const next = addEntry(h, {
            id: `${Date.now()}-${token}`,
            at: Date.now(),
            fileName: file.name,
            sample: settings.sample,
            schema: settings.schema,
            locale: settings.locale,
            rows: raw.result.data.length,
            valid: r.result.data.length,
            errors,
            readMs: raw.ms,
            importMs: r.ms,
            worker: Boolean(worker) && file.size >= 1024 * 1024,
          });
          saveHistory(next);
          return next;
        });
      })
      .catch((err: unknown) => {
        if (token !== importToken.current) return;
        setError(describeError(err));
        setFinal({ result: { columns: [], data: [], rowNumbers: [], issues: [], warnings: [], meta: raw.result.meta }, ms: 0, key: importKey });
      });
    // settings.sample only labels the history entry; it must not re-run the import.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importKey]);

  const update = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v })), []);

  const changeLocale = (l: LocaleId): void => {
    update('locale', l);
    if (file) void read(file, l, settings.worker);
  };

  const downloadSample = async (): Promise<void> => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const codeInput: CodeGenInput = useMemo(
    () => ({
      schema,
      locale: settings.locale,
      mapping: overrides,
      validate: settings.validate,
      worker: settings.worker,
      style: settings.code,
      version,
      engineVersion: ENGINE_VERSION,
    }),
    [schema, settings.locale, overrides, settings.validate, settings.worker, settings.code],
  );

  const shortcuts: Shortcut[] = [
    { key: '?', label: '?', description: 'Show or hide keyboard shortcuts', action: () => setHelpOpen((o) => !o) },
    { key: 'o', label: 'O', description: 'Open a file', action: () => openDialog.current() },
    ...SAMPLES.map((s, i) => ({ key: String(i + 1), label: String(i + 1), description: `Example: ${s.label}`, action: () => void loadSample(s) })),
    { key: 'r', label: 'R', description: 'Reset the mapping to automatic', action: () => mapping.reset() },
    { key: 'c', label: 'C', description: 'Copy the generated code', action: () => void copyText(allCode(codeInput)) },
    { key: 'l', label: 'L', description: 'Copy a link to this setup', action: () => void copyText(window.location.href) },
    { key: 't', label: 'T', description: 'Toggle light / dark theme', action: toggleTheme },
  ];
  useKeyboardShortcuts(shortcuts);

  const result = final?.result;
  const rawResult = raw?.result;
  const rowsPerSec = final && raw ? Math.round((raw.result.data.length / (final.ms || 1)) * 1000) : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              react-data-import <span className="font-normal text-slate-600 dark:text-slate-300">playground</span>
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              v{version}
              {stage ? <> ({stage}, <code>next</code>)</> : null} on javascript-excel {ENGINE_VERSION}. Files never leave your browser.
            </p>
          </div>
          <nav aria-label="Project links" className="flex flex-wrap items-center gap-1 text-sm">
            <a className="navlink" href={LINKS.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a className="navlink" href={LINKS.npm} target="_blank" rel="noopener noreferrer">
              npm
            </a>
            <a className="navlink" href={LINKS.docs} target="_blank" rel="noopener noreferrer">
              Docs
            </a>
            <button type="button" className="navlink" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
              ?
            </button>
            <button
              type="button"
              className="navlink"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title="Toggle theme (T)"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <Card id="examples-title" title="Examples">
            <p className="hint mb-2">Messy files generated in your browser. Each one loads the file, its schema and its locale.</p>
            <ul className="flex flex-col gap-1.5">
              {SAMPLES.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`example ${settings.sample === s.id ? 'example-active' : ''}`}
                    aria-pressed={settings.sample === s.id}
                    aria-keyshortcuts={String(i + 1)}
                    onClick={() => void loadSample(s)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{s.label}</span>
                      <kbd className="kbd">{i + 1}</kbd>
                    </span>
                    <span className="mt-0.5 hidden text-xs text-slate-600 sm:block dark:text-slate-300">{s.description}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card
            id="file-title"
            title="1. Choose a file"
            actions={
              file && settings.sample ? (
                <button type="button" className="btn-secondary" onClick={() => void downloadSample()}>
                  Download {file.name}
                </button>
              ) : null
            }
          >
            <DataImport
              {...readOptions({ locale: settings.locale, worker })}
              onImported={(r) => {
                const f = latest.current;
                if (f) {
                  setReading(false);
                  showRead(f, { result: r, ms: performance.now() - uploadStart.current });
                }
              }}
              onError={(err) => {
                setReading(false);
                fail(err);
              }}
            >
              {({ getRootProps, getInputProps, isDragging, open }) => {
                openDialog.current = open;
                const pick = (f: File | undefined): void => {
                  if (!f) return;
                  uploadStart.current = performance.now();
                  latest.current = f;
                  setFile(f);
                  setRaw(null);
                  setFinal(null);
                  setReading(true);
                  setMessage(`Reading ${f.name}…`);
                  setSettings((s) => ({ ...s, sample: null }));
                };
                return (
                  <div {...getRootProps({ className: `drop ${isDragging ? 'drop-over' : ''}`, onDrop: (e) => pick(e.dataTransfer?.files?.[0]) })}>
                    <label className="btn-primary cursor-pointer">
                      Choose an .xlsx or .csv
                      <input className="sr-only" {...getInputProps({ onChange: (e) => pick(e.currentTarget.files?.[0]) })} />
                    </label>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      or drop one here (<kbd className="kbd">O</kbd> opens the dialog). It is read in this tab and never uploaded.
                    </p>
                  </div>
                );
              }}
            </DataImport>
            <p role="status" className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {message}
            </p>
            {error ? (
              <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800 dark:bg-red-950 dark:text-red-200">
                {error}
              </p>
            ) : null}
            {raw && file ? (
              <dl className="metrics mt-3" aria-label="Performance">
                <div>
                  <dt>File</dt>
                  <dd>{kb(file.size)}</dd>
                </div>
                <div>
                  <dt>Read</dt>
                  <dd>{ms(raw.ms)}</dd>
                </div>
                <div>
                  <dt>Map + validate</dt>
                  <dd>{final ? ms(final.ms) : '…'}</dd>
                </div>
                <div>
                  <dt>Rows / s</dt>
                  <dd>{final ? rowsPerSec.toLocaleString('en-US') : '…'}</dd>
                </div>
                <div>
                  <dt>Thread</dt>
                  <dd>{worker && file.size >= 1024 * 1024 ? 'worker' : 'main'}</dd>
                </div>
              </dl>
            ) : null}
          </Card>

          {rawResult ? (
            <Card id="preview-title" title="The file as read">
              <dl className="facts mb-3">
                <div>
                  <dt>Format</dt>
                  <dd>{rawResult.meta.format}</dd>
                </div>
                {rawResult.meta.sheet ? (
                  <div>
                    <dt>Sheet</dt>
                    <dd>{rawResult.meta.sheet.name}</dd>
                  </div>
                ) : null}
                {rawResult.meta.delimiter !== undefined ? (
                  <div>
                    <dt>Delimiter</dt>
                    <dd>{rawResult.meta.delimiter === '\t' ? 'Tab' : rawResult.meta.delimiter}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Header</dt>
                  <dd>
                    {rawResult.meta.header.rows.length ? `row ${rawResult.meta.header.rows.map((x) => x + 1).join('–')}` : 'none'}
                    {rawResult.meta.header.confidence ? ` (${rawResult.meta.header.confidence})` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Range</dt>
                  <dd>{rawResult.meta.range}</dd>
                </div>
                <div>
                  <dt>Rows</dt>
                  <dd>{rawResult.data.length.toLocaleString('en-US')}</dd>
                </div>
              </dl>
              <DataTable
                label={`First ${Math.min(PREVIEW_ROWS, rawResult.data.length)} of ${rawResult.data.length} rows, as read`}
                columns={rawResult.columns.map((c) => ({ key: c.key, title: c.title || c.letter, note: `${c.letter} · ${c.type}` }))}
                rows={rawResult.data.slice(0, PREVIEW_ROWS)}
                rowNumbers={rawResult.rowNumbers.slice(0, PREVIEW_ROWS)}
              />
              {rawResult.warnings.length ? (
                <ul className="mt-2 text-sm" aria-label="Reader warnings">
                  {rawResult.warnings.map((w, i) => (
                    <li key={i}>
                      <code>{w.code}</code> {w.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          {rawResult ? <MappingPanel mapping={mapping} auto={auto.mapping} /> : null}

          {rawResult ? (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold">
                Schema: {schema.label} ({settings.validate ? 'ImportSchema + Zod' : 'ImportSchema only'})
              </summary>
              <pre className="code mt-2" tabIndex={0} aria-label="Zod schema">
                <code>{schema.zodSource}</code>
              </pre>
            </details>
          ) : null}

          {result ? <ResultsPanel result={result} validated={settings.validate} typeName={schema.typeName} /> : null}

          {booting ? null : <CodePanel input={codeInput} onStyle={(s: CodeStyle) => update('code', s)} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
          <Card id="settings-title" title="Settings">
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="schema" className="label">
                  Target schema
                </label>
                <select id="schema" className="input w-full" value={settings.schema} onChange={(e) => update('schema', e.target.value)}>
                  {SCHEMAS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}: {s.description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="locale" className="label">
                  Numbers and dates
                </label>
                <select id="locale" className="input w-full" value={settings.locale} onChange={(e) => changeLocale(e.target.value as LocaleId)}>
                  {Object.entries(LOCALES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={settings.validate} onChange={(e) => update('validate', e.target.checked)} />
                <span>Validate rows with Zod</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={settings.worker}
                  onChange={(e) => {
                    update('worker', e.target.checked);
                    if (file) void read(file, settings.locale, e.target.checked);
                  }}
                />
                <span>Parse files of 1 MiB or more in a worker</span>
              </label>
              <CopyButton text={() => window.location.href} label="Copy link to this setup" />
            </div>
          </Card>

          <Card
            id="history-title"
            title="Recent runs"
            actions={
              history.length ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setHistory([]);
                    saveHistory([]);
                  }}
                >
                  Clear
                </button>
              ) : null
            }
          >
            {history.length === 0 ? (
              <p className="hint">Runs are kept in this browser only.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {history.map((h) => {
                  const s = sampleById(h.sample);
                  const body = (
                    <>
                      <span className="block truncate font-medium">{h.fileName}</span>
                      <span className="block text-xs text-slate-600 dark:text-slate-300">
                        {schemaById(h.schema).label} · {h.valid}/{h.rows} valid · {h.errors} errors · {ms(h.readMs + h.importMs)}
                        {h.worker ? ' · worker' : ''}
                      </span>
                    </>
                  );
                  return (
                    <li key={h.id}>
                      {s ? (
                        <button
                          type="button"
                          className="example"
                          onClick={() => {
                            setSettings((p) => ({ ...p, sample: s.id, schema: h.schema, locale: h.locale }));
                            void s.build().then((f) => read(f, h.locale, settings.worker));
                          }}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="example cursor-default" title="Uploaded files are not stored; choose the file again.">
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

      </main>

      <footer hidden={booting} className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-600 dark:text-slate-300">
        <p>
          react-data-import {version}, MIT licence. No uploads, no tracking, no cookies. <a href={LINKS.source}>Playground source</a>. Press{' '}
          <kbd className="kbd">?</kbd> for shortcuts.
        </p>
      </footer>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={shortcuts} />
    </div>
  );
}
