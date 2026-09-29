/**
 * popup.js for the store build.
 *
 * Two buttons, and that is the whole product surface:
 *
 *   Fill the form   types the details from Settings into the fields that are
 *                   on the page right now, and stops
 *   Fill a login    the same, for a login form
 *
 * It never submits, never ticks a checkbox, never opens a link and never
 * reads a code off the screen. The popup lists the checkboxes the site still
 * wants, so the user knows what is left to do, and that is all.
 */
const statusText = document.getElementById('status');
const btnFill = document.getElementById('btnFill');
const btnLogin = document.getElementById('btnLogin');
const btnSettings = document.getElementById('btnSettings');
const logBox = document.getElementById('log');
const languageSelect = document.getElementById('languageSelect');

let currentTab = null;

function log(text, kind = 'info') {
  const line = document.createElement('div');
  line.className = 'log-line ' + kind;
  line.textContent = text;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

function clearLog() {
  logBox.innerHTML = '';
}

async function sendToTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // The content script is not in this tab yet, so put it there and retry.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (e) {
      return { success: false, errorCode: 'injectFailed', error: e.message };
    }
    try {
      return await chrome.tabs.sendMessage(tabId, msg);
    } catch {
      return { success: false, errorCode: 'injectFailed' };
    }
  }
}

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text, kind = '') {
  statusText.textContent = text;
  statusText.className = 'status ' + kind;
}

/** Which saved details are still empty, so the popup can say so up front. */
async function emptyDetails() {
  const res = await chrome.runtime.sendMessage({ action: 'getDetails' });
  const details = res?.details || {};
  return Object.keys(details).filter((k) => !details[k]);
}

function describeCheckboxes(list) {
  if (!list || !list.length) return null;
  return list
    .map((c) => (c.label || c.id || 'checkbox'))
    .slice(0, 4)
    .join(', ');
}

async function run(mode) {
  clearLog();

  const tab = currentTab || (await getTab());
  if (!tab?.id) {
    setStatus(t('popup.noTab'), 'error');
    return;
  }
  if (!/^https?:/.test(tab.url || '')) {
    setStatus(t('popup.notAWebPage'), 'error');
    return;
  }

  // The rate limit from cooldown.js. Three fills an hour is plenty for a person
  // and keeps the extension from hammering any single site.
  const slot = await chrome.runtime.sendMessage({ action: 'consumeRunSlot' });
  if (!slot?.allowed) {
    setStatus(t('popup.cooldownBlocked', slot?.remainingLabel || ''), 'error');
    return;
  }

  setStatus(t(mode === 'login' ? 'popup.fillingLogin' : 'popup.filling'), '');
  await sendToTab(tab.id, { action: 'ping' });

  const res = await sendToTab(tab.id, {
    action: mode === 'login' ? 'fillLogin' : 'fillRegistration',
  });

  if (!res?.success || res?.result?.noForm) {
    setStatus(t('popup.noForm'), 'error');
    log(t('popup.noFormHint'), 'info');
    return;
  }

  const r = res.result;
  const filledNames = Object.keys(r.filled || {}).filter((k) => r.filled[k]);
  if (!filledNames.length) {
    setStatus(t('popup.nothingFilled'), 'error');
    log(t('popup.noFormHint'), 'info');
    return;
  }

  setStatus(t('popup.filledCount', filledNames.length), 'ok');
  log(t('popup.filledList', filledNames.join(', ')), 'ok');

  if (r.missing && r.missing.length) {
    log(t('popup.missingList', r.missing.join(', ')), 'warn');
  }

  // We report the boxes, we never tick them.
  const boxes = describeCheckboxes(r.checkboxes);
  if (boxes) {
    log(t('popup.stillToTick', boxes), 'warn');
  }

  setStatus(t('popup.yourTurn'), 'ok');
  log(t('popup.submitYourself'), 'info');
}

btnFill.addEventListener('click', () => run('register'));
btnLogin.addEventListener('click', () => run('login'));

btnSettings.addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  else window.open(chrome.runtime.getURL('options.html'));
});

async function initLanguage() {
  if (!languageSelect) return;
  languageSelect.addEventListener('change', async (e) => {
    const lang = e.target.value;
    await chrome.storage.local.set({ settings: { language: lang } });
    if (typeof setLanguage === 'function') setLanguage(lang);
  });
  await initI18n();
}

(async () => {
  await initLanguage();
  currentTab = await getTab();

  // If nothing is saved yet, say that before the user presses a button,
  // because an empty fill looks like a broken extension.
  const empty = await emptyDetails();
  if (empty.length) {
    setStatus(t('popup.nothingSaved'), 'error');
    log(t('popup.nothingSavedHint'), 'info');
    btnFill.disabled = true;
    btnLogin.disabled = true;
  } else {
    setStatus(t('popup.ready'), '');
  }
})();
