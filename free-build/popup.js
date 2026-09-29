const statusText = document.getElementById('statusText');
const siteBadge = document.getElementById('siteBadge');
const btnRegister = document.getElementById('btnRegister');
const btnLogin = document.getElementById('btnLogin');
const btnVerify = document.getElementById('btnVerify');
const btnTest = document.getElementById('btnTest');
const logBox = document.getElementById('logBox');
const credsBox = document.getElementById('credsBox');
const dispEmail = document.getElementById('dispEmail');
const dispPassword = document.getElementById('dispPassword');
const stepsBox = document.getElementById('steps');
const btnSettings = document.getElementById('btnSettings');

let currentTab = null;
let pageReady = false;
let cooldownUntil = 0;

// Stegen i registreringsflödet, i ordning.
const STEP_KEYS = ['stepEmail', 'stepFill', 'stepSubmit', 'stepSave', 'stepMail', 'stepVerify', 'stepDone'];

/** Visar steg-vyn och sätter varje steg till ett tillstånd. */
function showSteps() {
  stepsBox.classList.add('visible');
  renderSteps(0);
}

function stepRows() {
  return [...stepsBox.querySelectorAll('.step-row')];
}

function setStep(index, state) {
  const row = stepRows()[index];
  if (!row) return;
  row.classList.remove('active', 'done', 'failed');
  if (state) row.classList.add(state);
  const dot = row.querySelector('.step-dot');
  dot.textContent = state === 'done' ? '✓' : state === 'failed' ? '!' : '';
}

/** Markera steg 1..index som klara och index+1 som pågående. */
function renderSteps(activeIndex) {
  stepRows().forEach((_, i) => {
    if (i < activeIndex) setStep(i, 'done');
    else if (i === activeIndex) setStep(i, 'active');
    else setStep(i, null);
  });
}

/** Avslutar flödet: steget som var aktivt blir klart eller misslyckat. */
function finishSteps(activeIndex, ok) {
  if (ok) {
    for (let i = 0; i <= activeIndex; i++) setStep(i, 'done');
    if (activeIndex + 1 < stepRows().length) setStep(activeIndex + 1, 'active');
  } else {
    setStep(activeIndex, 'failed');
  }
}

/** Hela flödet lyckades — markera även det sista steget som klart. */
function completeSteps() {
  stepRows().forEach((_, i) => setStep(i, 'done'));
}

// t() och translateError() kommer från i18n.js och är globala. Deklarera dem inte
// på nytt — det kastar en SyntaxError i global scope och dödar hela skriptet.

function log(msg, type = 'info') {
  logBox.classList.add('visible');
  const div = document.createElement('div');
  div.className = `log-entry ${type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info'}`;
  div.textContent = `[${new Date().toLocaleTimeString(I18N.language)}] ${msg}`;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

/**
 * Visar verifieringslänken som ett klickbart stycke. Om den automatiska
 * verifieringen inte lyckas ska användaren kunna öppna den själv — annars
 * finns ingen väg fram när tillägget inte kan bekräfta resultatet.
 */
function showLink(link) {
  if (!link) return;
  const div = document.createElement('div');
  div.className = 'log-entry info';
  div.style.wordBreak = 'break-all';

  const label = document.createElement('span');
  label.textContent = t('popup.logOpenManually') + ' ';
  const a = document.createElement('a');
  a.href = link;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = link;
  a.style.color = '#38bdf8';
  a.style.textDecoration = 'underline';

  div.appendChild(label);
  div.appendChild(a);
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

function sendMsg(msg, timeout = 180000) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, errorCode: 'bgTimeout', error: chrome.runtime.lastError.message });
      } else {
        resolve(res);
      }
    });
    setTimeout(() => resolve({ success: false, errorCode: 'bgTimeout' }), timeout);
  });
}

function sendToTab(tabId, msg) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, errorCode: 'injectFailed', error: chrome.runtime.lastError.message });
      } else {
        resolve(res ?? { success: false, errorCode: 'injectFailed', __none: true });
      }
    });
  });
}

function isUsableTab(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome-extension://');
}

function getSiteKey(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('yahoo')) return 'yahoo.com';
    if (host.includes('google')) return 'google.com';
    if (host.includes('microsoft') || host.includes('live.com') || host.includes('outlook')) return 'microsoft.com';
    return host;
  } catch {
    return url;
  }
}

async function ensureContentScript(tabId) {
  const ping = await sendToTab(tabId, { action: 'ping' });
  return !!ping?.pong;
}

