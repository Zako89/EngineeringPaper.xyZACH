# AI → `.epxyz` Converter Specification (Production-Ready)

## A) Purpose and Scope

### Purpose
Define a **deterministic, validator-first converter** that transforms structured AI-generated lesson content into `.epxyz` files that reliably load in EngineeringPaper.

### Input
A structured JSON document that follows `agent/AI-INPUT-SCHEMA.json`.

### Output
A UTF-8 JSON artifact with top-level shape:

```json
{ "data": { ...sheet... }, "history": [ ... ] }
```

serialized as plain JSON text and saved with `.epxyz` extension.

### In scope
- Contracted AI block types (`text`, `markdown`, `heading`, `math`, `equation`, optional conservative `code`).
- Mapping to confirmed EngineeringPaper cell structures (primarily `documentation` + `math`).
- Stable ID assignment and canonical top-level writer-aligned output.
- Strict validation and deterministic normalization.

### Out of scope (MVP)
- Lossless rich markdown fidelity (tables, nested lists, fenced code semantics) into native rich text.
- Embedded asset pipelines (binary uploads, external media lifecycle).
- Advanced cell families (`plot`, `table`, `system`, `fluid`, `piecewise`, `dataTable`) unless explicitly added later.

---

## B) Source-of-Truth Format Assumptions

This section reflects: `agent/FINAL-REPORT.md` and code inspection in `src/App.svelte`, `src/stores.svelte.ts`, `src/cells/*`, `src/sheet/Sheet.ts`.

### B1. Top-level `.epxyz` envelope
- **Confirmed:** loader requires both `data` and `history` at top level; otherwise parse fails.
- **Confirmed:** save path writes `JSON.stringify({data:getSheetObject(true), history})`.

### B2. Recommended writer-aligned `data` shape
- **Confirmed writer fields:**
  - `version`, `config`, `cells`, `title`, `results`, `system_results`, `codeCellResults`, `sub_results`, `nextId`, `sheetId`, `insertedSheets`.
- **Recommended:** always emit all of the above to match current writer and reduce drift risk.

### B3. Required vs strongly recommended fields

| Field | Status | Rationale |
|---|---|---|
| `data` | Required | Loader gate checks presence. |
| `history` | Required | Loader gate checks presence. |
| `data.cells` | Required | Needed to instantiate cells via `cellFactory`. |
| `data.title` | Strongly recommended (effectively required for UX) | Used directly in page state. |
| `data.nextId` | Strongly recommended | Used to set `BaseCell.nextId`. |
| `data.sheetId` | Strongly recommended | Used for identity/history/recent files. |
| `data.results` | Strongly recommended | Used during restoration if parse succeeds. |
| `data.config` | Recommended | Normalized on load; safe to provide fully. |
| `data.system_results` / `sub_results` / `codeCellResults` / `insertedSheets` | Recommended | Loader has defaults, but explicit emission is safer. |

### B4. Recognized cell constraints
- **Confirmed:** `cellFactory` accepts `math`, `documentation`, `plot`, `table`, `dataTable`, `piecewise`, `system`, `fluid`, `code`.
- **Confirmed:** unknown `type` causes failure via exhaustive switch behavior.
- **Confirmed minimal payloads for converter MVP:**
  - `documentation`: `{ type:"documentation", id:number, json: Delta }`
  - `math`: `{ type:"math", id:number, latex:string, config:null|MathCellConfig }`

### B5. Safe defaults
- `results: []`
- `system_results: []`
- `codeCellResults: {}`
- `sub_results: []`
- `insertedSheets: []`
- `config`: full normalized default config (writer-aligned)
- `history`: one file-style entry with ISO timestamp

---

## C) Proposed AI Input Contract

The contract is defined formally in `agent/AI-INPUT-SCHEMA.json`.

### C1. Top-level object
```json
{
  "schemaVersion": "1.0.0",
  "title": "Lesson title",
  "metadata": { ...optional... },
  "blocks": [ ...ordered blocks... ]
}
```

### C2. Block requirements
Each block must include:
- `id` (unique string)
- `type` (supported enum)

Supported block `type` values (MVP):
- `text`
- `markdown`
- `heading`
- `math`
- `equation`
- `code` (optional feature-flag; maps conservatively)
- `asset_ref` (accepted but non-rendering in MVP unless policy allows)

### C3. Validation rules (input)
- `title`: required non-empty string after trim.
- `blocks`: required ordered array.
- block IDs: unique.
- block payload rules:
  - text/markdown/heading/code require `content` string.
  - math/equation require `latex` string.
  - heading requires `level` integer 1..6.
  - asset_ref requires `assetId` and `label`.
- Optional metadata allowed but bounded and must not alter deterministic output ordering.

### C4. Block-type collapsing policy
- `text`, `markdown`, `heading`, `code`, `asset_ref` → **documentation cell** content stream (MVP-safe).
- `math`, `equation` → **math cell**.

