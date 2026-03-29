# Final report — `.epxyz` reverse engineering

## 1. Executive summary

- `.epxyz` is saved as **plain JSON text** wrapped in a top-level object with `{ data, history }`, serialized by `JSON.stringify(...)` and written as `application/json`. **Confirmed**.
- Local file loading parses `.epxyz` with `JSON.parse(...)`, requires both top-level keys `data` and `history`, then reconstructs live app state via `populatePage(...)`. **Confirmed**.
- The loader tolerates several missing/legacy fields (e.g. `version`, `config`, `insertedSheets`, `codeCellResults`, `sub_results`, `system_results`) by defaulting in code. **Confirmed**.
- We can generate valid `.epxyz` programmatically; a runnable Node.js generator is provided at `agent/generate-epxyz.js`. **Confirmed (code-path backed), app-runtime import not executed in this environment**.

---

## 2. Save pipeline

### 2.1 Save pipeline call graph (local file export)

1. `src/DownloadDocumentModal.svelte` dispatches `downloadSheet` with `saveAs` flag.
2. `src/App.svelte` binds `downloadSheet={(e) => saveSheetToFile(e.detail.saveAs)}`.
3. `saveSheetToFile(saveAs)` in `src/App.svelte` constructs:
   - `appState.history = [{ url, hash: 'file', creation }, ...]`
   - `sheet = { data: getSheetObject(true), history: appState.history }`
4. `getSheetObject(true)` in `src/stores.svelte.ts` builds the in-memory sheet payload from `appState` and `cell.serialize()`.
5. `saveSheetToFile` serializes via `JSON.stringify(sheet)` and writes a `Blob` with type `application/json`.
6. Write path:
   - If File System Access API exists: `showSaveFilePicker({ types: fileTypes, suggestedName: "${title}.epxyz" })`, then `createWritable().write(fileData)`.
   - Else fallback: `saveFileBlob(fileData, "${title}.epxyz")` download anchor flow in `src/utility.ts`.

### 2.2 Serialization evidence

- `const fileData = new Blob([JSON.stringify(sheet)], {type: "application/json"});`
- `const sheet = { data: getSheetObject(true), history: appState.history };`

### 2.3 Filename / extension / MIME

- Extension: `.epxyz` (suggested and fallback download names). **Confirmed**.
- MIME: `application/json` for native sheet save picker type and blob. **Confirmed**.
- Save picker accepts `{"application/json": [".epxyz"]}` via `fileTypes`. **Confirmed**.
- Default filename behavior: `${appState.title}.epxyz`. **Confirmed**.

### 2.4 Transformations before save

- `getSheetObject(true)` includes current runtime fields: `version`, `config`, serialized `cells`, `results`, `system_results`, `codeCellResults`, `sub_results`, `nextId`, `sheetId`, `insertedSheets`. **Confirmed**.
- `cells` are produced by each class’s `serialize()` implementation; no additional schema migration is applied during save. **Confirmed**.

---

## 3. Load pipeline

### 3.1 Load pipeline call graph (local open)

1. User action (`Open`) in `src/App.svelte` -> `handleFileOpen()`.
2. Open path either:
   - `showOpenFilePicker({ types: fileTypes, id: "epxyz" })`, then `openSheetFromFile(file, handle)`.
   - or `<input type=file accept=".epxyz">` fallback.
3. `openSheetFromFile(...)` reads with `FileReader.readAsText(file)` and onload calls `loadSheetFromFile(event, fileHandle, pushState)`.
4. `loadSheetFromFile(...)` -> `parseFile(event)`.
5. `parseFile(...)` runs `JSON.parse(...)`, then requires both `fileObject.data` and `fileObject.history`; otherwise throws format error.
6. Parsed values are passed to `populatePage(sheet, requestHistory)`.
7. `populatePage(...)` reconstructs runtime state: title, ids, config normalization, cell instantiation with `cellFactory(...)`, and optional restoration of precomputed results.

### 3.2 Parsing evidence

- `const fileObject = JSON.parse((event.target.result as string));`
- Gate condition:
  - `if (fileObject.data && fileObject.history) { ... } else { throw "File is not the correct format"; }`

### 3.3 Validation / migration / defaults

Confirmed defaulting during load:

- `appState.insertedSheets = sheet.insertedSheets ?? []`.
- `appState.config = normalizeConfig(sheet.config)`.
- `normalizeConfig(...)` defaults missing config branches (`customBaseUnits`, `simplifySymbolicExpressions`, `convertFloatsToFractions`, `fluidConfig`, `mathCellConfig.showIntermediateResults`).
- `appState.system_results = sheet.system_results ? sheet.system_results : []`.
- `appState.sub_results = sheet.sub_results ? new Map(sheet.sub_results) : new Map()`.
- `appState.codeCellResults = sheet.codeCellResults ? sheet.codeCellResults : {}`.

No explicit `version`-switch migration function was found in the local file load path; compatibility is handled by optional fields and defaults. **Confirmed**.