/**
 * Väntar in att sidan är redo att fyllas i. Cookie-samtycken laddar ofta om
 * sidan, och content scriptet svarar en stund innan formuläret renderats —
 * då går ifyllningen förlorad. Vi kräver därför både svar OCH ett formulär.
 */
async function waitForContentScript(tabId, timeoutMs = 10000, requireForm = false) {
  const deadline = Date.now() + timeoutMs;
  let delay = 250;
  while (Date.now() < deadline) {
    const ping = await sendToTab(tabId, { action: 'ping' });
    if (ping?.pong && (!requireForm || ping.hasForm)) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 1200);
  }
  return false;
}

async function fillOnTab(tabId, msg) {
  const ready = await ensureContentScript(tabId);
  if (!ready) {
    return { success: false, errorCode: 'injectFailed' };
  }
  return sendToTab(tabId, msg);
}

/**
 * Skickar ett meddelande till bakgrunden, men ger verifieringen tid att bli klar
 * först. Tidigare avbröt vi direkt med "A verification is already running", så
 * bara för att föregående konto fortfarande höll på att verifieras föll hela
 * registreringen — trots att kontot redan var skapat och sparat.
 */
async function sendMsgWaitingForSlot(msg, waitMs = 120000) {
  const deadline = Date.now() + waitMs;
  let delay = 1000;
  let waited = false;
  for (;;) {
    const res = await sendMsg(msg);
    if (res?.errorCode !== 'alreadyRunning') return res;
    if (Date.now() >= deadline) return res;
    if (!waited) {
      waited = true;
      log(t('popup.logVerifyBusy'), 'info');
    }
    statusText.textContent = t('popup.statusWaiting');
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 5000);
  }
}

async function runVerification(account, tabId) {
  btnVerify.disabled = true;
  btnRegister.disabled = true;
  btnLogin.disabled = true;
  showSteps();
  // Steg 1-4 (konto, formulär, skicka, spara) är redan klara — vi är på steg 5.
  renderSteps(5);
  statusText.textContent = t('popup.statusWaiting');
  log(t('popup.statusWaiting'), 'info');

  const baseUrl = currentTab?.url || undefined;
  const result = await sendMsgWaitingForSlot({ action: 'autoVerify', account, tabId, baseUrl });

  if (result?.success) {
    completeSteps();
    if (result.method === 'otp') {
      log(t('popup.logVerifyDoneCode', result.code), 'success');
    } else {
      log(t('popup.logVerifyDoneLink'), 'success');
    }
    statusText.textContent = t('popup.statusVerified');
  } else {
    finishSteps(5, false);
    log(translateError(result, 'popup.logVerifyFailed'), 'error');

    if (result?.link) {
      showLink(result.link);
    }
    if (result?.code) {
      log(t('popup.logCodeManual', result.code), 'info');
    }

    statusText.textContent = result?.link
      ? t('popup.statusNotConfirmed')
      : translateError(result, 'popup.logVerifyFailed');

    dispEmail.textContent = account.email;
    dispPassword.textContent = account.password;
    credsBox.classList.add('visible');
  }

  btnVerify.disabled = false;
  btnRegister.disabled = false;
  btnLogin.disabled = false;
  return result;
}

async function findAccountForTab(tab) {
  const hostname = new URL(tab.url).hostname;
  const accRes = await sendMsg({ action: 'getAccountsForSite', hostname });
  const accounts = accRes?.accounts || [];
  if (!accounts.length) return null;

  const detect = await fillOnTab(tab.id, { action: 'detectOtpPage' });
  const emailOnPage = detect?.emailOnPage;
  if (emailOnPage) {
    const match = accounts.find((a) => a.email.toLowerCase() === emailOnPage);
    if (match) return match;
  }
  return accounts[0];
}

