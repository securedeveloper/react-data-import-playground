// Turns the playground's current setup into code an app can paste: the schema
// file (ImportSchema + Zod), the importer itself in one of four styles, and the
// worker file when the worker is on.
import type { ColumnMapping, FieldSpec } from 'react-data-import';
import { LOCALES, type LocaleId } from './locales';
import type { ExampleSchema } from './schemas';

export type CodeStyle = 'component' | 'hook' | 'mapping' | 'function';

export const CODE_STYLES: ReadonlyArray<{ id: CodeStyle; label: string; hint: string }> = [
  { id: 'component', label: '<DataImport>', hint: 'Unstyled drop zone component with a render prop' },
  { id: 'hook', label: 'useDataImport', hint: 'Hook with status, result and applyMapping' },
  { id: 'mapping', label: 'useColumnMapping', hint: 'A mapping screen like this playground' },
  { id: 'function', label: 'importFile', hint: 'Plain async function, no React' },
];

export function isCodeStyle(v: unknown): v is CodeStyle {
  return CODE_STYLES.some((s) => s.id === v);
}

export interface CodeGenInput {
  schema: ExampleSchema;
  locale: LocaleId;
  /** Only the fields the user changed from the automatic mapping. */
  mapping: ColumnMapping;
  validate: boolean;
  worker: boolean;
  style: CodeStyle;
  version: string;
  engineVersion: string;
}

export interface GeneratedFile {
  name: string;
  code: string;
}

export interface GeneratedCode {
  install: string;
  files: GeneratedFile[];
}

const q = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const IDENT = /^[A-Za-z_$][\w$]*$/;
const key = (k: string): string => (IDENT.test(k) ? k : q(k));

