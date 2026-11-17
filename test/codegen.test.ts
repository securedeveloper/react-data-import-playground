import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { version } from 'react-data-import';
import { CODE_STYLES, generateCode, type CodeGenInput, type GeneratedFile } from '../src/lib/codegen';
import { schemaById, SCHEMAS } from '../src/lib/schemas';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function input(over: Partial<CodeGenInput> = {}): CodeGenInput {
  return { schema: schemaById('contacts'), locale: 'auto', mapping: {}, validate: true, worker: false, style: 'component', version, engineVersion: '2.0.0-alpha.5', ...over };
}

/** Type-checks generated files as if they were in an app next to this repo's node_modules. Nothing is written to disk. */
function typeErrors(files: GeneratedFile[]): string[] {
  const dir = join(ROOT, '__generated__');
  const virtual = new Map(files.map((f) => [join(dir, f.name), f.code]));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowImportingTsExtensions: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile, directoryExists } = host;
  host.fileExists = (f) => virtual.has(f) || fileExists(f);
  host.directoryExists = (d) => d === dir || (directoryExists ? directoryExists(d) : true);
  host.readFile = (f) => virtual.get(f) ?? readFile(f);
  host.getSourceFile = (f, lang, ...rest) => (virtual.has(f) ? ts.createSourceFile(f, virtual.get(f)!, lang, true) : getSourceFile(f, lang, ...rest));
  const program = ts.createProgram([...virtual.keys()], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => !d.file || virtual.has(d.file.fileName))
    .map((d) => `${d.file ? d.file.fileName.slice(dir.length + 1) : ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}

describe('code generator', () => {
  it('emits the install line, the schema file and the importer', () => {
    const g = generateCode(input());
    expect(g.install).toBe(`npm install react-data-import@${version} zod`);
    expect(g.files.map((f) => f.name)).toEqual(['schema.ts', 'ContactImport.tsx']);
    const schema = g.files[0]!.code;
    expect(schema).toContain("email: { aliases: ['E-mail', 'Email address', 'Mail'], required: true },");
    expect(schema).toContain("joined: { aliases: ['Joined', 'Start date', 'Since'], type: 'date' },");
    expect(schema).toContain('export const Contact = z.object({');
    expect(g.files[1]!.code).toContain('<DataImport<Contact>');
    expect(g.files[1]!.code).toContain('validate={Contact}');
  });

  it('carries the hand-picked mapping, the locale and the worker', () => {
    const g = generateCode(input({ mapping: { email: 'Kontakt', joined: null }, locale: 'eu', worker: true, style: 'hook' }));
    expect(g.install).toBe(`npm install react-data-import@${version} javascript-excel@2.0.0-alpha.5 zod`);
    const importer = g.files[1]!.code;
    expect(importer).toContain("const mapping: ColumnMapping = { email: 'Kontakt', joined: null };");
    expect(importer).toContain("locale: { decimal: ',', group: '.', dateOrder: 'DMY' },");
    expect(importer).toContain('    mapping,\n');
    expect(importer).toContain("new Worker(new URL('./excel.worker.ts', import.meta.url), { type: 'module' })");
    expect(g.files.map((f) => f.name)).toContain('excel.worker.ts');
  });

  it('without Zod, the row type is an interface with nullable fields and zod is not installed', () => {
    const g = generateCode(input({ validate: false, schema: schemaById('products') }));
    expect(g.install).not.toContain('zod');
    const schema = g.files[0]!.code;
    expect(schema).not.toContain('zod');
    expect(schema).toContain('export interface Product {\n  sku: string | null;\n  name: unknown | null;\n  price: number | null;\n  stock: number | null;\n  active: boolean | null;\n}');
  });

  it('the type check catches a wrong import (so a pass means something)', () => {
    expect(typeErrors([{ name: 'bad.ts', code: "import { nope } from 'react-data-import';\nexport const x: number = nope;\n" }])).not.toEqual([]);
  });

  it('every style type-checks against the published package, for every schema', () => {
    for (const style of CODE_STYLES.map((s) => s.id)) {
      for (const schema of SCHEMAS) {
        for (const [validate, worker] of [
          [true, false],
          [false, true],
        ] as const) {
          const g = generateCode(input({ style, schema, validate, worker, locale: 'us', mapping: { [Object.keys(schema.importSchema.fields)[0]!]: 'Some column' } }));
          expect({ style, schema: schema.id, validate, worker, errors: typeErrors(g.files) }).toEqual({ style, schema: schema.id, validate, worker, errors: [] });
        }
      }
    }
  }, 60_000);
});
