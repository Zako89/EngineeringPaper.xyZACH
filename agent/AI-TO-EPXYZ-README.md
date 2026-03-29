# AI → `.epxyz` MVP Converter

This converter transforms structured AI lesson JSON into EngineeringPaper `.epxyz` files.

## CLI usage

```bash
node agent/ai-to-epxyz.js agent/examples/sample-ai-input.json
node agent/ai-to-epxyz.js agent/examples/sample-ai-input.json agent/examples/sample-output.epxyz
node agent/ai-to-epxyz.js agent/examples/sample-ai-input.json --title "Overridden Title"
```

If `--title` is provided without a value, the CLI exits with a clear error (`--title requires a value`) and does not write an output file.

Behavior:
1. Reads and parses the input JSON.
2. Validates against the MVP contract in `agent/AI-INPUT-SCHEMA.json` (practical runtime validation with strict unknown-field rejection and key length/URI checks for core fields).
3. Maps supported blocks to EngineeringPaper cells.
4. Builds the full `.epxyz` envelope (`{ data, history }`).
5. Writes formatted JSON to the output path.

## Local paste UI usage

Run:

```bash
npm run ai-converter-ui
```

Then open `http://127.0.0.1:3210` in your browser.

Workflow:
1. Paste raw AI JSON into the text area.
2. Click **Convert**.
3. If conversion succeeds, click **Download .epxyz**.

The UI displays:
- clear JSON and converter validation errors
- success status with title and cell count
- suggested filename derived from `title` with Windows-safe sanitization (`output.epxyz` fallback)

## Reusable conversion API

`agent/ai-to-epxyz.js` now exposes:
- `convertAiJsonToEpxyz(inputObject, options)`
- `convertAiTextToEpxyz(inputText, options)`
- `sanitizeOutputFilename(title, fallback?)`

Both CLI and paste UI use the same core conversion path to avoid duplicated logic.

## Supported block types (MVP)

Required support implemented:
- `text` → documentation cell text
- `markdown` → documentation cell literal markdown text
- `heading` → documentation cell text prefixed with `#` markers
- `math` → math cell (`latex`, `config: null`)
- `equation` → math cell (`latex`, `config: null`)

Conservative optional support implemented:
- `code` → documentation cell fenced markdown block
- `asset_ref` → documentation placeholder text (`[asset:label] id=...` + optional URL)

## Output shape

The generated `.epxyz` includes the full recommended top-level structure:
- `data.version`
- `data.config`
- `data.cells`
- `data.title`
- `data.results`
- `data.system_results`
- `data.codeCellResults`
- `data.sub_results`
- `data.nextId`
- `data.sheetId`
- `data.insertedSheets`
- top-level `history`

## Tests

Run:

```bash
node agent/tests/test-ai-to-epxyz.js
```

The script checks:
- happy-path conversion against fixture output
- invalid input failure path
- deterministic output with fixed `sheetId` and `creation` timestamp
- structural consistency with `agent/EPXYZ-OUTPUT-SHAPE.json`
- JSON text conversion and filename sanitization behavior

## MVP limitations

- Markdown is not rendered into rich Quill formatting; it is preserved as plain text.
- LaTeX is accepted as-is after newline/NUL normalization; semantic math validation is not performed.
- Validation is dependency-free and practical (schema-aligned), not a full JSON Schema engine.
