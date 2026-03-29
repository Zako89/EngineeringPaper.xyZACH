# EngineeringPaper AI Input Conventions (for `agent/ai-to-epxyz.js`)

Derived from repository source files and tests.

## 1) Converter input contract (JSON)

- Top-level object with keys: `schemaVersion`, `title`, optional `metadata`, `blocks`.
- `schemaVersion` must be `"1.0.0"` (converter also auto-fills this when omitted).
- `title` must be non-empty.
- `blocks` must be a non-empty array.
- Each block must have unique `id` and supported `type`.

## 2) Supported block types

- `text`: requires `content`
- `markdown`: requires `content`
- `heading`: requires `content`, `level` (1..6)
- `math`: requires `latex`
- `equation`: requires `latex`
- `code`: requires `content`; optional `language`
- `asset_ref`: requires `assetId`, `label`; optional `url`

## 3) Math expression syntax expected by EngineeringPaper

Math cell text is interpreted with the app's LaTeX-oriented parser.

- Statement forms include assignment (`x=...`), query (`expr=`), and equality (`expr=expr`).
- The parser supports LaTeX operators/functions (`\\frac`, `\\sqrt`, trig names, integrals, derivatives, matrices, etc.).
- Units are parsed in unit blocks (`[ ... ]` or `\\lbrack ... \\rbrack`), including multiplication (`\\cdot`), division (`\\frac{...}{...}`), and exponents.

## 4) Unit syntax

Use bracketed unit blocks inside math latex, for example:

- `1\\left\\lbrack kg\\right\\rbrack=`
- `1\\left\\lbrack kg\\cdot m\\right\\rbrack=\\left\\lbrack mg\\cdot Mm\\right\\rbrack`
- `1\\left\\lbrack reyn\\right\\rbrack=\\left\\lbrack\\frac{lbf\\cdot s}{in^2}\\right\\rbrack`

Unit names are alphanumeric tokens and unit validity is checked via `mathjs.unit(...)` in parser logic.

## 5) Notes specific to `ai-to-epxyz.js`

- For `math` blocks only, if `latex` has no `=`, converter appends trailing `=` automatically.
- `equation` blocks are not auto-normalized with a trailing `=`.
- Block text and latex are normalized for line endings and NUL stripping before writing cells.
