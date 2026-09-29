const emailProvider = document.getElementById('emailProvider');
const rapidApiSection = document.getElementById('rapidApiSection');
const rapidApiKey = document.getElementById('rapidApiKey');
const languageSelect = document.getElementById('language');
const saveStatus = document.getElementById('saveStatus');

// NOTE: retentionSelect is deliberately NOT declared here. vault.js declares it
// from the same id, and both scripts load on the same page. Two global
// "const retentionSelect" declarations throw
// SyntaxError: Identifier has already been declared, which kills BOTH scripts.
// Let vault.js own the retention control.

function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// t() comes from i18n.js and is a global function. Do not declare it again,
// that throws a SyntaxError in global scope and kills the whole script.

/** Fills the language list with the seven supported languages, English first. */
function buildLanguageOptions(selected) {
  if (!languageSelect) return;
  languageSelect.innerHTML = '';
  for (const lang of I18N.SUPPORTED_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang;
    // The language name is always shown in its own language, as it should be.
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

// The language applies immediately, with no need to save first. The popup
// listens to the same storage key and updates straight away, so the change
// takes effect everywhere without any page being reloaded.
languageSelect?.addEventListener('change', async () => {
  const chosen = languageSelect.value;
  const current = await sendMsg({ action: 'getSettings' });
  await sendMsg({
    action: 'saveSettings',
    settings: { ...(current?.settings || {}), language: chosen },
  });
  I18N.applyTranslations(document, chosen);
  // Rebuild the list so the new language is marked, and retranslate the
  // strings that are not carried by data-i18n.
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