---

## D) Mapping Spec: AI Blocks → `.epxyz` Cells

### D1. Global mapping strategy
1. Normalize input blocks.
2. Convert to an intermediate stream of `DocSegment | MathSegment`.
3. Coalesce adjacent documentation segments into minimal documentation cells.
4. Emit one math cell per math/equation block.
5. Assign sequential numeric IDs from `0..N-1`.

### D2. Block mapping table

| AI block type | Input shape | Output cell type | Mapping |
|---|---|---|---|
| `text` | `{id,type:"text",content}` | `documentation` | Append plain text + `\n` as Quill Delta ops. |
| `heading` | `{id,type:"heading",content,level}` | `documentation` | Emit text with heading marker strategy (MVP: prefix `#` x level + space), newline-preserved. |
| `markdown` | `{id,type:"markdown",content}` | `documentation` | MVP: preserve markdown as literal text; no rich conversion. |
| `code` | `{id,type:"code",content,language?}` | `documentation` | Wrap as fenced markdown text block in docs cell. |
| `asset_ref` | `{id,type:"asset_ref",assetId,label,url?}` | `documentation` | Emit safe placeholder text (`[asset:label]` + optional URL). No binary embed in MVP. |
| `math` | `{id,type:"math",latex}` | `math` | Emit `{type:"math", latex, config:null}`. |
| `equation` | `{id,type:"equation",latex}` | `math` | Same as `math`. |

### D3. Documentation-cell payload format
- Use Quill Delta-style object: `{ "ops": [ {"insert":"..."}, ... ] }`.
- **MVP recommendation:** plain inserts only (no formula/image embeds, no styling attributes).
- Preserve paragraph boundaries by inserting explicit `\n`.
- Normalize newlines to `\n` before conversion.

### D4. Text/markdown normalization and escaping
- Normalize line endings: `\r\n` and `\r` → `\n`.
- Remove NUL (`\u0000`) characters.
- Trim trailing spaces per line (optional warning-level transformation).
- JSON escaping handled by serializer only; do not pre-escape with custom logic.

### D5. Math normalization
- Accept raw LaTeX string as-is after newline normalization.
- Reject empty/whitespace-only latex as validation error.
- Optionally run lightweight sanitizer to remove NUL.
- `config` on math cells defaults to `null` unless explicit per-block override is introduced later.

### D6. Known risks
- Markdown semantics are not rendered richly in MVP (intentional conservative choice).
- Invalid LaTeX may still load but could fail parse/eval behavior in app runtime.
- Extremely long documentation blocks may impact editor performance; chunking policy recommended (see edge cases).

---

## E) Canonical Output Shape (Production Recommendation)

Converter should emit this full shape:

```json
{
  "data": {
    "version": 20260313,
    "config": { "...normalized default config...": true },
    "cells": ["..."],
    "title": "...",
    "results": [],
    "system_results": [],
    "codeCellResults": {},
    "sub_results": [],
    "nextId": 3,
    "sheetId": "uuid-v4",
    "insertedSheets": []
  },
  "history": [
    {
      "url": "<title>",
      "hash": "file",
      "creation": "2026-03-29T00:00:00.000Z"
    }
  ]
}
```

### Field policies
- `version`: recommended fixed writer-compatible integer configurable in converter settings.
- `config`: always emit full normalized default config unless caller supplies approved overrides.
- `results/system_results/codeCellResults/sub_results`: emit empty defaults in generation mode.
- `nextId`: `max(cell.id)+1` (or `0` if no cells).
- `sheetId`: UUID v4.
- `insertedSheets`: empty array in MVP.
- `history`: at least one entry.

---

## F) Validation Strategy

## F1. Validate AI input contract
### Errors (fail-fast)
- Missing required top-level fields.
- Empty title after trim.
- Unsupported block type.
- Duplicate block IDs.
- Missing required block payload fields.
- Empty `latex` for math/equation.

### Warnings (non-fatal)
- Overlong text/markdown/code blocks (threshold configurable).
- Unknown optional metadata keys.
- `asset_ref` blocks downgraded to placeholders.

### Safe coercions
- Newline normalization.
- Trim title.
- Convert heading content to text when level missing (optional only if policy set to permissive mode; strict mode errors).

## F2. Validate generated `.epxyz` output
### Errors
- Missing top-level `data` or `history`.
- `cells` contains unsupported `type`.
- Non-sequential or duplicate cell IDs.
- `nextId` mismatch.
- Invalid documentation Delta shape (`json.ops` absent).
- Invalid math cell shape (`latex` missing).

### Warnings
- Empty lesson produced 0 cells.
- History empty (if permissive mode allowed before final fill).
- Version/config absent (if compatibility mode used).

---

## G) Edge Cases and Policies

