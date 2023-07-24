// @ts-check

const DEFAULT_KEY = 'excalidraw';
const DELAY = 500;
const REVISIONS_KEY = 'excalidraw-revisions';
const THEME_KEY = 'excalidraw-theme';

chrome.runtime.onMessage.addListener(({ event, value }) => {
  switch (event) {
    case 'change:revision':
      changeRevision(value.revision);
      break;
    case 'generate:revision':
      generateRevision();
      break;
    case 'clear:revisions':
      clearRevisions();
      break;
    case 'create:gist':
      createGist();
      break;
    case 'update:gist':
      updateGist(value.gistUrl);
      break;
    case 'copy:gistUrl':
      copyGistUrl(value.gistUrl);
      break;
    case 'copy:revisions':
      copyToClipboard();
      break;
    case 'paste:revisions':
      pasteFromClipboard();
      break;
    case 'download:revisions':
      downloadRevisions();
      break;
    case 'import:revisions':
      importRevisions(value.revisions);
      break;
    default:
      break;
  }
});

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadRevisions();
  listenThemeToggle();
});

/* ######## UTILS ######## */

const storage = new Proxy(localStorage, {
  get: (target, prop, receiver) => {
    const targetValue = Reflect.get(target, prop, receiver);

    if (!targetValue) return targetValue;

    if (typeof targetValue !== 'function') {
      try {
        return JSON.parse(targetValue);
      } catch {
        return targetValue;
      }
    }

    return function (...args) {
      let result;

      switch (prop) {
        case 'getItem':
          result = targetValue.apply(localStorage, args);
          if (result) result = JSON.parse(result);
          break;
        case 'setItem':
          if (args[1] && typeof args[1] !== 'string')
            args[1] = JSON.stringify(args[1]);
          result = targetValue.apply(localStorage, args);
          break;
        default:
          result = targetValue.apply(localStorage, args);
          break;
      }

      return result;
    };
  },
});

function notifyMe(message) {
  let notification;

  document.body.focus();

  if (!('Notification' in window)) {
    alert('This browser does not support desktop notification');
  } else if (Notification.permission === 'granted') {
    notification = new Notification(message);
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        notification = new Notification(message);
      }
    });
  }

  if (notification) {
    notification.addEventListener('click', () => document.body.focus());
    notification.addEventListener('close', () => document.body.focus());
  }
}

function sendEvent(event, value) {
  chrome.runtime.sendMessage({
    event,
    value,
  });
}

/* ######## THEME ######## */

function delayLoadTheme() {
  setTimeout(() => {
    const theme = storage[THEME_KEY];

    if (theme)
      chrome.storage.local
        .set({
          [THEME_KEY]: theme,
        })
        .catch((e) => console.error(e));
  }, DELAY);
}

function listenThemeToggle() {
  setTimeout(() => {
    document
      .querySelector('[data-testid=main-menu-trigger]')
      ?.addEventListener('click', () => {
        setTimeout(() => {
          document
            .querySelector('[data-testid=toggle-dark-mode]')
            ?.addEventListener('click', delayLoadTheme);
        });
      });
  }, DELAY);
}

function loadTheme() {
  const theme = storage[THEME_KEY];

  if (theme)
    chrome.storage.local
      .set({
        [THEME_KEY]: theme,
      })
      .catch((e) => console.error(e));
}

/* ######## REVISIONS ######## */

function changeRevision(revision) {
  if (!confirm(`Are you sure to change to revision "${revision}"?`)) return;

  storage.setItem(DEFAULT_KEY, storage[REVISIONS_KEY][revision].elements);

  sendEvent('reload:page');
}

function clearRevisions() {
  if (!confirm(`Are you sure to clear revisions?`)) return;

  storage.removeItem(REVISIONS_KEY);

  chrome.storage.local.remove(REVISIONS_KEY).catch((e) => console.error(e));

  sendEvent('clear:revisionsSelect');
}

