let savedEmail = '';
let savedPassword = '';
let savedUsername = '';

// Koden som den "inkommande" e-posten innehåller på testsidan.
const SIMULATED_CODE = '482916';

const STORAGE_KEY = 'aam_test_account';

// t() och friends kommer från i18n.js och är redan globala funktioner.
// Deklarera dem inte på nytt här — "const { t } = ..." skulle kollidera med
// i18n.js:ns "function t" i global scope och kasta en SyntaxError som dödar
// hela det här skriptet.

/**
 * Spara kontot i sessionStorage så att uppgifterna finns kvar om sidan laddas om.
 * Annars försvinner dem och det går inte att testa inloggningen.
 */
function persistAccount() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ email: savedEmail, password: savedPassword, username: savedUsername })
    );
  } catch {
    /* sessionStorage kan blockeras — flödet fungerar ändå i den här sessionen */
  }
}

function restoreAccount() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data?.email) return false;
    savedEmail = data.email;
    savedPassword = data.password;
    savedUsername = data.username;
    return true;
  } catch {
    return false;
  }
}

function updateSteps(active) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('s' + i);
    el.classList.toggle('active', i === active);
    el.classList.toggle('done', i < active);
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showResult(msg, type = 'success') {
  const el = document.getElementById('result');
  el.textContent = msg;
  el.className = 'result ' + type;
}

function clearResult() {
  const el = document.getElementById('result');
  el.textContent = '';
  el.className = 'result';
}

function setStepDescription(text) {
  document.getElementById('stepDesc').textContent = text;
}

/** Bygger en rad med etikett + värde, utan innerHTML. */
function credRow(label, value) {
  const row = document.createElement('div');
  row.className = 'row';
  const l = document.createElement('span');
  l.className = 'label';
  l.textContent = label;
  const v = document.createElement('div');
  v.className = 'value';
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  return row;
}

// OTP auto-tab
document.querySelectorAll('.otp-input').forEach((input, i, arr) => {
  input.addEventListener('input', function () {
    if (this.value.length === 1 && i < arr.length - 1) {
      arr[i + 1].focus();
      this.classList.add('filled');
    }
    if (this.value.length === 0) this.classList.remove('filled');
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && this.value.length === 0 && i > 0) {
      arr[i - 1].focus();
    }
  });
});

/**
 * Efter att registreringsformuläret skickats visas verifieringssidan. Eftersom det
 * är en lokal testsida finns ingen riktig inkorg, så vi simulerar att brevet
 * kommer: efter några sekunder fylls OTP-fälten med koden. Då fungerar både
 * tilläggets auto-verifiering och manuellt klick på knappen.
 */
function simulateIncomingMail() {
  const badge = document.getElementById('emailBadge');
  setTimeout(() => {
    badge.textContent = t('test.mailReceived', SIMULATED_CODE);
    badge.style.background = '#ecfdf5';
    badge.style.color = '#065f46';

    const inputs = document.querySelectorAll('.otp-input');
    inputs.forEach((inp, idx) => {
      inp.value = SIMULATED_CODE[idx] || '';
      inp.classList.add('filled');
    });
    window.dispatchEvent(new CustomEvent('aam-otp-filled', { detail: { code: SIMULATED_CODE } }));
  }, 6000);
}

function goToLogin(prefill) {
  showPage('pageLogin');
  updateSteps(4);
  setStepDescription(t('test.step4Desc'));
  clearResult();
  if (prefill !== false) {
    document.getElementById('loginEmail').value = savedEmail;
    document.getElementById('loginPassword').value = savedPassword;
  }
}

document.getElementById('btnGoLogin').addEventListener('click', () => goToLogin(false));

document.getElementById('btnGoLogin2').addEventListener('click', () => goToLogin(true));

document.getElementById('btnGoRegister').addEventListener('click', () => {
  showPage('pageRegister');
  updateSteps(1);
  setStepDescription(t('test.step1Desc'));
  clearResult();
});

