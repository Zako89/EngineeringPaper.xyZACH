const jsonInput = document.getElementById('jsonInput');
const convertButton = document.getElementById('convertButton');
const downloadButton = document.getElementById('downloadButton');
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

async function convert() {
  clearMessages();
  downloadButton.disabled = true;
  latestOutputText = null;

  const inputText = jsonInput.value;

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputText })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      showError(data.error || 'Conversion failed.');
      return;
    }

    latestOutputText = data.outputText;
    latestFilename = data.suggestedFilename || 'output.epxyz';
    downloadButton.disabled = false;
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

convertButton.addEventListener('click', convert);
downloadButton.addEventListener('click', download);
