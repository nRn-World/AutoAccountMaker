/**
 * background.js for the store build.
 *
 * This is the whole file. The private extension in extension/ has a background
 * worker full of account creation: generating a fake identity, creating a
 * temporary e mail account, polling the inbox for a verification code, opening
 * the verification link and marking the account as verified. None of that ships
 * here, and none of it can be re enabled, because the worker below only stores
 * and returns settings.
 *
 * What it does do:
 *   - keeps the details the user saved in Settings, so the popup and the
 *     content script agree on what to fill in
 *   - fills in the gaps with empty strings, so the content script never has to
 *     invent a name, an address, a date of birth or a password
 *   - handles a small message API the popup uses
 *
 * There is no network code in this file at all, which is the easiest thing to
 * verify when the store reviews it.
if (typeof importScripts === 'function') {
  importScripts('cooldown.js');
}

const STORAGE_KEY = 'details';
const LANGUAGE_KEY = 'settings';

// What the content script needs. A field the user has not filled in stays an
// empty string on purpose, so nothing is ever invented.
const DETAIL_FIELDS = [
  'email',
  'password',
  'firstName',
  'lastName',
  'fullName',
  'username',
  'phone',
  'address',
  'city',
  'zip',
  'region',
  'country',
  'birthDate',
  'birthDay',
  'birthMonth',
  'birthYear',
  'gender',
  'company',
  'jobTitle',
  'website',
  'bio',
];

function emptyDetails() {
  const out = {};
  for (const f of DETAIL_FIELDS) out[f] = '';
  return out;
}

async function getDetails() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEY]: emptyDetails() });
  return { ...emptyDetails(), ...(stored[STORAGE_KEY] || {}) };
}

async function saveDetails(patch) {
  const current = await getDetails();
  const next = { ...current };
  for (const key of Object.keys(patch || {})) {
    if (DETAIL_FIELDS.includes(key)) next[key] = String(patch[key] ?? '');
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

async function getSettings() {
  const stored = await chrome.storage.local.get({
    [LANGUAGE_KEY]: { language: 'en' },
  });
  return { language: stored[LANGUAGE_KEY]?.language || 'en' };
}

async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...(patch || {}) };
  await chrome.storage.local.set({ [LANGUAGE_KEY]: next });
  return next;
}

/** Which details are set, so the popup can warn before an empty fill. */
function filledCount(details) {
  let n = 0;
  for (const f of DETAIL_FIELDS) if (details[f]) n++;
  return n;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getDetails':
          sendResponse({ success: true, details: await getDetails(), filled: filledCount(await getDetails()) });
          return;

        case 'saveDetails':
          sendResponse({ success: true, details: await saveDetails(request.details) });
          return;

        case 'getSettings':
          sendResponse({ success: true, settings: await getSettings() });
          return;

        case 'saveSettings':
          sendResponse({ success: true, settings: await saveSettings(request.settings) });
          return;

        case 'canStartRun': {
          // The rate limit from cooldown.js. Kept, because pacing repeated
          // fills is polite to the site and to the user.
          const canStart = await canStartRun();
          sendResponse({ success: true, canStart });
          return;
        }

        case 'consumeRunSlot': {
          const slot = await consumeFreeRunSlot();
          sendResponse({ success: slot.allowed, ...slot });
          return;
        }

        default:
          sendResponse({ success: false, errorCode: 'unknownAction', error: 'Unknown action.' });
      }
    } catch (err) {
      sendResponse({ success: false, errorCode: err?.errorCode || 'generic', error: err.message || String(err) });
    }
  })();
  return true;
});
