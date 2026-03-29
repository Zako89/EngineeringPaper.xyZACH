# Reverse engineer the EngineeringPaper `.epxyz` format

## Objective

Determine the exact `.epxyz` file format used by this repository and produce enough verified information to generate valid `.epxyz` files programmatically from external data.

## Context

This repository contains the source code of the app. We want to understand the native `.epxyz` file format by tracing the code that saves and loads these files.

The end goal is not just documentation. The end goal is to be able to generate valid `.epxyz` files outside the app.

## Known clues

- `.epxyz` is the app's native format
- the export/save UI routes native export through a function named `downloadSheet`
- the format appears to be JSON or JSON-like
- the codebase is primarily Svelte + TypeScript

## Required outcomes

You must produce:

1. the full save pipeline for `.epxyz`
2. the full load/open pipeline for `.epxyz`
3. the exact on-disk structure, or the strongest code-backed reconstruction possible
4. the minimal valid `.epxyz` file
5. a Node.js script that generates a valid `.epxyz` file
6. a final report using `agent/FINAL-REPORT-TEMPLATE.md`

## Working rules

- Do not stop at UI handlers
- Trace all paths through to the final serialized payload and the final loaded app state
- Quote exact file names and function names for major conclusions
- Prefer direct code evidence over inference
- If something is uncertain, label it as uncertain
- Separate:
  - **Confirmed**
  - **Inferred**
  - **Unknown**

## Search priorities

Search the repository for:

- `downloadSheet`
- `.epxyz`
- `JSON.stringify`
- `JSON.parse`
- `Blob`
- `showSaveFilePicker`
- `showOpenFilePicker`
- `FileReader`
- `serialize`
- `deserialize`
- `sheet`
- `document`
- `cell`
- `appState`
- `saveAs`
- `open`
- `import`
- `export`

Also inspect:
- stores
- utilities
- services
- editor state
- file I/O helpers
- migration/versioning helpers

## Execution order

Complete these task files in order:

1. `agent/TASK-01-save-pipeline.md`
2. `agent/TASK-02-load-pipeline.md`
3. `agent/TASK-03-schema-reconstruction.md`
4. `agent/TASK-04-generator.md`
5. `agent/TASK-05-validation.md`

Then fill out:

6. `agent/FINAL-REPORT-TEMPLATE.md`

## Output requirements

For every task, include:

### Summary
A concise explanation of what was found

### Evidence
Exact files, functions, and code snippets

### Conclusions
Separate confirmed facts from inference

### Next action
What should be checked next if uncertainty remains

## Important

Do not provide a generic answer. This task is only complete when the `.epxyz` disk format and load expectations are clearly identified or the remaining uncertainty is narrowly bounded and explicitly explained.