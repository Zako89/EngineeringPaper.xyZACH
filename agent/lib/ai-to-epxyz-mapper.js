function toLinesWithTrailingNewline(text) {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

function headingToText(content, level) {
  return `${'#'.repeat(level)} ${content}`;
}

function codeToMarkdown(content, language) {
  const lang = typeof language === 'string' ? language.trim() : '';
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

function assetToPlaceholder(block) {
  const urlPart = block.url ? ` (${block.url})` : '';
  return `[asset:${block.label}] id=${block.assetId}${urlPart}`;
}

function documentationCell(id, lines) {
  return {
    type: 'documentation',
    id,
    json: {
      ops: lines.map((insert) => ({ insert }))
    }
  };
}

function mathCell(id, latex) {
  return {
    type: 'math',
    id,
    latex,
    config: null
  };
}

export function mapAiBlocksToCells(blocks) {
  const cells = [];
  let cellId = 0;
  let docBuffer = [];

  function flushDocBuffer() {
    if (docBuffer.length === 0) return;
    cells.push(documentationCell(cellId, docBuffer));
    cellId += 1;
    docBuffer = [];
  }

  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'markdown') {
      docBuffer.push(toLinesWithTrailingNewline(block.content));
    } else if (block.type === 'heading') {
      docBuffer.push(toLinesWithTrailingNewline(headingToText(block.content, block.level)));
    } else if (block.type === 'code') {
      docBuffer.push(toLinesWithTrailingNewline(codeToMarkdown(block.content, block.language)));
    } else if (block.type === 'asset_ref') {
      docBuffer.push(toLinesWithTrailingNewline(assetToPlaceholder(block)));
    } else if (block.type === 'math' || block.type === 'equation') {
      flushDocBuffer();
      cells.push(mathCell(cellId, block.latex.replace(/\r\n?/g, '\n').replace(/\u0000/g, '')));
      cellId += 1;
    } else {
      throw new Error(`Unsupported block type in mapper: ${block.type}`);
    }
  }

  flushDocBuffer();

  if (cells.length === 0) {
    throw new Error('Input produced no usable cells');
  }

  return cells;
}
