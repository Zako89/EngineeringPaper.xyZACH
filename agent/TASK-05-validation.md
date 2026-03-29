# TASK 05 — Validate by round-trip or comparison

## Goal

Validate the reconstructed `.epxyz` format against real app behavior.

## Instructions

If possible:

1. run the app
2. create the simplest possible document/sheet
3. export/save it as `.epxyz`
4. inspect the file
5. compare that file with the reconstructed schema and generator output

If running the app is not possible, validate using code-path comparison as far as possible.

## Deliverables

### A. Validation method
Explain exactly what was done

### B. Observed exported structure
If a real file was produced, summarize or quote it

### C. Differences from inferred schema
List mismatches between real output and reconstructed output

### D. Final schema corrections
Describe what should be updated

### E. Confidence
For each major claim, mark:
- Confirmed
- Inferred
- Unknown

## Important

Real exported output should override weaker inference from source code when there is a conflict.