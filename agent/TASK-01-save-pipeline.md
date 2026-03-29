# TASK 01 — Trace the `.epxyz` save pipeline

## Goal

Find the complete code path used to save/export native `.epxyz` files.

## Instructions

Start from any UI or exported function that triggers native file saving, especially:

- `downloadSheet`
- save/export modals
- toolbar save actions
- menu save actions
- file utilities

Trace the code until you find:

1. the exact object being written to disk
2. where serialization happens
3. where the filename / extension is assigned
4. where MIME type is assigned
5. whether any transformations, migrations, cleanup, normalization, or metadata insertion happen before saving

## Deliverables

### A. Save pipeline call graph
List the chain of files and functions in order

### B. Serialization evidence
Show the exact `JSON.stringify(...)` or equivalent code, if present

### C. Payload shape
Describe the object written to disk

### D. File metadata
State:
- extension
- MIME type
- save dialog configuration
- default filename behavior

### E. Confidence
For each major claim, mark:
- Confirmed
- Inferred
- Unknown

## Search hints

Search for:

- `downloadSheet`
- `.epxyz`
- `saveAs`
- `Blob`
- `JSON.stringify`
- `showSaveFilePicker`
- `application/json`

## Important

Do not stop at the first function named `downloadSheet`.
Follow all calls until the actual on-disk payload is identified.