async function init() {
  // Rensa badge när popupen öppnas
  chrome.action.setBadgeText({ text: '' });

  await I18N.initI18n();

  // Licens/cooldown ska vara synligt direkt, även på chrome:// sidor.

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab?.url || tab.url.startsWith('chrome://')) {
    siteBadge.textContent = t('popup.siteNone');
    statusText.textContent = t('popup.statusNoPage');
    btnRegister.disabled = true;
    btnLogin.disabled = true;
    pageReady = false;
    return;
  }

  pageReady = isUsableTab(tab.url);
  const host = tab.url.startsWith('chrome-extension://')
    ? t('popup.statusTestsite')
    : new URL(tab.url).hostname;
  siteBadge.textContent = host;

  const detect = await fillOnTab(tab.id, { action: 'detectOtpPage' });
  if (detect?.isOtpPage) {
    btnVerify.style.display = 'block';
    statusText.textContent = t('popup.statusOtpFound');
    if (detect.emailOnPage) log(t('popup.logPageOn') + detect.emailOnPage, 'info');
    return;
  }

  if (!tab.url.startsWith('chrome-extension://')) {
    const accRes = await sendMsg({ action: 'getAccountsForSite', hostname: new URL(tab.url).hostname });
    if (accRes?.accounts?.length > 0) {
      const unverified = accRes.accounts.find((a) => !a.verified);
      if (unverified?.mailToken || unverified?.emailHash) {
        btnVerify.style.display = 'block';
        statusText.textContent = t('popup.statusUnverified');
      } else {
        statusText.textContent = t('popup.statusAccounts', accRes.accounts.length);
      }
    }
  }
}

