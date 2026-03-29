import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { convertAiJsonToEpxyz } from '../ai-to-epxyz.js';

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

function run() {
  testHappyPathFixture();
  testInvalidInputFails();
  testDeterministicOutputAndShape();
  console.log('All converter tests passed.');
}

run();