function copyToClipboard() {
  const revisions = storage[REVISIONS_KEY];

  if (!revisions) return;

  document.body.focus();

  navigator.clipboard
    .writeText(JSON.stringify(revisions, null, 2))
    .then(() => notifyMe('Revisions copied to clipboard'))
    .catch((e) => console.error(e));
}

function diffGuard(currentState, revision) {
  if (
    JSON.stringify(currentState.elements) === JSON.stringify(revision.elements)
  ) {
    console.info('Skip save new revision because it is same as last');
    return false;
  }

  // TODO: validate files

  return true;
}

function downloadRevisions() {
  const revisions = storage[REVISIONS_KEY];

  if (!revisions) return;

  const json =
    'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(revisions, null, 2));

  const downloadAnchorNode = document.createElement('a');

  downloadAnchorNode.setAttribute('href', json);
  downloadAnchorNode.setAttribute(
    'download',
    `excalidraw-revisions-${Date.now()}` + '.json'
  );

  document.body.appendChild(downloadAnchorNode);

  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function generateRevision() {
  if (!storage[REVISIONS_KEY]) storage.setItem(REVISIONS_KEY, {});

  const revisions = storage[REVISIONS_KEY];

  const versionKeys = Object.keys(revisions);

  const currentDiagram = storage[DEFAULT_KEY];

  let lastVersion;

  if (versionKeys.length) {
    lastVersion = Math.max(...versionKeys);

    if (!diffGuard({ elements: currentDiagram }, revisions[lastVersion]))
      return;
  }

  revisions[lastVersion + 1 || 0] = {
    type: 'excalidraw',
    elements: currentDiagram,
    files: {}, // TODO: get files from IndexedDB
  };

  storage.setItem(REVISIONS_KEY, revisions);

  loadRevisions(revisions);

  sendEvent('update:revisionsSelect', { revisions: Object.keys(revisions) });
}

function importRevisions(revisions) {
  revisions = parseRevisions(revisions);

  if (!revisions) return;

  storage.setItem(REVISIONS_KEY, revisions);

  loadRevisions(revisions);

  sendEvent('update:revisionsSelect', { revisions: Object.keys(revisions) });

  notifyMe('Revisions imported correctly');
}

function loadRevisions(revisions) {
  const keys = Object.keys(revisions || storage[REVISIONS_KEY] || {});

  chrome.storage.local
    .set({
      [REVISIONS_KEY]: keys,
    })
    .catch((e) => console.error(e));
}

function parseRevisions(revisions) {
  try {
    revisions = JSON.parse(revisions);

    if (!Object.keys(revisions).length) {
      console.info('Object is empty.');
      return null;
    }

    for (let i = 0; i < Object.keys(revisions).length; i++) {
      if (revisions[i].type !== 'excalidraw' || !revisions[i].elements.length) {
        console.info(`Element '${i}' has incorrect structure`);
        return null;
      }
    }

    return revisions;
  } catch {
    console.info('String can not parse.');
    return null;
  }
}

function pasteFromClipboard() {
  navigator.clipboard
    .readText()
    .then((clipText) => {
      const revisions = parseRevisions(clipText);

      if (!revisions) return;

      storage.setItem(REVISIONS_KEY, revisions);

      loadRevisions(revisions);

      notifyMe('Revisions copied to clipboard');
    })
    .catch((e) => console.error(e));
}

function createGist() {
  const revisions = storage[REVISIONS_KEY];

  if (!revisions) return;

  sendEvent('create:gist', { revisions });
}

function updateGist(gistUrl) {
  const revisions = storage[REVISIONS_KEY];

  if (!revisions) return;

  sendEvent('update:gist', { gistUrl, revisions });
}

/* ######## GIST ######## */

function copyGistUrl(gistUrl) {
  navigator.clipboard
    .writeText(gistUrl)
    .then(() => notifyMe('Gist url copied to clipboard'))
    .catch((e) => console.error(e));
}