// Registrera
document.getElementById('btnRegister').addEventListener('click', (e) => {
  e.preventDefault();
  savedEmail = document.getElementById('email').value;
  savedPassword = document.getElementById('password').value;
  savedUsername = document.getElementById('username').value;

  if (!savedEmail || !savedPassword) {
    showResult(t('test.fillFirst'), 'info');
    return;
  }

  persistAccount();
  document.getElementById('verifyEmail').textContent = savedEmail;

  showResult(t('test.statusRegistered'), 'info');
  setStepDescription(t('test.step2'));

  setTimeout(() => {
    showPage('pageVerify');
    updateSteps(2);
    clearResult();
    const first = document.querySelector('.otp-input');
    if (first) first.focus();
    simulateIncomingMail();
  }, 2000);
});

// Verifiera
document.getElementById('btnVerify').addEventListener('click', (e) => {
  e.preventDefault();
  const inputs = document.querySelectorAll('.otp-input');
  let code = '';
  inputs.forEach((inp) => (code += inp.value));
  if (code.length < 6) {
    showResult(t('test.otpNeeded'), 'info');
    return;
  }

  const creds = document.getElementById('successCreds');
  creds.innerHTML = '';
  creds.appendChild(credRow(t('common.website'), 'test-sida (lokal)'));
  creds.appendChild(credRow(t('popup.credsEmail'), savedEmail));
  creds.appendChild(credRow(t('vault.fieldUsername'), savedUsername || savedEmail.split('@')[0]));
  creds.appendChild(credRow(t('vault.fieldPassword'), savedPassword));

  showPage('pageSuccess');
  updateSteps(3);
  setStepDescription(t('test.step3Desc'));
  clearResult();
});

/**
 * Inloggningen kontrollerar uppgifterna mot dem som registrerades, precis som
 * en riktig sajt. Fel uppgifter ger ett felmeddelande, rätta leder till
 * dashboarden — så att det går att se att flödet faktiskt fungerade.
 */
document.getElementById('btnLogin').addEventListener('click', (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;

  if (!email || !pw) {
    showResult(t('test.fillFirst'), 'info');
    return;
  }

  if (!savedEmail || email.toLowerCase() !== savedEmail.toLowerCase() || pw !== savedPassword) {
    showResult(t('test.invalidCredentials'), 'info');
    return;
  }

  const creds = document.getElementById('dashboardCreds');
  creds.innerHTML = '';
  creds.appendChild(credRow(t('common.website'), 'test-sida (lokal)'));
  creds.appendChild(credRow(t('popup.credsEmail'), email));
  creds.appendChild(credRow(t('vault.fieldUsername'), savedUsername || email.split('@')[0]));

  showResult(t('test.loginResult', email), 'success');
  showPage('pageDashboard');
  updateSteps(5);
  setStepDescription(t('test.step5Desc'));
});

document.getElementById('btnSignOut').addEventListener('click', () => {
  goToLogin(true);
  showResult(t('test.signedOut'), 'info');
});

// När tillägget fyller i OTP-fälten ska de markeras som ifyllda.
window.addEventListener('aam-otp-filled', () => {
  document.querySelectorAll('.otp-input').forEach((inp) => {
    if (inp.value) inp.classList.add('filled');
  });
});

/**
 * Sidor inom tillägget (test-sidan) kan ha flera formulär. Popupens
 * "Log in"-knapp ber oss växla till inloggningssteget först, så att den inte
 * fyller i registreringsformuläret när sidan råkar stå på ett annat steg.
 */
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action === 'showLoginStep') {
    goToLogin(true);
    sendResponse({ success: true });
    return;
  }
  if (request?.action === 'showRegisterStep') {
    showPage('pageRegister');
    updateSteps(1);
    setStepDescription(t('test.step1Desc'));
    clearResult();
    sendResponse({ success: true });
  }
});

(async function init() {
  await I18N.initI18n();
  setStepDescription(t('test.step1Desc'));

  // Finns ett sparat konto från ett tidigare besök? Fyll i inloggningsformuläret
  // så att popupens "Log in"-knapp går att testa direkt. Vi byter däremot INTE
  // sida automatiskt — annars skulle "Registrera automatiskt" fylla i
  // inloggningsformuläret efter en omladdning.
  if (restoreAccount()) {
    document.getElementById('loginEmail').value = savedEmail;
    document.getElementById('loginPassword').value = savedPassword;
  }

  console.log('Test page ready — the extension can fill in this form.');
})();
