#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { validateAiInputFile } from './lib/ai-input-validator.js';
import { mapAiBlocksToCells } from './lib/ai-to-epxyz-mapper.js';
import { buildEpxyzDocument } from './lib/epxyz-builder.js';

function parseArgs(argv) {
  const args = argv.slice(2);

  if (args.length === 0) {
    return { help: true };
  }

  let inputPath;
  let outputPath;
  let titleOverride;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      return { help: true };
    }

    if (arg === '--title') {
      titleOverride = args[i + 1];
      i += 1;
      continue;
    }

    if (!inputPath) {
      inputPath = arg;
      continue;
    }

    if (!outputPath) {
      outputPath = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!inputPath) {
    throw new Error('Missing input path');
  }

  const inferredOutputPath = outputPath || inferOutputPath(inputPath);
  return { inputPath, outputPath: inferredOutputPath, titleOverride };
}

function inferOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.epxyz`);
}

function printUsage() {
  console.log('Usage:');
  console.log('  node agent/ai-to-epxyz.js <input.json> [output.epxyz] [--title "Custom Title"]');
}

export function convertAiJsonToEpxyz(inputObject, options = {}) {
  const schemaPath = path.resolve('agent', 'AI-INPUT-SCHEMA.json');
  const validation = validateAiInputFile(schemaPath, inputObject);

  if (!validation.valid) {
    throw new Error(`Input validation failed:\n- ${validation.errors.join('\n- ')}`);
  }

  const title = options.titleOverride?.trim() || validation.data.title;
  if (!title) {
    throw new Error('Title override must not be empty');
  }

  const cells = mapAiBlocksToCells(validation.data.blocks);

  return buildEpxyzDocument({
    title,
    cells,
    sheetId: options.sheetId,
    creationIso: options.creationIso,
    version: options.version
  });
}

export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }

  const inputText = fs.readFileSync(args.inputPath, 'utf8');
  let inputObject;

  try {
    inputObject = JSON.parse(inputText);
  } catch {
    throw new Error(`Input file is not valid JSON: ${args.inputPath}`);
  }

  const outputObject = convertAiJsonToEpxyz(inputObject, {
    titleOverride: args.titleOverride
  });

  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, `${JSON.stringify(outputObject, null, 2)}\n`, 'utf8');

  console.log(`Converted '${args.inputPath}' -> '${args.outputPath}'`);
  console.log(`Title: ${outputObject.data.title}`);
  console.log(`Cells: ${outputObject.data.cells.length}, nextId: ${outputObject.data.nextId}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli(process.argv);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