### 3.4 Loader expectations and failure paths

- Hard parse requirement: top-level `data` and `history` must both exist (truthy). **Confirmed**.
- `data.cells` must contain recognized `type` values accepted by `cellFactory(...)`; unknown types hit exhaustive default and fail population. **Confirmed**.
- `data` should include `title`, `nextId`, `sheetId`; missing values are not explicitly validated and may degrade behavior. **Inferred**.
- Any parse or reconstruction exception surfaces error modals (“Error parsing input file” / “Error restoring file”). **Confirmed**.

---

## 4. Confirmed `.epxyz` structure

Top-level on disk:

```json
{
  "data": { "...sheet...": "..." },
  "history": [
    {
      "url": "string",
      "hash": "string",
      "creation": "ISO date string"
    }
  ]
}
```

Current writer (`getSheetObject(true)`) shape for `data`:

```json
{
  "version": 20260313,
  "config": { "..." },
  "cells": [
    { "type": "math", "id": 0, "latex": "x=1", "config": null }
  ],
  "title": "My Sheet",
  "results": [],
  "system_results": [],
  "codeCellResults": {},
  "sub_results": [],
  "nextId": 1,
  "sheetId": "uuid",
  "insertedSheets": []
}
```

---

## 5. Required vs optional fields

### Required (confirmed by loader gate or immediate use)

- Top-level `data`. **Confirmed**.
- Top-level `history` (must be present/truthy). **Confirmed**.
- `data.cells` with valid cell type entries for successful reconstruction. **Confirmed**.

### Required (inferred for stable behavior)

- `data.title` (assigned directly to app state). **Inferred**.
- `data.nextId` (assigned to `BaseCell.nextId`). **Inferred**.
- `data.sheetId` (used in history/recent-file identity). **Inferred**.
- `data.results` (assigned if parser finds no errors and current results are empty). **Inferred**.

### Optional (confirmed defaulted)

- `data.version`.
- `data.config` (entirely optional; defaults via `normalizeConfig`).
- `data.insertedSheets`.
- `data.system_results`.
- `data.sub_results`.
- `data.codeCellResults`.
- Several nested `config` fields and `math` cell config fields used by old documents.

### Unknown

- The absolute mathematically smallest schema that avoids *all* downstream UI edge cases over every feature path (without running full browser E2E round-trip in this environment).

---

## 6. Minimal valid examples

### 6.1 Smallest plausible valid file (code-backed minimal)

```json
{
  "data": {
    "title": "Minimal",
    "cells": [],
    "results": [],
    "nextId": 0,
    "sheetId": "11111111-1111-4111-8111-111111111111"
  },
  "history": []
}
```

### 6.2 One text cell

```json
{
  "data": {
    "title": "One text cell",
    "cells": [
      {
        "type": "documentation",
        "id": 0,
        "json": { "ops": [{ "insert": "Hello from .epxyz\\n" }] }
      }
    ],
    "results": [],
    "nextId": 1,
    "sheetId": "22222222-2222-4222-8222-222222222222"
  },
  "history": []
}
```

### 6.3 One equation/math cell

```json
{
  "data": {
    "title": "One math cell",
    "cells": [
      {
        "type": "math",
        "id": 0,
        "latex": "x=2",
        "config": null
      }
    ],
    "results": [],
    "nextId": 1,
    "sheetId": "33333333-3333-4333-8333-333333333333"
  },
  "history": []
}
```

---

## 7. Generator script

- Runnable script: `agent/generate-epxyz.js`.
- Generates a `.epxyz` file with:
  - top-level `{data, history}`
  - one `documentation` (text) cell
  - one `math` cell
  - default config and metadata fields aligned with current writer shape.

Run:

```bash
node agent/generate-epxyz.js
node agent/generate-epxyz.js agent/custom.epxyz "My Title"
```

---

## 8. Confidence assessment

### High confidence

- Save path serialization format and MIME/extension handling.
- Local open parse gate (`data` + `history`) and reconstruction through `populatePage`.
- Defaulting behavior for older schema fields (`normalizeConfig`, optional result maps).

### Medium confidence

- “Smallest valid file” remains “plausible minimal” rather than browser-round-trip-proven in this run.

### Low confidence

- None of the core format findings are low confidence; remaining uncertainty is primarily runtime verification breadth.

---

## 9. Remaining uncertainties

1. Whether `results` can be omitted in every case without side effects across all UI states.
   - Next step: open generated minimal variants in browser E2E and compare behavior.
2. Whether `history: []` versus one explicit `{hash:'file'}` item changes any subtle UX behavior.
   - Next step: compare recents/history interactions after loading both variants.

---

## 10. Practical recommendation

- **Yes**, you can now generate `.epxyz` directly from external data.
- Recommended production approach:
  1. Emit full writer-aligned shape (as in `agent/generate-epxyz.js`) for maximum compatibility.
  2. Keep uncertain-minimal fields configurable behind constants.
  3. Add a browser-level import smoke test in CI using Playwright with generated fixtures.
