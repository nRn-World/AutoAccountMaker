/**
 * options.js for the store build.
 *
 * Reads and writes the details the popup fills in with. Two things matter
 * for the store review and for the user:
 *
 *   1. The values never leave the browser. There is no fetch in this file.
 *   2. A field the user leaves empty stays an empty string, so the content
 *      script never has to invent a value for it.
 */
const FIELDS = [
  ['detFirstName', 'firstName'],
  ['detLastName', 'lastName'],
  ['detEmail', 'email'],
  ['detUsername', 'username'],
  ['detPassword', 'password'],
  ['detPhone', 'phone'],
  ['detAddress', 'address'],
  ['detCity', 'city'],
  ['detZip', 'zip'],
  ['detCountry', 'country'],
  ['detBirthDate', 'birthDate'],
  ['detGender', 'gender'],
  ['detCompany', 'company'],
  ['detJobTitle', 'jobTitle'],
];

const languageSelect = document.getElementById('language');
const saveStatus = document.getElementById('saveStatus');
const filledCount = document.getElementById('filledCount');

function el(id) { return document.getElementById(id); }

function readForm() {
  const out = {};
  for (const [id, key] of FIELDS) out[key] = el(id)?.value ?? '';
  return out;
}

function writeForm(details) {
  for (const [id, key] of FIELDS) {
    const node = el(id);
    if (node) node.value = details[key] ?? '';
  }
}

function showCount(details) {
  if (!filledCount) return;
  const n = FIELDS.filter(([, key]) => details[key]).length;
  filledCount.textContent = t('details.filledCount', n, FIELDS.length);
}

async function load() {
  const res = await chrome.runtime.sendMessage({ action: 'getDetails' });
  writeForm(res?.details || {});
  showCount(res?.details || {});
}

async function save() {
  const details = readForm();

  // fullName is derived, so the content script does not have to guess.
  if (!details.fullName) {
    details.fullName = [details.firstName, details.lastName].filter(Boolean).join(' ');
  }

  // A plain YYYY-MM-DD date is also split into parts, because many forms ask
  // for day, month and year in three separate boxes.
  if (details.birthDate && !details.birthYear) {
    const m = String(details.birthDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      details.birthYear = m[1];
      details.birthMonth = m[2];
      details.birthDay = m[3];
    }
  }

  const res = await chrome.runtime.sendMessage({ action: 'saveDetails', details });
  showCount(res?.details || details);

  if (saveStatus) {
    saveStatus.style.display = 'block';
    saveStatus.textContent = t('options.saved');
    setTimeout(() => { if (saveStatus) saveStatus.style.display = 'none'; }, 1600);
  }
}

el('btnSave')?.addEventListener('click', save);

if (languageSelect) {
  languageSelect.addEventListener('change', async (e) => {
    const lang = e.target.value;
    await chrome.storage.local.set({ settings: { language: lang } });
    if (typeof setLanguage === 'function') setLanguage(lang);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.details) {
    writeForm({ ...readForm(), ...(changes.details.newValue || {}) });
  }
});

(async () => {
  await initI18n();
  await load();
})();
