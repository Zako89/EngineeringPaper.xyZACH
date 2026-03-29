const jsonInput = document.getElementById('jsonInput');
const outputPreview = document.getElementById('outputPreview');
const convertButton = document.getElementById('convertButton');
const downloadButton = document.getElementById('downloadButton');
const copyButton = document.getElementById('copyButton');
const openInEngineeringPaperButton = document.getElementById('openInEngineeringPaperButton');
const strictValidation = document.getElementById('strictValidation');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const errorArea = document.getElementById('error');
const statusArea = document.getElementById('status');

let latestOutputText = null;
let latestFilename = 'output.epxyz';

function clearMessages() {
  errorArea.textContent = '';
  statusArea.textContent = '';
}

function showError(message) {
  errorArea.textContent = message;
  statusArea.textContent = '';
}

function showStatus(message) {
  statusArea.textContent = message;
  errorArea.textContent = '';
}

function setOutputState(outputText, filename) {
  latestOutputText = outputText || null;
  if (filename) {
    latestFilename = filename;
  }
  outputPreview.value = latestOutputText || '';

  const hasValidOutput = Boolean(latestOutputText);
  downloadButton.disabled = !hasValidOutput;
  copyButton.disabled = !hasValidOutput;
  openInEngineeringPaperButton.disabled = !hasValidOutput;
}

function resetOutputState() {
  setOutputState(null);
}

function onInputMutated() {
  if (latestOutputText !== null) {
    resetOutputState();
    showStatus('Input changed. Convert again to regenerate output.');
  }
}

function isSupportedFile(file) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith('.txt') || lowerName.endsWith('.json');
}

async function loadFileToInput(file) {
  if (!file) {
    return;
  }

  if (!isSupportedFile(file)) {
    showError('Unsupported file type. Please choose a .txt or .json file.');
    fileStatus.textContent = '';
    return;
  }

  try {
    const text = await file.text();
    jsonInput.value = text;
    fileStatus.textContent = `Loaded file: ${file.name}`;
    clearMessages();
    onInputMutated();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to read file.');
  }
}

async function convert() {
  clearMessages();
  resetOutputState();

  const inputText = jsonInput.value;

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputText,
        strictValidation: strictValidation.checked
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      showError(data.error || 'Conversion failed.');
      return;
    }

    setOutputState(data.outputText, data.suggestedFilename || 'output.epxyz');
    showStatus(`Converted successfully: ${data.title} (${data.cellCount} cells). Ready to download ${latestFilename}.`);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Request failed.');
  }
}

function download() {
  if (!latestOutputText) {
    showError('Nothing to download yet. Convert valid JSON first.');
    return;
  }

  const blob = new Blob([latestOutputText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = latestFilename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyOutput() {
  if (!latestOutputText) {
    showError('Nothing to copy yet. Convert valid JSON first.');
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(latestOutputText);
      showStatus('Output copied to clipboard.');
      return;
    }

    outputPreview.focus();
    outputPreview.select();
    const copied = document.execCommand('copy');
    outputPreview.setSelectionRange(0, 0);

    if (copied) {
      showStatus('Output copied to clipboard.');
    } else {
      showError('Clipboard access is unavailable in this browser.');
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Failed to copy output.');
  }
}



function openInEngineeringPaper() {
  if (!latestOutputText) {
    showError('Nothing to open yet. Convert valid JSON first.');
    return;
  }

  const openedWindow = window.open('https://engineeringpaper.xyz/', '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    showError('EngineeringPaper.xyz launch was blocked by your browser popup settings. Allow popups and try again.');
    return;
  }

  // EngineeringPaper.xyz currently supports local file picker / drag-drop opening and share-link hashes,
  // but does not expose a documented browser-to-browser import handoff endpoint or postMessage receiver.
  // Keep the generated output untouched and guide users to Copy/Download workflows.
  showStatus('Opened EngineeringPaper.xyz in a new tab. Direct auto-import from this converter is not currently supported; use Copy output or Download .epxyz.');
}

function setDropZoneActive(active) {
  dropZone.classList.toggle('drag-active', active);
}

function handleDrop(event) {
  event.preventDefault();
  setDropZoneActive(false);
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return;
  }
  loadFileToInput(files[0]);
}

function openFilePicker() {
  fileInput.click();
}

jsonInput.addEventListener('input', onInputMutated);
convertButton.addEventListener('click', convert);
downloadButton.addEventListener('click', download);
copyButton.addEventListener('click', copyOutput);
openInEngineeringPaperButton.addEventListener('click', openInEngineeringPaper);

dropZone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  setDropZoneActive(true);
});

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  setDropZoneActive(true);
});

dropZone.addEventListener('dragleave', (event) => {
  if (!dropZone.contains(event.relatedTarget)) {
    setDropZoneActive(false);
  }
});

dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', openFilePicker);
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openFilePicker();
  }
});

fileInput.addEventListener('change', () => {
  loadFileToInput(fileInput.files?.[0]);
  fileInput.value = '';
});

resetOutputState();
