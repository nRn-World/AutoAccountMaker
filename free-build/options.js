const emailProvider = document.getElementById('emailProvider');
const rapidApiSection = document.getElementById('rapidApiSection');
const rapidApiKey = document.getElementById('rapidApiKey');
const languageSelect = document.getElementById('language');
const saveStatus = document.getElementById('saveStatus');

// OBS: retentionSelect deklareras INTE här. vault.js:9 deklarerar den (med
// samma id) och laddas på samma sida. Två globala "const retentionSelect" ger
// SyntaxError: Identifier has already been declared, och då dör BÅDA skripten.
// Låt vault.js äga retention-rutan.

function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// t() kommer från i18n.js och är en global funktion. Deklarera den inte på nytt
// — det kastar en SyntaxError i global scope och dödar hela skriptet.

/** Fyller språklistan med de sju stödda språken, med engelska först. */
function buildLanguageOptions(selected) {
  if (!languageSelect) return;
  languageSelect.innerHTML = '';
  for (const lang of I18N.SUPPORTED_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang;
    // Språknamnet visas alltid på sitt eget språk, som det ska.
    opt.textContent = I18N.LANGUAGE_NAMES[lang];
    if (lang === selected) opt.selected = true;
    languageSelect.appendChild(opt);
  }
}

function toggleRapidApi() {
  if (!rapidApiSection || !emailProvider) return;
  rapidApiSection.style.display = emailProvider.value === 'tempmail' ? 'block' : 'none';
}

function flashSaved(message) {
  if (!saveStatus) return;
  saveStatus.textContent = message;
  saveStatus.classList.add('visible');
  setTimeout(() => saveStatus.classList.remove('visible'), 2000);
}

emailProvider?.addEventListener('change', toggleRapidApi);

// Ändras språket direkt, utan att man behöver spara först. Popupen lyssnar på
// samma storage-nyckel och uppdateras direkt, så bytet slår igenom överallt
// utan att någon sida behöver laddas om.
languageSelect?.addEventListener('change', async () => {
  const chosen = languageSelect.value;
  const current = await sendMsg({ action: 'getSettings' });
  await sendMsg({
    action: 'saveSettings',
    settings: { ...(current?.settings || {}), language: chosen },
  });
  I18N.applyTranslations(document, chosen);
  // Bygg om listan så att det nya språket markeras, och översätt de texter
  // som inte bärs av data-i18n.
  buildLanguageOptions(chosen);
  flashSaved(t('options.saved'));
});

document.getElementById('btnSave')?.addEventListener('click', async () => {
  const current = await sendMsg({ action: 'getSettings' });
  await sendMsg({
    action: 'saveSettings',
    settings: {
      ...(current?.settings || {}),
      emailProvider: emailProvider ? emailProvider.value : (current?.settings?.emailProvider || 'mailtm'),
      rapidApiKey: rapidApiKey ? rapidApiKey.value.trim() : (current?.settings?.rapidApiKey || ''),
      language: languageSelect ? languageSelect.value : (current?.settings?.language || 'en'),
    },
  });
  flashSaved(t('options.saved'));
});

async function load() {
  await I18N.initI18n();
  const res = await sendMsg({ action: 'getSettings' });
  if (!res?.success) return;
  const s = res.settings;

  buildLanguageOptions(s.language || 'en');

  if (emailProvider) emailProvider.value = s.emailProvider || 'mailtm';
  if (rapidApiKey) rapidApiKey.value = s.rapidApiKey || '';
  toggleRapidApi();
}

load();
