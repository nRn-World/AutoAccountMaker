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

// The steps of the registration flow, in order.
const STEP_KEYS = ['stepEmail', 'stepFill', 'stepSubmit', 'stepSave', 'stepMail', 'stepVerify', 'stepDone'];

/** Shows the step view and sets every step to a state. */
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

/** Marks steps 1..index as done and index+1 as running. */
function renderSteps(activeIndex) {
  stepRows().forEach((_, i) => {
    if (i < activeIndex) setStep(i, 'done');
    else if (i === activeIndex) setStep(i, 'active');
    else setStep(i, null);
  });
}

/** Ends the flow: the step that was active becomes done or failed. */
function finishSteps(activeIndex, ok) {
  if (ok) {
    for (let i = 0; i <= activeIndex; i++) setStep(i, 'done');
    if (activeIndex + 1 < stepRows().length) setStep(activeIndex + 1, 'active');
  } else {
    setStep(activeIndex, 'failed');
  }
}

/** The whole flow succeeded, so mark the last step as done too. */
function completeSteps() {
  stepRows().forEach((_, i) => setStep(i, 'done'));
}

// t() and translateError() come from i18n.js and are global. Do not declare them
// again, because that throws a SyntaxError in global scope and kills the script.

function log(msg, type = 'info') {
  logBox.classList.add('visible');
  const div = document.createElement('div');
  div.className = `log-entry ${type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info'}`;
  div.textContent = `[${new Date().toLocaleTimeString(I18N.language)}] ${msg}`;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

/**
 * Shows the verification link as a clickable paragraph. If the automatic
 * verification does not succeed the user must be able to open it themselves,
 * otherwise there is no way forward when the extension cannot confirm the result.
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
 * Waits for the page to be ready to fill. Cookie consent often reloads the
 * page, and the content script answers a moment before the form is rendered,
 * so the fill is lost. We therefore require both an answer AND a form.
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
 * Sends a message to the background, but gives the verification time to finish
 * first. Earlier we aborted right away with "A verification is already running",
 * purely because the previous account was still verifying for a whole
 * registration, even though the account was already created and saved.
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
  // Steps 1 to 4 (account, form, submit, save) are done, we are on step 5.
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
  // Clear the badge when the popup is opened
  chrome.action.setBadgeText({ text: '' });

  await I18N.initI18n();

  // License and cooldown must be visible right away, also on chrome:// pages.

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
    // The cooldown is rejected here, so mirror it in the interface with a
// The cooldown is rejected here, so show the time left and lock the button.
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

  // The test page has several forms, so make sure we are on the registration step.
  if (currentTab.url.startsWith('chrome-extension://')) {
    await sendToTab(currentTab.id, { action: 'showRegisterStep' });
    await new Promise((r) => setTimeout(r, 250));
  }

  // Close cookie banners, tick Terms and click our way to the form.
  // Many sites reload the page when consent is stored, so wait for it
  // svarar igen innan vi fyller i.
  const prep = await sendToTab(currentTab.id, { action: 'prepareForRegistration' });
  if (prep?.consentDismissed) log(t('popup.logConsent'), 'info');
  if (prep?.termsChecked?.length) log(t('popup.logTerms', prep.termsChecked.length), 'info');
  if (prep?.funnelClicks?.length) {
    log(t('popup.logAdvanced', prep.funnelClicks.join(' → ')), 'info');
  }
  if (prep?.consentDismissed) {
    // The consent may have reloaded the page. Wait for the form to be there again,
    // run prepare once more (the banner may have come back) and wait more.
    await waitForContentScript(currentTab.id, 10000, true);
    const prep2 = await sendToTab(currentTab.id, { action: 'prepareForRegistration' });
    if (prep2?.funnelClicks?.length) {
      log(t('popup.logAdvanced', prep2.funnelClicks.join(' → ')), 'info');
    }
  }
  // Two different errors must not be reported as the same thing:
  //  - content scriptet svarar inte alls → sidan laddade om
  //  - the page answers but has no form: wrong page (a pure
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

  // If the page navigates at exactly this moment the message is lost. Then we wait
  // for it to be ready again and retry once.
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

  // No filled form at all, so say it straight instead of claiming success.
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

  // Show clearly which fields could NOT be filled, so an incomplete form
  // does not look like it works when it does not.
  const missing = fillRes.result?.missing || [];
  if (missing.length) {
    log(t('popup.logMissing', missing.join(', ')), 'error');
  }

  renderSteps(2);
  // The submit click happens 800 ms after the fields are filled.
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

  // Now the extension does the rest: look for the verification mail (or read
  // the code on the test page), fill it in and submit. The user does not click.
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

  // The test page has several forms. Ask it to switch to the login step so
  // we do not fill the registration form.
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

// The accounts live in Settings now, so the vault button is gone from the popup.
btnTest?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('test-sida.html') }));
btnSettings?.addEventListener('click', () => chrome.runtime.openOptionsPage());

/**
 * Changing language in Settings updates the popup right away, without closing
 * and reopening it. chrome.storage.onChanged fires in every extension context,
 * including a popup that is already open.
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
  // Step texts and status are not data-i18n, so they must be redrawn.
  const current = Number(stepsBox.querySelector('.step-row.done')?.dataset.step || 0);
  if (current) renderSteps(current);
  log(t('popup.statusIdle'), 'info');
});

function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return '—'; }
}

init();