| Edge case | Handling |
|---|---|
| Empty lesson (`blocks=[]`) | Emit valid `.epxyz` with empty `cells`, `nextId=0`, warning. |
| Missing title | Strict mode: error. Permissive mode: default `"Untitled Lesson"` + warning. |
| Duplicate block IDs | Error. |
| Malformed math | If missing/empty latex => error; otherwise pass through and warn if heuristic check fails. |
| Markdown lists/tables/fences | Preserve literal markdown text in documentation cells (MVP). |
| Unsupported media | Convert to text placeholder; never embed untrusted binary by default. |
| Overlong text | Optionally split into multiple documentation cells at paragraph boundaries. |
| Mixed inline math in text | Keep as literal markdown/latex text in MVP; do not force formula embeds. |
| Unicode content | Preserve UTF-8; strip NUL only. |
| Newline normalization | Canonicalize to `\n` globally. |
| Deterministic ordering | Preserve input block order exactly; deterministic coalescing only for adjacent documentation-like blocks. |

---

## H) Recommended Implementation Architecture

**Runtime:** Node.js (TypeScript preferred).

### Proposed modules/functions
1. `parseAiInput(raw: unknown): AiLesson`
   - Schema validation (AJV).
2. `normalizeBlocks(lesson: AiLesson): NormalizedLesson`
   - Trim, newline normalization, ID checks.
3. `blockToSegments(block): Segment[]`
   - Maps each block to doc/math segment(s).
4. `coalesceSegmentsToCells(segments): DatabaseCell[]`
   - Merge adjacent doc segments; create math cells.
5. `buildEpxyzDocument(cells, title, options): EpxyzEnvelope`
   - Add canonical `data` + `history`, assign IDs/nextId/sheetId.
6. `validateEpxyz(doc): ValidationResult`
   - Structural and semantic checks.
7. `writeEpxyzFile(doc, path)`
   - JSON stringify with stable formatting policy.

### Suggested package stack
- `typescript`
- `ajv` (+ `ajv-formats`)
- `uuid`
- optional `zod` (if preferred instead of AJV, but keep one source of truth)

---

## I) Testing Plan

### I1. Fixture tests
- AI input fixtures for each block type.
- Mixed-content lesson fixtures.
- Empty lesson and minimal lesson fixtures.

### I2. Schema validation tests
- Positive: valid payloads.
- Negative: missing fields, invalid enums, duplicate IDs.

### I3. Golden output tests
- Deterministic JSON outputs for known inputs.
- Snapshot of `cells`, `nextId`, `history` shape.

### I4. Browser import smoke tests
- Programmatically generate `.epxyz`.
- Import in EngineeringPaper UI test harness.
- Assert no parse/restore error modal.

### I5. Round-trip comparison
- Import generated file, then save from app, compare high-level shape invariants:
  - top-level keys,
  - cell count/type order,
  - ID continuity.

### I6. Negative tests
- Force invalid cell type.
- Corrupt top-level envelope.
- Corrupt documentation delta.
- Corrupt math payload.

---

## J) Rollout Recommendation

### Phase 1 (MVP)
- Support: `text`, `markdown`, `heading`, `math`, `equation`.
- Optional conservative `code` as documentation text.
- Emit writer-aligned full output shape.
- Strict validation + deterministic generation.

### Phase 2
- Add controlled markdown-to-Quill conversion for headings/lists/code blocks.
- Better inline math handling in documentation content.
- Optional feature flag for generating native `code` cells **only after repository-backed behavior is validated for your target workflow**.

### Phase 3
- Asset/media pipeline with trust and storage policy.
- Additional cell families (`plot`, `table`, `system`) when upstream generation reliably supports them.

---

## Confirmed / Inferred / Recommended Summary

- **Confirmed:** top-level `{data, history}` gate and writer serialization behavior.
- **Confirmed:** documentation and math cell serialized field requirements.
- **Inferred:** omission of non-gated fields may still degrade runtime behavior; better to emit full writer shape.
- **Recommended:** conservative prose→documentation, equations→math MVP, strict validation-first implementation.

---

## End-to-end Example

### Sample AI input

```json
{
  "schemaVersion": "1.0.0",
  "title": "Beam Bending Intro",
  "blocks": [
    { "id": "b1", "type": "heading", "level": 2, "content": "Problem Setup" },
    { "id": "b2", "type": "text", "content": "Given a simply supported beam with central load." },
    { "id": "b3", "type": "equation", "latex": "\\delta=\\frac{PL^3}{48EI}" },
    { "id": "b4", "type": "markdown", "content": "Use SI units and report deflection in mm." }
  ]
}
```

### Mapping summary
- `b1+b2` + `b4` become documentation text stream (after cleanup/newline normalization).
- `b3` becomes one math cell with latex normalized.
- Resulting cells:
  1. documentation
  2. math
  3. documentation (or coalesced with #1 depending on coalescing boundary policy)

