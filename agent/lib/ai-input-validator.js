import fs from 'node:fs';

const SUPPORTED_BLOCK_TYPES = new Set([
  'text',
  'markdown',
  'heading',
  'math',
  'equation',
  'code',
  'asset_ref'
]);

const TOP_LEVEL_KEYS = new Set(['schemaVersion', 'title', 'metadata', 'blocks']);
const BLOCK_ALLOWED_KEYS = {
  text: new Set(['id', 'type', 'content', 'metadata']),
  markdown: new Set(['id', 'type', 'content', 'metadata']),
  heading: new Set(['id', 'type', 'content', 'level', 'metadata']),
  math: new Set(['id', 'type', 'latex', 'metadata']),
  equation: new Set(['id', 'type', 'latex', 'metadata']),
  code: new Set(['id', 'type', 'content', 'language', 'metadata']),
  asset_ref: new Set(['id', 'type', 'assetId', 'label', 'url', 'metadata'])
};

function normalizeText(value) {
  return value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertStringField(obj, field, context, errors, { min = 1, max } = {}) {
  const value = obj[field];
  if (typeof value !== 'string') {
    errors.push(`${context}.${field} must be a string`);
    return null;
  }

  const normalized = normalizeText(value);
  if (normalized.trim().length < min) {
    errors.push(`${context}.${field} must not be empty`);
    return null;
  }

  if (max !== undefined && normalized.length > max) {
    errors.push(`${context}.${field} must be at most ${max} characters`);
    return null;
  }

  return normalized;
}

function assertAllowedKeys(obj, allowedKeys, context, errors) {
  Object.keys(obj).forEach((key) => {
    if (!allowedKeys.has(key)) {
      errors.push(`${context} contains unsupported field '${key}'`);
    }
  });
}

function isValidUri(value) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateBlock(block, index, seenIds, errors) {
  const context = `blocks[${index}]`;

  if (!isPlainObject(block)) {
    errors.push(`${context} must be an object`);
    return null;
  }

  const id = assertStringField(block, 'id', context, errors, { max: 200 });
  const type = block.type;

  if (typeof type !== 'string') {
    errors.push(`${context}.type must be a string`);
    return null;
  }

  if (!SUPPORTED_BLOCK_TYPES.has(type)) {
    errors.push(`${context}.type '${type}' is unsupported`);
    return null;
  }

  assertAllowedKeys(block, BLOCK_ALLOWED_KEYS[type], context, errors);

  if (id) {
    if (seenIds.has(id)) {
      errors.push(`${context}.id '${id}' is duplicated`);
    }
    seenIds.add(id);
  }

  const normalized = { ...block, id, type };

  if (block.metadata !== undefined) {
    if (!isPlainObject(block.metadata)) {
      errors.push(`${context}.metadata must be an object when provided`);
    } else {
      normalized.metadata = block.metadata;
    }
  }

  if (type === 'text' || type === 'markdown' || type === 'code') {
    const content = assertStringField(block, 'content', context, errors, { max: 200000 });
    if (content !== null) normalized.content = content;
    if (type === 'code' && block.language !== undefined) {
      const language = assertStringField(block, 'language', context, errors, { max: 100 });
      if (language !== null) normalized.language = language;
    }
  } else if (type === 'heading') {
    const content = assertStringField(block, 'content', context, errors, { max: 5000 });
    if (content !== null) normalized.content = content;

    if (!Number.isInteger(block.level) || block.level < 1 || block.level > 6) {
      errors.push(`${context}.level must be an integer in [1, 6]`);
    } else {
      normalized.level = block.level;
    }
  } else if (type === 'math' || type === 'equation') {
    const latex = assertStringField(block, 'latex', context, errors, { max: 50000 });
    if (latex !== null) normalized.latex = latex;
  } else if (type === 'asset_ref') {
    const assetId = assertStringField(block, 'assetId', context, errors, { max: 500 });
    const label = assertStringField(block, 'label', context, errors, { max: 500 });
    if (assetId !== null) normalized.assetId = assetId;
    if (label !== null) normalized.label = label;

    if (block.url !== undefined) {
      if (typeof block.url !== 'string' || block.url.trim().length === 0) {
        errors.push(`${context}.url must be a non-empty string when provided`);
      } else if (!isValidUri(block.url.trim())) {
        errors.push(`${context}.url must be a valid URI`);
      } else {
        normalized.url = normalizeText(block.url.trim());
      }
    }
  }

  return normalized;
}

export function validateAiInput(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    return { valid: false, errors: ['Input must be a JSON object'] };
  }

  assertAllowedKeys(input, TOP_LEVEL_KEYS, 'root', errors);

  if (input.schemaVersion !== '1.0.0') {
    errors.push('schemaVersion must equal "1.0.0"');
  }

  const title = assertStringField(input, 'title', 'root', errors, { max: 500 });

  if (input.metadata !== undefined && !isPlainObject(input.metadata)) {
    errors.push('root.metadata must be an object when provided');
  }

  if (!Array.isArray(input.blocks)) {
    errors.push('blocks must be an array');
  } else if (input.blocks.length > 10000) {
    errors.push('blocks must contain at most 10000 blocks');
  }

  const seenIds = new Set();
  const normalizedBlocks = [];

  if (Array.isArray(input.blocks)) {
    input.blocks.forEach((block, index) => {
      const normalizedBlock = validateBlock(block, index, seenIds, errors);
      if (normalizedBlock) normalizedBlocks.push(normalizedBlock);
    });

    if (input.blocks.length === 0) {
      errors.push('blocks must contain at least one block');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      schemaVersion: '1.0.0',
      title: title.trim(),
      metadata: isPlainObject(input.metadata) ? input.metadata : undefined,
      blocks: normalizedBlocks
    }
  };
}

export function validateAiInputFile(schemaPath, input) {
  // Keep schemaPath in the interface to make validator wiring explicit and
  // future-proof for switching to a JSON-schema validator.
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  return validateAiInput(input);
}

export { SUPPORTED_BLOCK_TYPES };
