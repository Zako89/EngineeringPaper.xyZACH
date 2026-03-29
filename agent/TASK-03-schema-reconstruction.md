# TASK 03 — Reconstruct the minimal `.epxyz` schema

## Goal

Using the save and load pipelines, determine the smallest valid `.epxyz` structure that the app can open successfully.

## Instructions

Use direct evidence from the save/load code to identify:

1. required top-level keys
2. required nested keys
3. optional fields that are defaulted or ignored
4. version or metadata fields
5. the smallest possible valid document structure

If the full schema is large, focus on the minimum subset needed for successful load.

## Deliverables

### A. Minimal top-level schema
List keys and what they appear to mean

### B. Required vs optional fields
Separate clearly

### C. Minimal valid file examples
Provide JSON for:
- an empty or near-empty valid file, if possible
- a file with one text cell
- a file with one equation/math cell, if supported

### D. Schema notes
Mention any required:
- IDs
- ordering
- coordinates
- timestamps
- version numbers
- defaults

### E. Confidence
For each major claim, mark:
- Confirmed
- Inferred
- Unknown

## Important

Do not invent fields unless absolutely necessary.
If something is inferred rather than confirmed, label it explicitly.