btnRegister.addEventListener('click', async () => {
  if (!pageReady || !currentTab?.id) {
    log(t('popup.logPageFirst'), 'error');
    return;
  }

  btnRegister.disabled = true;
  btnLogin.disabled = true;
  btnVerify.disabled = true;
  logBox.innerHTML = '';
  credsBox.classList.remove('visible');
  showSteps();
  renderSteps(0);

  const profileRes = await sendMsg({ action: 'getNewProfile' });
  if (!profileRes?.success) {
    // Cooldownen avvisar här. Visa tiden kvar och lås knappen.
    if (profileRes?.reason === 'cooldown') {
      cooldownUntil = Date.now() + (profileRes.remainingMs || 0);
      log(t('popup.licenseCooldownText', profileRes.remainingLabel || ''), 'error');
      statusText.textContent = t('popup.licenseFreeBlocked');
      stepsBox.classList.remove('visible');
      btnRegister.disabled = true;
      btnLogin.disabled = false;
      return;
    }
    log(translateError(profileRes, 'popup.logProfileFailed'), 'error');
    statusText.textContent = translateError(profileRes, 'popup.logProfileFailed');
    finishSteps(0, false);
    btnRegister.disabled = false;
    btnLogin.disabled = false;
    return;
  }

  const profile = profileRes.profile;
  log(t('popup.logEmail', profile.email), 'success');
  log(t('popup.logPasswordLen', profile.password.length));
  renderSteps(1);

  const settingsRes = await sendMsg({ action: 'getSettings' });
  const autoSubmit = settingsRes?.settings?.autoSubmitForm !== false;

  // Testsidan har flera formulär — se till att vi står på registreringssteget.
  if (currentTab.url.startsWith('chrome-extension://')) {
    await sendToTab(currentTab.id, { action: 'showRegisterStep' });
    await new Promise((r) => setTimeout(r, 250));
  }

  // Stäng cookie-banners, kryssa i Terms och klicka oss fram till formuläret.
  // Många sajter laddar om sidan när samtycket lagras — vänta in att den
  // svarar igen innan vi fyller i.
  const prep = await sendToTab(currentTab.id, { action: 'prepareForRegistration' });
  if (prep?.consentDismissed) log(t('popup.logConsent'), 'info');
  if (prep?.termsChecked?.length) log(t('popup.logTerms', prep.termsChecked.length), 'info');
  if (prep?.funnelClicks?.length) {
    log(t('popup.logAdvanced', prep.funnelClicks.join(' → ')), 'info');
  }
  if (prep?.consentDismissed) {
    // Samtycket kan ha laddat om sidan. Vänta in att formuläret finns igen,
    // kör prepare en gång till (banner kan ha kommit tillbaka) och vänta mer.
    await waitForContentScript(currentTab.id, 10000, true);
    const prep2 = await sendToTab(currentTab.id, { action: 'prepareForRegistration' });
    if (prep2?.funnelClicks?.length) {
      log(t('popup.logAdvanced', prep2.funnelClicks.join(' → ')), 'info');
    }
  }
  // Två olika fel ska inte rapporteras som samma sak:
  //  - content scriptet svarar inte alls → sidan laddade om
  //  - sidan svarar men har inget formulär → fel sida (t.ex. en ren
  //    inloggningssida). Att kalla det "slutade svara" var vilseledande.
  const ready = await waitForContentScript(currentTab.id, 10000, true);
  if (!ready) {
    const stillAlive = await ensureContentScript(currentTab.id);
    const msg = stillAlive ? t('popup.logNoForm') : t('popup.logNoResponse');
    log(msg, 'error');
    statusText.textContent = msg;
    finishSteps(1, false);
    btnRegister.disabled = false;
    btnLogin.disabled = false;
    return;
  }

  statusText.textContent = t('popup.logFilling');

  // Om sidan navigerar i exakt detta ögonblick förloras meddelandet. Då väntar vi
  // in att den är redo igen och gör om försöket en gång.
  let fillRes = await fillOnTab(currentTab.id, {
    action: 'fillRegistration',
    profile,
    autoSubmit,
  });
  if (fillRes?.errorCode === 'injectFailed' || fillRes?.__none) {
    await waitForContentScript(currentTab.id, 10000, true);
    fillRes = await fillOnTab(currentTab.id, {
      action: 'fillRegistration',
      profile,
      autoSubmit,
    });
  }

  // Ingen ifylld form alls — säg det rakt ut i stället för att påstå framgång.
  if (fillRes?.result?.noForm) {
    log(t('popup.logNoForm'), 'error');
    statusText.textContent = t('popup.statusNoForm');
    finishSteps(1, false);
    btnRegister.disabled = false;
    btnLogin.disabled = false;
    return;
  }

  if (!fillRes?.success) {
    log(translateError(fillRes, 'popup.logFillFailed'), 'error');
    statusText.textContent = translateError(fillRes, 'popup.logFillFailed');
    finishSteps(1, false);
    btnRegister.disabled = false;
    btnLogin.disabled = false;
    return;
  }

  const f = fillRes.result?.filled || {};
  log(t('popup.logFilled', !!f.email, !!f.password), 'success');
  if (f.birthDate) log(t('popup.logBirthDone'), 'success');
  if (f.gender) log(t('popup.logGenderDone'), 'success');
  if (f.emailConfirm) log(t('popup.logEmailConfirmDone'), 'success');
  if (f.country) log(t('popup.logCountryDone', fillRes.result?.report?.country?.name || profile.country), 'success');
  if ((fillRes.result?.checkboxes || []).length) {
    log(t('popup.logCheckboxes', fillRes.result.checkboxes.length), 'info');
  }
  if (fillRes.result?.submitted) log(t('popup.logSubmitted'), 'success');

  // Visa tydligt vilka fält som INTE kunde fyllas, så en ofullständig form
  // inte ser ut att fungera när den inte gör det.
  const missing = fillRes.result?.missing || [];
  if (missing.length) {
    log(t('popup.logMissing', missing.join(', ')), 'error');
  }

  renderSteps(2);
  // Klicket på skicka sker 800 ms efter att fälten fyllts.
  await new Promise((r) => setTimeout(r, 1000));
  renderSteps(3);

  const siteKey = currentTab.url.startsWith('chrome-extension://')
    ? 'test-sida.local'
    : getSiteKey(currentTab.url);

  const account = {
    id: Date.now().toString(),
    website: siteKey,
    email: profile.email,
    username: profile.username,
    password: profile.password,
    provider: profile.provider,
    mailToken: profile.mailToken,
    mailPassword: profile.mailPassword,
    emailHash: profile.emailHash,
    rapidApiKey: profile.rapidApiKey,
    verified: false,
    createdAt: new Date().toISOString(),
  };

  const saveRes = await sendMsg({ action: 'saveAccount', account });
  await sendMsg({ action: 'startPendingVerification', tabId: currentTab.id, account });
  log(t('popup.logSaved'), 'success');
  if (saveRes?.removed > 0) {
    log(t('vault.msgTrimmed', saveRes.accounts.length), 'info');
  }
  renderSteps(4);

  dispEmail.textContent = profile.email;
  dispPassword.textContent = profile.password;
  credsBox.classList.add('visible');
  btnVerify.style.display = 'block';

  // Nu sköter tillägget resten: leta efter verifieringsmejlet (eller läsa av
  // koden på testsidan), fylla i den och skicka. Användaren klickar inte.
  statusText.textContent = t('popup.statusRegistered');
  log(t('popup.logVerifyStart'), 'info');
  renderSteps(5);

  const verifyResult = await sendMsgWaitingForSlot({
    action: 'autoVerify',
    account,
    tabId: currentTab.id,
    baseUrl: currentTab.url,
  });

  if (verifyResult?.success) {
    completeSteps();
    if (verifyResult.method === 'otp') {
      log(t('popup.logVerifyDoneCode', verifyResult.code), 'success');
    } else {
      log(t('popup.logVerifyDoneLink'), 'success');
    }
    statusText.textContent = t('popup.statusDone');
  } else {
    finishSteps(5, false);
    log(translateError(verifyResult, 'popup.logVerifyFailed'), 'error');

    if (verifyResult?.link) {
      showLink(verifyResult.link);
    }
    if (verifyResult?.code) {
      log(t('popup.logCodeManual', verifyResult.code), 'info');
    }

    statusText.textContent = verifyResult?.link
      ? t('popup.statusNotConfirmed')
      : t('popup.statusUnverifiedNote');
  }

  btnRegister.disabled = false;
  btnLogin.disabled = false;
  btnVerify.disabled = false;
});

