#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertAiTextToEpxyz } from './ai-to-epxyz.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiDir = path.join(__dirname, 'ui');
const defaultPort = Number(process.env.PORT || '3210');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(`${JSON.stringify(payload)}\n`);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk.toString('utf8');
      if (data.length > 5_000_000) {
        reject(new Error('Request body is too large.'));
      }
    });

    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const rawPath = req.url === '/' ? '/index.html' : req.url;
  const normalizedPath = path.normalize(rawPath).replace(/^\.{1,2}(\/|\\|$)/, '');
  const filePath = path.join(uiDir, normalizedPath);

  if (!filePath.startsWith(uiDir)) {
    sendJson(res, 403, { error: 'Forbidden path' });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/convert') {
    try {
      const body = await readRequestBody(req);
      const parsed = JSON.parse(body || '{}');
      const conversion = convertAiTextToEpxyz(parsed.inputText, {
        titleOverride: parsed.titleOverride,
        strictValidation: parsed.strictValidation === true,
        fallbackFilename: 'output.epxyz'
      });

      sendJson(res, 200, {
        ok: true,
        suggestedFilename: conversion.suggestedFilename,
        outputText: conversion.outputText,
        title: conversion.outputObject.data.title,
        cellCount: conversion.outputObject.data.cells.length
      });
      return;
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : 'Conversion failed'
      });
      return;
    }
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(defaultPort, '127.0.0.1', () => {
  console.log(`AI JSON paste converter running at http://127.0.0.1:${defaultPort}`);
});