function printField(spec: FieldSpec): string {
  const parts: string[] = [];
  if (spec.aliases?.length) parts.push(`aliases: [${spec.aliases.map(q).join(', ')}]`);
  if (spec.required) parts.push('required: true');
  if (spec.type) parts.push(`type: ${q(spec.type)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

const TS_TYPES: Record<string, string> = { string: 'string', number: 'number', date: 'Date', datetime: 'Date', boolean: 'boolean' };

function schemaFile(input: CodeGenInput): string {
  const { schema, validate } = input;
  const fields = Object.entries(schema.importSchema.fields)
    .map(([name, spec]) => `    ${key(name)}: ${printField(spec)},`)
    .join('\n');
  const lines = [
    ...(validate ? ["import { z } from 'zod';"] : []),
    "import type { ImportSchema } from 'react-data-import';",
    '',
    ...(validate ? ["// Only needed under a Content-Security-Policy without 'unsafe-eval'.", 'z.config({ jitless: true });', ''] : []),
    '/** Column mapping: field names, the header titles that match them, forced types. */',
    `export const ${schema.schemaName}: ImportSchema = {`,
    '  fields: {',
    fields,
    '  },',
    '};',
    '',
  ];
  if (validate) {
    lines.push(
      '/** Row validation (any Standard Schema works); valid rows become its output type. */',
      `export const ${schema.typeName} = ${schema.zodSource};`,
      `export type ${schema.typeName} = z.infer<typeof ${schema.typeName}>;`,
    );
  } else {
    lines.push(
      '/** Without a validator the row type is a cast. Every field is present; an unmapped one is null. */',
      `export interface ${schema.typeName} {`,
      ...Object.entries(schema.importSchema.fields).map(([name, spec]) => `  ${key(name)}: ${(spec.type && TS_TYPES[spec.type]) || 'unknown'} | null;`),
      '}',
    );
  }
  return lines.join('\n') + '\n';
}

function mappingLiteral(mapping: ColumnMapping): string {
  const entries = Object.entries(mapping);
  return `{ ${entries.map(([f, c]) => `${key(f)}: ${c === null ? 'null' : q(c)}`).join(', ')} }`;
}

function localeLiteral(id: LocaleId): string | null {
  const l = LOCALES[id].locale;
  if (!l) return null;
  return `{ ${Object.entries(l)
    .map(([k, v]) => `${k}: ${q(String(v))}`)
    .join(', ')} }`;
}

/** The import options as `key: value` lines (without the mapping for the mapping style). */
function optionLines(input: CodeGenInput, withMapping: boolean): string[] {
  const out = [`schema: ${input.schema.schemaName}`];
  if (input.validate) out.push(`validate: ${input.schema.typeName}`);
  if (withMapping && Object.keys(input.mapping).length) out.push('mapping');
  const locale = localeLiteral(input.locale);
  if (locale) out.push(`locale: ${locale}`);
  out.push('maxFileBytes: 10 * 1024 * 1024');
  if (input.worker) out.push('worker');
  return out;
}

function workerSetup(input: CodeGenInput): string[] {
  if (!input.worker) return [];
  return [
    '',
    '// Files of 1 MiB or more are parsed in this worker (DEFAULT_WORKER_THRESHOLD).',
    "const worker = typeof Worker === 'undefined' ? undefined : createWorkerClient(new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' }));",
  ];
}

function mappingConst(input: CodeGenInput): string[] {
  if (!Object.keys(input.mapping).length) return [];
  return ['', '// Columns picked by hand; the other fields keep the automatic match.', `const mapping: ColumnMapping = ${mappingLiteral(input.mapping)};`];
}

function importerFile(input: CodeGenInput): GeneratedFile {
  const T = input.schema.typeName;
  const S = input.schema.schemaName;
  const hasMapping = Object.keys(input.mapping).length > 0;
  const schemaImport = `import { ${S}${input.validate ? `, ${T}` : `, type ${T}`} } from './schema';`;
  const workerImport = input.worker ? ["import { createWorkerClient } from 'javascript-excel/worker';"] : [];
  const mappingType = hasMapping && input.style !== 'mapping' ? ', type ColumnMapping' : '';

  switch (input.style) {
    case 'component': {
      const props = optionLines(input, true).map((l) => {
        const [k, ...rest] = l.split(': ');
        const v = rest.join(': ');
        return `      ${k}={${v || k}}`;
      });
      return {
        name: `${T}Import.tsx`,
        code: [
          "import { useState } from 'react';",
          `import { DataImport, isExcelError, type ImportResult${mappingType} } from 'react-data-import';`,
          ...workerImport,
          schemaImport,
          ...workerSetup(input),
          ...mappingConst(input),
          '',
          `export function ${T}Import() {`,
          `  const [result, setResult] = useState<ImportResult<${T}> | null>(null);`,
          '  const [error, setError] = useState<string | null>(null);',
          '  return (',
          `    <DataImport<${T}>`,
          ...props,
          '      onImported={(r) => {',
          '        setResult(r);',
          '        setError(null);',
          '      }}',
          "      onError={(err) => setError(isExcelError(err) ? err.code : 'The file could not be read.')}",
          '    >',
          '      {({ getRootProps, getInputProps, isDragging, status }) => (',
          "        <div {...getRootProps({ className: isDragging ? 'drop over' : 'drop' })}>",
          '          <label>',
          '            Choose a file <input {...getInputProps()} />',
          '          </label>',
          '          <p>or drop an .xlsx or .csv here</p>',
          '          <p role="status">',
          "            {status === 'reading' ? 'Reading…' : result ? `${result.data.length} rows imported, ${result.issues.length} issues` : null}",
          '          </p>',
          '          {error ? <p role="alert">{error}</p> : null}',
          '        </div>',
          '      )}',
          '    </DataImport>',
          '  );',
          '}',
          '',
        ].join('\n'),
      };
    }
    case 'hook': {
      const opts = optionLines(input, true);
      return {
        name: `${T}Import.tsx`,
        code: [
          `import { useDataImport${mappingType} } from 'react-data-import';`,
          ...workerImport,
          schemaImport,
          ...workerSetup(input),
          ...mappingConst(input),
          '',
          `export function ${T}Import() {`,
          `  const { importFile, status, result, error } = useDataImport<${T}>({`,
          ...opts.map((l) => `    ${l},`),
          '  });',
          '',
          '  return (',
          '    <div>',
          '      <label>',
          '        Choose a file{\' \'}',
          '        <input',
          '          type="file"',
          '          accept=".xlsx,.csv"',
          '          onChange={(e) => {',
          '            const file = e.currentTarget.files?.[0];',
          '            if (file) importFile(file).catch(() => {}); // errors are in `error`',
          '          }}',
          '        />',
          '      </label>',
          '      <p role="status">',
          "        {status === 'reading' ? 'Reading…' : null}",
          "        {status === 'mapping' ? 'A required field has no column; call applyMapping(mapping) with one.' : null}",
          "        {status === 'done' && result ? `${result.data.length} valid rows` : null}",
          '      </p>',
          '      {error ? <p role="alert">The file could not be read.</p> : null}',
          '      {result?.issues.length ? (',
          '        <ul>',
          '          {result.issues.map((issue, i) => (',
          '            <li key={i}>',
          "              Row {issue.row || 'file'}{issue.field ? ` (${issue.field})` : ''}: {issue.message}",
          '            </li>',
          '          ))}',
          '        </ul>',
          '      ) : null}',
          '    </div>',
          '  );',
          '}',
          '',
        ].join('\n'),
      };
    }
    case 'mapping': {
      const opts = optionLines(input, false);
      const locale = localeLiteral(input.locale);
      const readOpts = [...(locale ? [`locale: ${locale}`] : []), 'maxFileBytes: 10 * 1024 * 1024', ...(input.worker ? ['worker'] : [])];
      const initial = hasMapping
        ? [
            '',
            '  // Columns picked by hand in the playground; apply them once the file is read:',
            ...Object.entries(input.mapping).map(([f, c]) => `  // mapping.set(${q(f)}, ${c === null ? 'null' : q(c)});`),
          ]
        : [];
      return {
        name: `${T}Import.tsx`,
        code: [
          "import { useState } from 'react';",
          "import { importFile, useColumnMapping, type ImportResult } from 'react-data-import';",
          ...workerImport,
          schemaImport,
          ...workerSetup(input),
          '',
          `export function ${T}Import() {`,
          '  const [file, setFile] = useState<File | null>(null);',
          '  // The file as read, without a schema: every column with a title, letter and sample values.',
          '  const [raw, setRaw] = useState<ImportResult | null>(null);',
          `  const [result, setResult] = useState<ImportResult<${T}> | null>(null);`,
          `  const mapping = useColumnMapping(raw, ${S});`,
          ...initial,
          '',
          '  async function choose(f: File) {',
          '    setFile(f);',
          '    setResult(null);',
          `    setRaw(await importFile(f, { ${readOpts.join(', ')} }));`,
          '  }',
          '',
          '  async function run() {',
          '    if (!file) return;',
          `    setResult(await importFile<${T}>(file, {`,
          ...opts.map((l) => `      ${l},`),
          '      mapping: mapping.mapping,',
          '    }));',
          '  }',
          '',
          '  return (',
          '    <div>',
          '      <input type="file" accept=".xlsx,.csv" aria-label="Choose a file" onChange={(e) => e.currentTarget.files?.[0] && void choose(e.currentTarget.files[0])} />',
          '      {raw',
          '        ? mapping.fields.map((f) => (',
          '            <label key={f.name}>',
          "              {f.name}{f.required ? ' *' : ''}",
          "              <select value={f.column ?? ''} onChange={(e) => mapping.set(f.name, e.target.value || null)}>",
          '                <option value="">Not mapped</option>',
          '                {mapping.columns.map((c) => (',
          '                  <option key={c.key} value={c.key}>',
          '                    {c.title || c.key}',
          '                  </option>',
          '                ))}',
          '              </select>',
          '            </label>',
          '          ))',
          '        : null}',
          '      <button type="button" disabled={!raw || mapping.missingRequired.length > 0} onClick={() => void run()}>',
          '        Import',
          '      </button>',
          '      {result ? <p role="status">{result.data.length} valid rows, {result.issues.length} issues</p> : null}',
          '    </div>',
          '  );',
          '}',
          '',
        ].join('\n'),
      };
    }
    case 'function': {
      const opts = optionLines(input, true);
      return {
        name: `import${T}s.ts`,
        code: [
          `import { importFile, isExcelError${mappingType} } from 'react-data-import';`,
          ...workerImport,
          schemaImport,
          ...workerSetup(input),
          ...mappingConst(input),
          '',
          `export async function import${T}s(file: File): Promise<${T}[]> {`,
          '  try {',
          `    const { data, issues } = await importFile<${T}>(file, {`,
          ...opts.map((l) => `      ${l},`),
          '    });',
          '    // Rows with an error are left out of data and listed in issues, by spreadsheet row.',
          "    for (const issue of issues) console.warn(`row ${issue.row}: ${issue.field ?? ''} ${issue.message}`);",
          '    return data;',
          '  } catch (err) {',
          "    if (isExcelError(err) && err.code === 'UNSUPPORTED_FORMAT') throw new Error('Use an .xlsx or .csv file.');",
          '    throw err;',
          '  }',
          '}',
          '',
        ].join('\n'),
      };
    }
  }
}

export function generateCode(input: CodeGenInput): GeneratedCode {
  const pkgs = [`react-data-import@${input.version}`, ...(input.worker ? [`javascript-excel@${input.engineVersion}`] : []), ...(input.validate ? ['zod'] : [])];
  const files: GeneratedFile[] = [{ name: 'schema.ts', code: schemaFile(input) }, importerFile(input)];
  if (input.worker) {
    files.push({
      name: 'excel.worker.ts',
      code: ["// The app's own worker file; it works under a strict CSP (worker-src 'self').", "import { exposeWorker } from 'javascript-excel/worker';", '', 'exposeWorker();', ''].join('\n'),
    });
  }
  return { install: `npm install ${pkgs.join(' ')}`, files };
}

/** Every generated file in one text, for "copy all". */
export function allCode(input: CodeGenInput): string {
  const g = generateCode(input);
  return [`// ${g.install}`, ...g.files.map((f) => `// ---- ${f.name}\n${f.code}`)].join('\n\n');
}
