# AI→EPXYZ MVP Converter Audit

Date: 2026-03-29  
Scope: correctness, spec compliance, and app compatibility for the implemented MVP converter.

## A) Overall assessment

**Assessment: ready with minor fixes.**

The converter is generally well-aligned with the intended MVP shape and with current EngineeringPaper load expectations (notably top-level `{data, history}`, documentation `json.ops`, math `latex/config`, and writer-aligned defaults). However, there are a few practical contract-compliance gaps and one UX-facing parser edge case that should be addressed before broad use.

---

## B) Spec compliance review

### What matches the spec

- Supported block types include all MVP contract types in schema/spec (`text`, `markdown`, `heading`, `math`, `equation`, plus conservative `code` and `asset_ref`).
- Validator enforces required core fields and key per-type payloads, with duplicate block-id detection.
- Mapping policy is implemented as documented:
  - text/markdown/heading/code/asset_ref → documentation stream
  - math/equation → math cells
  - adjacent doc segments are coalesced until math boundary
- Output shape includes full recommended writer-aligned envelope keys:
  - `version`, `config`, `cells`, `title`, `results`, `system_results`, `codeCellResults`, `sub_results`, `nextId`, `sheetId`, `insertedSheets`, and top-level `history`.
- Deterministic behavior is achieved when deterministic options are supplied (`sheetId`, `creationIso`).

### Mismatches / concerns

1. **Schema strictness gap (additionalProperties and hard schema limits not fully enforced)**  
   - **Where:** `agent/lib/ai-input-validator.js` (`validateAiInput`, `validateBlock`).  
   - **Issue:** Runtime validator is schema-aligned but not schema-equivalent. It does not reject unknown top-level keys / unknown block keys per block type, and does not enforce every numeric/string bound from JSON Schema (e.g., max lengths, URL format strictness).  
   - **Impact:** Inputs that pass converter may fail external schema validation workflows or create contract drift between docs and implementation.  
   - **Severity:** **medium**.  
   - **Recommended fix:** Add explicit unknown-key checks per object type and enforce core schema bounds used in `AI-INPUT-SCHEMA.json` (at minimum max lengths + URI format for `asset_ref.url`).

2. **CLI argument edge case for `--title` without value**  
   - **Where:** `agent/ai-to-epxyz.js` (`parseArgs`).  
   - **Issue:** `--title` consumes next token without validating existence. If omitted, override becomes `undefined` silently.  
   - **Impact:** Confusing CLI behavior and weaker error signaling.  
   - **Severity:** **low**.  
   - **Recommended fix:** Throw a clear CLI error when `--title` is present without a following non-flag value.

3. **Spec wording says “strict validation” while implementation is intentionally practical validator**  
   - **Where:** docs set (`AI-TO-EPXYZ-CONVERTER-SPEC.md` vs README + validator implementation).  
   - **Issue:** Minor doc/expectation mismatch: spec language implies stricter fail-fast parity than implemented runtime checks.  
   - **Impact:** Team expectation mismatch; not a runtime compatibility breaker.  
   - **Severity:** **low**.  
   - **Recommended fix:** Either tighten validator or explicitly state in spec that MVP uses schema-aligned (not full JSON-Schema-engine) validation.

---

## C) App compatibility review

Legend: **Confirmed / Likely / Uncertain**

### 1) Top-level envelope and load gate

- `.epxyz` loader checks for top-level `data` and `history`; converter emits both. **Confirmed**.
- Save path writes the same envelope style (`{data:getSheetObject(true), history}`). Converter output mirrors this. **Confirmed**.

### 2) History shape

- Converter emits a single history entry `{url:title, hash:'file', creation:ISO}` which matches app file-save style. **Confirmed**.
- Loader does not deeply validate history entry schema at parse gate; emitted shape is plausibly safe. **Likely**.

### 3) Documentation cell shape

- App deserialization for documentation cell expects `type:"documentation"`, `id`, and `json` passed into Quill Delta holder. Converter emits exactly this shape (`json.ops` with insert strings). **Confirmed**.
- Plain-text ops are conservative and compatible. **Confirmed**.

### 4) Math cell shape

- App math cell constructor expects `type:"math"`, `id`, `latex`, and optional `config`; converter emits `config:null` which app handles. **Confirmed**.

### 5) IDs / `nextId`

- Converter assigns monotonic IDs starting at 0 and computes `nextId = max(id)+1`; this aligns with app use of `BaseCell.nextId` restoration. **Confirmed**.

### 6) Config defaults

- Converter default config matches app default config shape and values (math config, unit defaults, simplify/float flags, fluid config). **Confirmed**.
- Because app normalizes config on load anyway, this is robust. **Confirmed**.

### 7) Optional fields and writer-aligned output

- Converter emits all writer-aligned optional fields (`results`, `system_results`, `codeCellResults`, `sub_results`, `insertedSheets`) with safe empties. **Confirmed**.

### 8) Risky assumptions in generated content

- Heading conversion uses markdown prefixes in plain text (`## ...`) rather than rich Quill heading attributes; this is intentionally conservative and should render as text, not styled heading. **Likely** (acceptable for MVP).
- `asset_ref` placeholder text format is custom and safe text-only; app does not get true embedded asset objects. **Confirmed** (MVP limitation, not incompatibility).
- History parse gate checks truthiness (`fileObject.history`), so pathological non-array truthy history values could pass parse step and fail later behaviors. Converter itself emits array correctly. **Likely** external-input risk, not converter bug.

---

## D) Test quality review

### Current coverage strengths

- Happy-path conversion compared to full fixture output.
- Invalid input failure path.
- Determinism check with fixed `sheetId` and `creationIso`.
- Key output shape and defaults checks (`nextId`, empty result containers, data-key ordering).

### Gaps

- No direct tests for `code` / `asset_ref` mapping behavior.
- No tests around newline and NUL normalization for text and latex.
- No tests for validator strictness boundaries vs schema limits (max lengths, unknown properties, URI format behavior).
- No CLI parser tests for argument edge cases (`--title` missing value, extra args).

### Highest-value additional tests (1–2)

1. **Block-mix mapping test** (high value): one fixture including `heading + code + asset_ref + math + markdown` asserting exact emitted cell sequence and documentation placeholder/fence formatting.
2. **Validation-boundary test** (high value): assert rejection for unknown keys / invalid `asset_ref.url` / over-limit strings once strict checks are added (or document accepted behavior if not adding strict checks).

---

## E) Risk register (top remaining technical risks)

1. **Contract drift risk**: Runtime validator accepts inputs outside declared JSON Schema strictness (unknown fields / some bounds).  
2. **Interoperability risk**: Teams using strict schema validation elsewhere may see pass/fail inconsistencies with converter runtime.  
3. **CLI UX risk**: Missing `--title` value not explicitly surfaced.  
4. **Content semantics risk (known MVP)**: Markdown/headings are literal text, not rich Quill semantics.

---

## F) Recommended action list

### 1) Must fix before merge/use

1. Decide and enforce one contract stance: either
   - implement stricter runtime checks to better match `AI-INPUT-SCHEMA.json`, or
   - update spec language to explicitly allow schema-aligned (not strict-equivalent) validation.

### 2) Should fix soon

1. Add explicit CLI error for `--title` without value.
2. Add one block-mix mapping test covering `code` + `asset_ref` + math boundary behavior.

### 3) Okay to defer to phase 2

1. Rich markdown/heading conversion into styled Quill Delta attributes.
2. Optional LaTeX semantic validation/sanitization beyond basic normalization.
3. Asset lifecycle integration beyond placeholder text.
