# TASK 04 — Build a programmatic `.epxyz` generator

## Goal

Create a Node.js script that generates a valid `.epxyz` file based on the reconstructed schema.

## Instructions

Using the results of the save/load/schema tasks, write a Node.js script that:

1. creates a valid `.epxyz` object
2. includes all required metadata
3. includes at least:
   - one text cell
   - one equation/math cell, if supported
4. writes the result to disk as a `.epxyz` file

## Deliverables

### A. Node.js script
A complete runnable script

### B. Assumptions
List any assumptions and label each as:
- Confirmed
- Inferred
- Unknown

### C. Mapping notes
Explain how external AI-generated content could be mapped into the file structure

### D. Failure risks
List which parts of the generator are most likely to fail if the schema inference is incomplete

## Important

If some schema details remain uncertain, isolate them into clearly marked constants or placeholders.
Do not hide uncertainty inside the structure.