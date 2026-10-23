'use strict';

const form = document.getElementById('payment-form');
const submit = document.getElementById('submit');
const statusBox = document.getElementById('status');
const tokenBox = document.getElementById('token');
const metadata = document.getElementById('metadata');
const copyButton = document.getElementById('copy');
let ready = false;
let busy = false;
let timeout;
let generation = 0;
let tokenizer;

document.getElementById('origin').textContent = 'Origin: ' + location.origin;
document.getElementById('expiry').value = '12/' + String(new Date().getFullYear() + 2).slice(-2);

function setStatus(message, error = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle('error', error);
}

function resetResult() {
  tokenBox.value = '';
  metadata.textContent = 'No response yet.';
  copyButton.disabled = true;
}

function finish() {
  clearTimeout(timeout);
  busy = false;
  submit.disabled = !ready;
  submit.textContent = 'Generate token';
}

// Show only explicitly selected metadata, never a raw provider payload or PAN/CVV.
function safeMetadata(response) {
  const allowed = ['reasonCode', 'step', 'code', 'token', 'lastFour', 'bin', 'network',
    'cardNetwork', 'scheme', 'brand', 'cardBrand', 'cardType', 'type', 'issuer',
    'issuerName', 'issuerCountry'];
  const result = {};
  for (const [label, value] of Object.entries({ response, additionalData: response?.additionalData })) {
    if (!value || typeof value !== 'object') continue;
    result[label] = {};
    for (const key of allowed) {
      if (typeof value[key] === 'string' || typeof value[key] === 'number') {
        result[label][key] = value[key];
      }
    }
    result[label].otherFieldNames = Object.keys(value).filter(key => !allowed.includes(key));
  }
  return result;
}

document.getElementById('test-card').addEventListener('change', event => {
  if (event.target.value !== 'custom') document.getElementById('pan').value = event.target.value;
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!ready || busy || !form.reportValidity()) return;
  const publicKey = document.getElementById('public-key').value.trim();
  if (!publicKey) return setStatus('Sandbox public key is required.', true);
  resetResult();
  busy = true;
  const requestGeneration = ++generation;
  submit.disabled = true;
  submit.textContent = 'Generating...';
  setStatus('Waiting for Inyo...');
  timeout = setTimeout(() => {
    generation++;
    finish();
    setStatus('No response after 45 seconds. Check the browser Network tab for connectivity or origin errors. A token may still have been created.', true);
  }, 45000);
  try {
    tokenizer = new InyoTokenizer({
      targetId: '#payment-form',
      publicKey,
      storeLaterUse: true,
      threeDSData: { enable: false },
      successCallback(response) {
        if (requestGeneration !== generation) return;
        finish();
        metadata.textContent = JSON.stringify(safeMetadata(response), null, 2);
        const token = response?.additionalData?.token;
        if (response?.reasonCode === 'WAITING_TRANSACTION' && typeof token === 'string' && token) {
          tokenBox.value = token;
          copyButton.disabled = false;
          document.getElementById('cvv').value = '';
          setStatus('Token created. Card verification has not been performed.');
        } else {
          setStatus('Unexpected tokenizer response. Inspect the returned metadata.', true);
        }
      },
      errorCallback(error) {
        if (requestGeneration !== generation) return;
        finish();
        metadata.textContent = JSON.stringify(safeMetadata(error), null, 2);
        setStatus('Tokenization failed. Check the error code and browser Network tab; confirm this exact origin is allowlisted.', true);
      },
    });
    tokenizer.tokenizeCard();
  } catch {
    generation++;
    finish();
    setStatus('Tokenizer could not start. Check script loading and configuration.', true);
  }
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(tokenBox.value);
    setStatus('Token copied.');
  } catch {
    tokenBox.focus();
    tokenBox.select();
    setStatus('Clipboard unavailable. The token is selected for manual copying.');
  }
});

document.getElementById('clear').addEventListener('click', () => {
  generation++;
  finish();
  resetResult();
  setStatus(ready ? 'Ready.' : 'Tokenizer is not loaded.', !ready);
});

const script = document.createElement('script');
script.src = 'https://cdn.simpleps.com/sandbox/inyo.js';
script.onload = () => {
  ready = typeof InyoTokenizer === 'function';
  submit.disabled = !ready;
  setStatus(ready ? 'Ready.' : 'Script loaded, but InyoTokenizer was not found.', !ready);
};
script.onerror = () => setStatus('Unable to load the Inyo sandbox script. Check connection or browser blocking.', true);
document.head.appendChild(script);
