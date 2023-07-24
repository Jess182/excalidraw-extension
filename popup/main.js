// @ts-check

const GIST_DOMAIN = 'gist.github.com';
const GIST_TOKEN = 'gist-token';
const GIST_URL = 'gist-url';
const REVISIONS_KEY = 'excalidraw-revisions';
const revisionsSelectorKey = 'revisions-selector';
const THEME_KEY = 'excalidraw-theme';

let select,
  addRevisionBtn,
  clearRevisionsBtn,
  gistInput,
  saveBtn,
  saveBtnText,
  importBtn,
  copyBtn,
  pasteBtn,
  downloadBtn,
  uploadBtn,
  uploadInput;

chrome.runtime.onMessage.addListener(({ event, value }) => {
  switch (event) {
    case 'clear:revisionsSelect':
      clearRevisionsSelect();
      break;
    case 'update:gistInput':
      updateGistInput(value.gistUrl);
      break;
    case 'update:revisionsSelect':
      updateRevisionsSelect(value.revisions);
      break;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  select = document.getElementById(revisionsSelectorKey);
  addRevisionBtn = document.getElementById('add-revision-btn');
  clearRevisionsBtn = document.getElementById('clear-revisions-btn');

  gistInput = document.getElementById('gist-input');
  saveBtn = document.getElementById('save-btn');
  saveBtnText = document.getElementById('save-btn-text');
  importBtn = document.getElementById('import-btn');

  copyBtn = document.getElementById('copy-btn');
  pasteBtn = document.getElementById('paste-btn');
  downloadBtn = document.getElementById('download-btn');
  uploadBtn = document.getElementById('upload-btn');
  uploadInput = document.getElementById('upload-input');

  chrome.storage.local
    .get([THEME_KEY, REVISIONS_KEY, GIST_TOKEN, GIST_URL])
    .then(dynamicRender);

  document.addEventListener('input', function (event) {
    // Only run on our select menu
    if (event.target.id !== revisionsSelectorKey || !event.target.value) return;

    sendEvent('change:revision', { revision: event.target.value });
  });

  addRevisionBtn?.addEventListener('click', () => {
    sendEvent('generate:revision');
  });

  clearRevisionsBtn?.addEventListener('click', () => {
    sendEvent('clear:revisions');
  });

  gistInput?.addEventListener('keyup', (event) => {
    const saveBtnText = document.querySelector('#save-btn-text');

    if (event.target.value) {
      saveBtnText.textContent = 'Update';
      importBtn.style.display = 'block';
    } else {
      saveBtnText.textContent = 'Save';
      importBtn.style.display = 'none';
    }
  });

  saveBtn?.addEventListener('click', () => {
    const gistUrl = gistInput.value?.trim();

    if (gistUrl && !gistUrl.includes(GIST_DOMAIN))
      console.info(`Incorrect domain for url: ${gistUrl}`);

    const event = gistUrl ? 'update:gist' : 'create:gist';

    sendEvent(event, { gistUrl }, true);
  });

  importBtn?.addEventListener('click', importGist);

  copyBtn?.addEventListener('click', () => {
    sendEvent('copy:revisions', null, true);
  });

  pasteBtn.addEventListener('click', () => {
    sendEvent('paste:revisions', null, true);
  });

  downloadBtn?.addEventListener('click', () => {
    sendEvent('download:revisions');
  });

  uploadBtn?.addEventListener('click', () => {
    uploadInput?.click();
  });

  uploadInput?.addEventListener('change', (e) => {
    if (!e.target.files.length) return;

    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = (event) =>
      sendEvent('import:revisions', { revisions: event.target.result });
    reader.readAsText(file);
  });
});

/* ######## UTILS ######## */

function sendEvent(event, value, closePopup = false) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      event,
      value,
    });
  });

  if (closePopup) window.close();
}

function dynamicRender(data) {
  const theme = data[THEME_KEY];
  const revisions = data[REVISIONS_KEY];
  const gistToken = data[GIST_TOKEN];
  const gistUrl = data[GIST_URL];

  if (theme === 'light') document.body.setAttribute('data-theme', 'light');

  if (select && revisions) updateRevisionsSelect(revisions);

  if (!gistToken) {
    const githubDiv = document.querySelector('.github');

    if (githubDiv) githubDiv.style.display = 'none';
  }

  if (gistUrl) {
    updateGistInput(gistUrl);
    saveBtnText.textContent = 'Update';
  }

  if (!gistInput.value?.trim()) importBtn.style.display = 'none';
}

/* ######## REVISIONS ######## */

function clearRevisionsSelect() {
  if (select) {
    for (let i = select.options.length - 1; i > 0; i--) {
      select.remove(i);
    }
  }
}

function updateRevisionsSelect(revisions) {
  clearRevisionsSelect();

  revisions.forEach((revision) => {
    const el = document.createElement('option');
    el.textContent = revision;
    el.value = revision;
    select.appendChild(el);
  });
}

/* ######## GIST ######## */

async function importGist() {
  const gistUrl = gistInput.value?.trim();

  if (gistUrl && !gistUrl.includes(GIST_DOMAIN))
    console.info(`Incorrect domain for url: ${gistUrl}`);

  if (!gistUrl) return;

  chrome.runtime.sendMessage({
    event: 'import:gist',
    value: { gistUrl },
  });
}

function updateGistInput(value) {
  if (gistInput) {
    gistInput.value = value;
    gistInput.dispatchEvent(new Event('keyup'));
  }
}
