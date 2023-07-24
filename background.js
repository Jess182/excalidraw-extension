// @ts-check

const GIST_TOKEN = 'gist-token';
const GIST_URL = 'gist-url';

chrome.runtime.onMessage.addListener(({ event, value }) => {
  switch (event) {
    case 'create:gist':
      createGist(value.revisions);
      break;
    case 'import:gist':
      getPrivateGistContent(value.gistUrl);
      break;
    case 'reload:page':
      reloadPage();
      break;
    case 'update:gist':
      updateGist(value.gistUrl, value.revisions);
      break;
    default:
      break;
  }
});

/* ######## UTILS ######## */

function reloadPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (arrayOfTabs) => {
    chrome.tabs.reload(arrayOfTabs[0].id);
  });
}

function showNotification(message) {
  new Notification(message);
}

function sendEvent(event, value) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      event,
      value,
    });
  });
}

/* ######## GITHUB ######## */

async function createGist(content, filename, description) {
  filename = `excalidraw-revisions`;

  description = `Gist generated by excalidraw revisions extension`;

  const apiUrl = 'https://api.github.com/gists';

  const { [GIST_TOKEN]: token } = await chrome.storage.local.get(GIST_TOKEN);

  const headers = new Headers({
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  });

  const data = {
    description: description,
    public: false,
    files: {
      [filename]: {
        content:
          typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2),
      },
    },
  };

  const requestOptions = {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(apiUrl, requestOptions);
    const gistData = await response.json();

    if (gistData.message) throw new Error(gistData.message);

    const gistUrl = gistData.html_url;

    chrome.storage.local
      .set({
        [GIST_URL]: gistUrl,
      })
      .catch((e) => console.error(e));

    sendEvent('copy:gistUrl', { gistUrl });
  } catch (error) {
    console.error('Error to create gist:', error);
  }
}

async function getPrivateGistContent(gistUrl) {
  const { [GIST_TOKEN]: token } = await chrome.storage.local.get(GIST_TOKEN);

  const headers = new Headers({
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  });

  try {
    const gistId = gistUrl.split('/').pop();

    const apiUrl = `https://api.github.com/gists/${gistId}`;

    const requestOptions = {
      method: 'GET',
      headers: headers,
    };

    const response = await fetch(apiUrl, requestOptions);
    const gistData = await response.json();

    if (gistData.message) throw new Error(gistData.message);

    const filename = Object.keys(gistData.files)[0];

    const revisions = gistData.files[filename].content;

    sendEvent('import:revisions', { revisions });
  } catch (error) {
    console.error('Error to get gist:', error);
  }
}

async function updateGist(gistUrl, content, filename, description) {
  filename = `excalidraw-revisions`;

  description = `Gist updated by excalidraw revisions extension`;

  const gistId = gistUrl.split('/').pop();

  const apiUrl = `https://api.github.com/gists/${gistId}`;

  const { [GIST_TOKEN]: token } = await chrome.storage.local.get(GIST_TOKEN);

  const headers = new Headers({
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  });

  const data = {
    description: description,
    public: false,
    files: {
      [filename]: {
        content:
          typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2),
      },
    },
  };

  const requestOptions = {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(apiUrl, requestOptions);
    const gistData = await response.json();

    if (gistData.message) throw new Error(gistData.message);

    sendEvent('copy:gistUrl', { gistUrl: gistData.html_url });
  } catch (error) {
    console.error('Error to update gist:', error);
  }
}