btnVerify.addEventListener('click', async () => {
  if (!pageReady || !currentTab?.id) {
    log(t('popup.logVerifyPageFirst'), 'error');
    return;
  }

  logBox.innerHTML = '';
  const account = await findAccountForTab(currentTab);
  if (!account) {
    log(t('popup.logNoAccount'), 'error');
    statusText.textContent = t('popup.logNoAccount');
    return;
  }

  if (!account.mailToken && !account.emailHash) {
    log(t('popup.logNoMailCreds'), 'error');
    return;
  }

  log(t('popup.logVerifying', account.email));
  await runVerification(account, currentTab.id);
});

btnLogin.addEventListener('click', async () => {
  if (!pageReady || !currentTab?.id) {
    log(t('popup.logPageFirst'), 'error');
    return;
  }

  btnRegister.disabled = true;
  btnLogin.disabled = true;
  logBox.innerHTML = '';

  const hostname = currentTab.url.startsWith('chrome-extension://')
    ? 'test-sida.local'
    : new URL(currentTab.url).hostname;

  const accRes = await sendMsg({ action: 'getAccountsForSite', hostname });

  if (!accRes?.accounts?.length) {
    log(t('popup.logNoSite'), 'error');
    statusText.textContent = t('popup.logNoSite');
    btnRegister.disabled = false;
    btnLogin.disabled = false;
    return;
  }

  const account = accRes.accounts[0];
  statusText.textContent = t('popup.logLoggingIn', account.email);
  log(t('popup.logLoggingIn', account.email));

  // Testsidan har flera formulär. Ber den växla till inloggningssteget så att
  // vi inte fyller i registreringsformuläret.
  if (currentTab.url.startsWith('chrome-extension://')) {
    await sendToTab(currentTab.id, { action: 'showLoginStep' });
    await new Promise((r) => setTimeout(r, 250));
  }

  const fillRes = await fillOnTab(currentTab.id, {
    action: 'fillLogin',
    profile: {
      email: account.email,
      username: account.username || account.email.split('@')[0],
      password: account.password,
    },
    autoSubmit: true,
  });

  if (fillRes?.success) {
    log(t('popup.logLoginSent'), 'success');
    statusText.textContent = t('popup.logLoginOk');
    dispEmail.textContent = account.email;
    dispPassword.textContent = account.password;
    credsBox.classList.add('visible');
  } else {
    log(t('popup.logLoginFailed'), 'error');
    statusText.textContent = t('popup.logLoginFailed');
  }

  btnRegister.disabled = false;
  btnLogin.disabled = false;
});

// Kontona ligger i Inställningar nu, så valvknappen är bort från popupen.
btnTest?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('test-sida.html') }));
btnSettings?.addEventListener('click', () => chrome.runtime.openOptionsPage());

/**
 * Byt språk i Inställningar → popupen uppdateras direkt, utan att stängas
 * och öppnas om. chrome.storage.onChanged triggas i alla extension-sammanhang,
 * även i en popup som redan är öppen.
 */
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const lang = changes.settings.newValue?.language;
  if (!lang || lang === I18N.language) return;

  I18N.applyTranslations(document, lang);
  cooldownUntil = 0;
  if (currentTab) {
    siteBadge.textContent = currentTab.url?.startsWith('chrome-extension://')
      ? t('popup.statusTestsite')
      : safeHostname(currentTab.url);
  }
  // Stegtexter och status är inte data-i18n, så de måste ritas om.
  const current = Number(stepsBox.querySelector('.step-row.done')?.dataset.step || 0);
  if (current) renderSteps(current);
  log(t('popup.statusIdle'), 'info');
});

function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return '—'; }
}

init();
