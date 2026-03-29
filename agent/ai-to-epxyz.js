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
      const value = args[i + 1];
      if (value === undefined || value.startsWith('-')) {
        throw new Error('--title requires a value');
      }
      titleOverride = value;
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

function ensureInputObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('Input must be a JSON object');
  }
}

function ensureRequiredTopLevelFields(value, options = {}) {
  const missingFields = [];

  if (options.requireSchemaVersion && value.schemaVersion === undefined) {
    missingFields.push('schemaVersion');
  }

  if (value.title === undefined) {
    missingFields.push('title');
  }

  if (value.blocks === undefined) {
    missingFields.push('blocks');
  }

  if (missingFields.length > 0) {
    throw new Error(`Missing required top-level field(s): ${missingFields.join(', ')}`);
  }
}

export function sanitizeOutputFilename(title, fallback = 'output.epxyz') {
  const input = typeof title === 'string' ? title.trim() : '';
  const withoutIllegalChars = input
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const noTrailingDotsOrSpaces = withoutIllegalChars.replace(/[. ]+$/g, '').trim();
  const noLeadingDotsOrSpaces = noTrailingDotsOrSpaces.replace(/^[. ]+/g, '').trim();

  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const safeStem =
    noLeadingDotsOrSpaces && !reservedNames.test(noLeadingDotsOrSpaces)
      ? noLeadingDotsOrSpaces
      : path.parse(fallback).name || 'output';

  const fallbackExt = path.extname(fallback) || '.epxyz';
  return `${safeStem}${fallbackExt}`;
}

export function convertAiJsonToEpxyz(inputObject, options = {}) {
  ensureInputObject(inputObject);
  ensureRequiredTopLevelFields(inputObject, { requireSchemaVersion: options.requireSchemaVersion });

  const normalizedInput = normalizeAiInput(inputObject);
  const schemaPath = path.resolve('agent', 'AI-INPUT-SCHEMA.json');
  const validation = validateAiInputFile(schemaPath, normalizedInput);

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

export function convertAiTextToEpxyz(inputText, options = {}) {
  if (typeof inputText !== 'string' || inputText.trim().length === 0) {
    throw new Error('Input text is empty. Paste JSON into the input area first.');
  }

  let parsedInput;

  try {
    parsedInput = JSON.parse(inputText);
  } catch (error) {
    throw new Error(`Input is not valid JSON: ${error.message}`);
  }

  const outputObject = convertAiJsonToEpxyz(parsedInput, options);
  const outputText = `${JSON.stringify(outputObject, null, 2)}\n`;
  const outputTitle = outputObject?.data?.title;
  const suggestedFilename = sanitizeOutputFilename(outputTitle, options.fallbackFilename || 'output.epxyz');

  return {
    inputObject: parsedInput,
    outputObject,
    outputText,
    suggestedFilename
  };
}

function normalizeAiInput(inputObject) {
  if (!inputObject || Array.isArray(inputObject) || typeof inputObject !== 'object') {
    return inputObject;
  }

  const normalized = { ...inputObject };

  if (normalized.schemaVersion === undefined) {
    normalized.schemaVersion = '1.0.0';
  } else if (normalized.schemaVersion !== '1.0.0') {
    throw new Error(`Unsupported schemaVersion '${normalized.schemaVersion}'. Expected '1.0.0'.`);
  }

  if (Array.isArray(normalized.blocks)) {
    normalized.blocks = normalized.blocks.map((block) => normalizeMathBlockLatex(block));
  }

  return normalized;
}

function normalizeMathBlockLatex(block) {
  if (!block || Array.isArray(block) || typeof block !== 'object' || block.type !== 'math' || typeof block.latex !== 'string') {
    return block;
  }

  const trimmedLatex = block.latex.trimEnd();
  if (trimmedLatex.endsWith('=')) {
    return block;
  }

  if (trimmedLatex.includes('=')) {
    return block;
  }

  return {
    ...block,
    latex: `${trimmedLatex}=`
  };
}

export function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return 0;
  }

  const inputText = fs.readFileSync(args.inputPath, 'utf8');
  const conversion = convertAiTextToEpxyz(inputText, {
    titleOverride: args.titleOverride,
    fallbackFilename: path.basename(args.outputPath)
  });

  fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
  fs.writeFileSync(args.outputPath, conversion.outputText, 'utf8');

  console.log(`Converted '${args.inputPath}' -> '${args.outputPath}'`);
  console.log(`Title: ${conversion.outputObject.data.title}`);
  console.log(`Cells: ${conversion.outputObject.data.cells.length}, nextId: ${conversion.outputObject.data.nextId}`);
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
