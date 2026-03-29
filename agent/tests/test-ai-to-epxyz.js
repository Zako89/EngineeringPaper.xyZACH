import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { convertAiJsonToEpxyz, convertAiTextToEpxyz, sanitizeOutputFilename } from '../ai-to-epxyz.js';

const repoRoot = path.resolve('.');
const sampleInputPath = path.join(repoRoot, 'agent/examples/sample-ai-input.json');
const invalidInputPath = path.join(repoRoot, 'agent/examples/invalid-ai-input.json');
const fixtureOutputPath = path.join(repoRoot, 'agent/examples/sample-output.epxyz');
const outputShapePath = path.join(repoRoot, 'agent/EPXYZ-OUTPUT-SHAPE.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function testHappyPathFixture() {
  const input = readJson(sampleInputPath);
  const output = convertAiJsonToEpxyz(input, {
    sheetId: '11111111-2222-4333-8444-555555555555',
    creationIso: '2026-03-29T00:00:00.000Z'
  });

  const fixture = readJson(fixtureOutputPath);
  assert.deepEqual(output, fixture, 'Generated output must match sample fixture');

  assert.ok(output.data, 'Expected top-level data');
  assert.ok(Array.isArray(output.history), 'Expected top-level history array');
  assert.equal(output.data.cells.length, 3, 'Expected 3 cells for sample fixture');
  assert.equal(output.data.cells[0].type, 'documentation');
  assert.equal(output.data.cells[1].type, 'math');
  assert.equal(output.data.cells[2].type, 'documentation');
}

function testInvalidInputFails() {
  const input = readJson(invalidInputPath);
  assert.throws(
    () => convertAiJsonToEpxyz(input),
    /Input validation failed/,
    'Invalid input should fail validation'
  );
}

function testDeterministicOutputAndShape() {
  const input = readJson(sampleInputPath);
  const options = {
    sheetId: '11111111-2222-4333-8444-555555555555',
    creationIso: '2026-03-29T00:00:00.000Z'
  };

  const outputA = convertAiJsonToEpxyz(input, options);
  const outputB = convertAiJsonToEpxyz(input, options);

  assert.deepEqual(outputA, outputB, 'Output should be deterministic when fixed ids/timestamps are provided');

  const shape = readJson(outputShapePath);
  const expectedDataKeys = Object.keys(shape.data);
  const actualDataKeys = Object.keys(outputA.data);
  assert.deepEqual(actualDataKeys, expectedDataKeys, 'Data keys should match recommended output shape ordering');

  assert.equal(typeof outputA.data.nextId, 'number');
  assert.equal(outputA.data.nextId, outputA.data.cells.length);
  assert.deepEqual(outputA.data.results, []);
  assert.deepEqual(outputA.data.system_results, []);
  assert.deepEqual(outputA.data.codeCellResults, {});
  assert.deepEqual(outputA.data.sub_results, []);
  assert.deepEqual(outputA.data.insertedSheets, []);
}

function testValidatorStrictnessChecks() {
  const base = readJson(sampleInputPath);

  assert.throws(
    () => convertAiJsonToEpxyz({ ...base, extraTopLevel: true }),
    /root contains unsupported field 'extraTopLevel'/,
    'Unknown top-level keys should fail validation'
  );

  assert.throws(
    () =>
      convertAiJsonToEpxyz({
        ...base,
        blocks: [{ id: 'b1', type: 'text', content: 'hello', unknown: true }]
      }),
    /blocks\[0\] contains unsupported field 'unknown'/,
    'Unknown block keys should fail validation'
  );

  assert.throws(
    () =>
      convertAiJsonToEpxyz({
        ...base,
        blocks: [{ id: 'b1', type: 'asset_ref', assetId: 'a1', label: 'A', url: 'not a uri' }]
      }),
    /blocks\[0\].url must be a valid URI/,
    'Invalid asset_ref.url should fail validation'
  );
}

function testCliFailsOnMissingTitleValue() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-to-epxyz-cli-'));
  const outputPath = path.join(tmpDir, 'out.epxyz');
  const result = childProcess.spawnSync(
    process.execPath,
    [path.join(repoRoot, 'agent/ai-to-epxyz.js'), sampleInputPath, outputPath, '--title'],
    { encoding: 'utf8' }
  );

  assert.notEqual(result.status, 0, 'CLI should fail when --title has no value');
  assert.match(result.stderr, /--title requires a value/);
  assert.equal(fs.existsSync(outputPath), false, 'No output file should be written on CLI failure');
}

function testSchemaVersionNormalization() {
  const base = readJson(sampleInputPath);
  const { schemaVersion, ...withoutSchema } = base;

  assert.doesNotThrow(
    () => convertAiJsonToEpxyz(withoutSchema),
    'Missing schemaVersion should default to 1.0.0'
  );

  assert.throws(
    () => convertAiJsonToEpxyz({ ...base, schemaVersion: '2.0.0' }),
    /Unsupported schemaVersion '2.0.0'\. Expected '1.0.0'\./,
    'Unexpected schemaVersion should throw before conversion'
  );
}

function testMathLatexNormalization() {
  const output = convertAiJsonToEpxyz({
    title: 'Math normalization',
    blocks: [
      { id: 'a', type: 'math', latex: '2 + 2' },
      { id: 'b', type: 'math', latex: 'y = 3x + 2' },
      { id: 'c', type: 'math', latex: '5 * 9=' },
      { id: 'd', type: 'equation', latex: 'z + 1' }
    ]
  });

  const mathCells = output.data.cells.filter((cell) => cell.type === 'math');
  assert.equal(mathCells[0].latex, '2 + 2=');
  assert.equal(mathCells[1].latex, 'y = 3x + 2');
  assert.equal(mathCells[2].latex, '5 * 9=');
  assert.equal(mathCells[3].latex, 'z + 1');
}


function testTextInputConversionAndFilename() {
  const inputText = fs.readFileSync(sampleInputPath, 'utf8');
  const conversion = convertAiTextToEpxyz(inputText);

  assert.ok(conversion.outputText.includes('"data"'), 'Expected serialized epxyz text');
  assert.equal(conversion.suggestedFilename, 'Beam Bending Intro.epxyz');
}

function testFriendlyRequiredFieldErrors() {
  assert.throws(
    () => convertAiJsonToEpxyz({ schemaVersion: '1.0.0' }),
    /Missing required top-level field\(s\): title, blocks/,
    'Missing required top-level fields should be clear'
  );

  assert.throws(
    () => convertAiTextToEpxyz('{'),
    /Input is not valid JSON:/,
    'Invalid JSON text should produce a clear parse error'
  );
}

function testFilenameSanitization() {
  assert.equal(sanitizeOutputFilename('My: Sheet / Draft?'), 'My- Sheet - Draft-.epxyz');
  assert.equal(sanitizeOutputFilename('CON'), 'output.epxyz');
  assert.equal(sanitizeOutputFilename('   ...   '), 'output.epxyz');
}

function run() {
  testHappyPathFixture();
  testInvalidInputFails();
  testDeterministicOutputAndShape();
  testValidatorStrictnessChecks();
  testCliFailsOnMissingTitleValue();
  testSchemaVersionNormalization();
  testMathLatexNormalization();
  testTextInputConversionAndFilename();
  testFriendlyRequiredFieldErrors();
  testFilenameSanitization();
  console.log('All converter tests passed.');
}

run();
