# react-data-import playground

Interactive playground for [react-data-import](https://www.npmjs.com/package/react-data-import), the React hooks and components for importing `.xlsx` and `.csv` files: column mapping, validation with any [Standard Schema](https://standardschema.dev) (Zod here), typed rows and issues. It is built on [javascript-excel](https://github.com/securedeveloper/javascript-excel).

Everything runs in the browser. Files you open never leave your machine: there is no backend, no upload, no tracking and no cookies.

## What it shows

1. **Choose a file**: drag and drop or pick an `.xlsx` / `.csv` (the drop zone is the library's unstyled `<DataImport>`), or load one of the examples.
2. **The file as read**: detected format, sheet, delimiter, header row, range, and each column's letter and inferred type.
3. **Column mapping**: the automatic match (by field name and aliases) from `useColumnMapping`, with a select per field to override it. Required fields without a column show `MAPPING_MISSING`; optional ones show that they will be `null` in every row.
4. **Typed rows**: the rows that passed the Zod schema, as a table or as JSON. Every row has every schema field (an unmapped one is `null`), and `columns` lists every schema field.
5. **Issues**: one issue per bad cell (type, required field or Zod), with its spreadsheet row, cell, schema field and source column, filterable by code.
6. **Code**: the schema file (ImportSchema + Zod) and the importer for the current setup, as `<DataImport>`, `useDataImport`, `useColumnMapping` or plain `importFile`, with the install command and copy buttons. Hand-picked mappings, the locale and the worker carry over.

Examples are messy files generated in the browser (no third-party data): a title row above the header, wrong headers in a European CSV, missing columns, bad values, extra columns, a missing required column, a 25,000-row file that is parsed in a Web Worker, and a CSV with a two-row header (header groups).

Also: three example schemas (contacts, orders, products), number/date locale, Zod on/off, worker on/off, a shareable URL for the whole setup (including the mapping), recent runs in `localStorage`, read and validate timings, light/dark theme and keyboard shortcuts (press `?`).

The version of react-data-import is pinned exactly in `package.json`, from npm's `next` tag.

## Local development

Node 22.12 or later (CI uses Node 26).

```sh
npm ci
npm run dev          # http://localhost:5173
npm run typecheck
npm run lint
npm test             # Vitest + Testing Library (jsdom)
npm run build        # static site in dist/
npm run preview      # serves dist/ with the same security headers as production
```

## Deploy

The site is static. On Vercel, import the repository with the framework preset **Vite** and the default build command and output directory. `vercel.json` only adds security headers (a Content-Security-Policy without `unsafe-inline` or `unsafe-eval`, `nosniff`, a referrer policy and `frame-ancestors 'none'`); `vite preview` serves the same headers, so they are exercised locally.

## License

[MIT](LICENSE)
