// @ts-check

const GIST_TOKEN = 'gist-token';
const THEME_KEY = 'excalidraw-theme';

document.addEventListener('DOMContentLoaded', () => {
  const gistInput = document.getElementById('gist-input');
  const saveBtn = document.getElementById('save-btn');
  const removeBtn = document.getElementById('remove-btn');

  chrome.storage.local.get([GIST_TOKEN, THEME_KEY]).then((data) => {
    if (data[GIST_TOKEN]) {
      gistInput.value = data[GIST_TOKEN];
    }

    if (data[THEME_KEY] === 'light')
      document.body.setAttribute('data-theme', 'light');
  });

  saveBtn?.addEventListener('click', () => {
    const token = gistInput.value?.trim();

    if (token)
      chrome.storage.local
        .set({
          [GIST_TOKEN]: token,
        })
        .catch((e) => console.error(e));
  });

  removeBtn?.addEventListener('click', () => {
    const token = gistInput.value?.trim();

    if (!token) return;

    gistInput.value = '';

    chrome.storage.local.remove(GIST_TOKEN).catch((e) => console.error(e));
  });
});
