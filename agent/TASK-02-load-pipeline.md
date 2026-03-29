# TASK 02 — Trace the `.epxyz` load/open pipeline

## Goal

Find the complete code path used to open/import native `.epxyz` files.

## Instructions

Start from any file-open UI, import action, drag-and-drop handler, or load utility that can accept `.epxyz`.

Trace the code until you find:

1. where file contents are read
2. where JSON is parsed
3. where parsed data is validated
4. where parsed data is migrated or defaulted
5. where application state is reconstructed
6. what fields are required for the file to open successfully

## Deliverables

### A. Load pipeline call graph
List the chain of files and functions in order

### B. Parsing evidence
Show exact `JSON.parse(...)` or equivalent code, if present

### C. Validation / migration logic
List schema checks, defaulting, migration, version handling, and failure paths

### D. Loader expectations
Describe the structure the loader expects

### E. Minimum required fields
List required top-level and nested fields if determinable

### F. Confidence
For each major claim, mark:
- Confirmed
- Inferred
- Unknown

## Search hints

Search for:

- `.epxyz`
- `showOpenFilePicker`
- `JSON.parse`
- `FileReader`
- `open`
- `load`
- `import`
- `drop`
- `paste`
- `deserialize`

## Important

Do not stop at the parse step.
Trace until the parsed data is converted into live app state.