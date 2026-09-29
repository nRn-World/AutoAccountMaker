/**
 * background.js: Service worker for AutoAccountMaker
 * Improved OTP extraction, badge status, longer polling, more robust flow
 */

// license.js holds the signature secret and the Pro checks, so it stays in
// this private build. Guarded because background.js is also evaluated in a
// plain Node VM by the tests, where importScripts does not exist.
if (typeof importScripts === 'function') {
  try {
    importScripts('license.js');
  } catch {
    try {
      importScripts('cooldown.js');
    } catch {}
  }
}

// ── Side Panel ─────────────────────────────────────────────────────────────
// Open popup.html in Chrome's built-in side panel (docked to the browser,
// stays open while the user interacts with the page).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => {});
// ───────────────────────────────────────────────────────────────────────────

function updateBadge(text, color = '#10b981') {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
  } catch {}
}

function clearBadge(delayMs = 0) {
  const run = () => {
    try {
      chrome.action.setBadgeText({ text: '' });
    } catch {}
  };
  if (delayMs > 0) setTimeout(run, delayMs);
  else run();
}

/**
 * Shows a state briefly and then clears the badge. A lingering red cross
 * or a stuck 34/40 looks like an ongoing error long after it is done, so
 * every state gets a short lifetime.
 */
function flashBadge(text, color, holdMs) {
  updateBadge(text, color);
  clearBadge(holdMs);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * MV3 service workers are shut down after about 30 s of inactivity, and a
 * setTimeout does not count as activity. Every API call resets the timer, so
 * we "breathe" once per polling round to keep the worker alive throughout.
 */
function heartbeat() {
  try {
    chrome.runtime.getPlatformInfo?.();
  } catch {}
  touchVerificationJob();
}

/**
 * Writes a pulse timestamp into the stored verification job.
 *
 * The service worker dies after about 30 seconds of inactivity. If it dies
 * in the middle of a polling wait, `finally` never runs, so verificationJob
 * stays in storage for up to four minutes and blocks every new attempt with
 * "A verification is already running", even though nothing is verifying.
 * With a pulse we can tell a living job from a dead one.
 */
let lastJobPulse = 0;
function touchVerificationJob() {
  const now = Date.now();
// Throttling: the polling calls heartbeat() a few times per second.
  if (now - lastJobPulse < 2000) return;
  lastJobPulse = now;
  chrome.storage.local
    .get({ verificationJob: null })
    .then(({ verificationJob }) => {
      if (!verificationJob?.account) return null;
// Read straight back before writing. Otherwise an in flight pulse write can
      // hinna landa EFTER att runAutoVerification raderat jobbet i sin finally,
// revive a finished job that reads the next attempt.
      return chrome.storage.local.get({ verificationJob: null }).then((cur) => {
        if (!cur.verificationJob?.account) return null;
        return chrome.storage.local.set({
          verificationJob: { ...cur.verificationJob, heartbeatAt: now },
        });
      });
    })
    .catch(() => {});
}

/**
 * Classifies HTTP errors so we can stop immediately instead of polling for two
 * minuter mot en endpoint som aldrig kommer svara. Returnerar { code, message }
 * where the code is translated by the interface. Returns null when the error
 * is temporary and worth retrying.
 */
function classifyMailApiError(res) {
  if (res.status === 401 || res.status === 403) {
    return {
      errorCode: 'rapidapiInvalid',
      message: 'RapidAPI-nyckeln är ogiltig eller har löpt ut. Ange en ny nyckel under Inställningar, eller växla till mail.tm (gratis, ingen nyckel).',
    };
  }
  if (res.status === 404 || res.status === 410) {
    return {
      errorCode: 'rapidapiGone',
      message: 'temp-mail.org-endpointen svarar inte längre (HTTP ' + res.status + '). API:t är avvecklat — växla till mail.tm under Inställningar (gratis, ingen nyckel behövs).',
    };
  }
  if (res.status === 429) {
    return {
      errorCode: 'rateLimited',
      message: 'För många anrop (HTTP 429) — RapidAPI-gränsen är nådd. Vänta en stund eller växla till mail.tm.',
    };
  }
  if (res.status >= 400) {
    return {
      errorCode: 'mailApiStatus',
      message: 'E-posttjänsten svarade med HTTP ' + res.status + '. Kontrollera inställningarna.',
    };
  }
  return null;
}

// crypto.js (embedded)
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encryptData(text, password) {
  const data = new TextEncoder().encode(text);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveKey(password, salt);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data));
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(ciphertext, salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedBase64, password) {
  const binary = atob(encryptedBase64);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) combined[i] = binary.charCodeAt(i);
  if (combined.length < 28) throw new Error('Ogiltig krypterad fil.');
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const aesKey = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function md5(string) {
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  function md51(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) md5cycle(state, md5blk(s.substring(i - 64, i)));
    s = s.substring(i - 64);
    const tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) { md5cycle(state, tail); tail.fill(0); }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  function add32(a, b) { return (a + b) & 0xffffffff; }
  function rhex(n) {
    const hex = '0123456789abcdef';
    let s = '';
    for (let j = 0; j < 4; j++) s += hex.charAt((n >> (j * 8 + 4)) & 0x0f) + hex.charAt((n >> (j * 8)) & 0x0f);
    return s;
  }
  const hash = md51(string);
  return rhex(hash[0]) + rhex(hash[1]) + rhex(hash[2]) + rhex(hash[3]);
}

// --- Huvudlogik ---
const MAILTM_BASE = 'https://api.mail.tm';
const TEMPMAIL_RAPIDAPI = 'https://privatix-temp-mail-v1.p.rapidapi.com';

const DEFAULT_SETTINGS = {
  emailProvider: 'mailtm',
  rapidApiKey: '',
  autoSubmitForm: true,
  autoClickVerification: true,
  passwordLength: 14,
  useSpecialChars: true,
  language: 'en',
  retentionLimit: 10,
  country: 'SE',
};

// 100 was removed from the list when the limit changed to 199. Without this
const RETENTION_OPTIONS = [10, 50, 199];
const DEFAULT_RETENTION = 10;

// Allowed storage limits. 10 is the default.
// migration anyone who had saved 100 would silently fall back to 10, and
// since the limit trims the list, they would have lost accounts.
const RETENTION_MIGRATION = { 100: 199 };

function normalizeRetention(value) {
  let n = parseInt(value, 10);
  if (Object.prototype.hasOwnProperty.call(RETENTION_MIGRATION, n)) {
    n = RETENTION_MIGRATION[n];
  }
  return RETENTION_OPTIONS.includes(n) ? n : DEFAULT_RETENTION;
}

function generateRandomString(length, useSpecial = true) {
  const base = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const special = '!@#$%&*';
  const chars = useSpecial ? base + special : base;
  let result = '';
  const arr = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) result += chars[arr[i] % chars.length];
  return result;
}

// Age of the generated profiles. The user asked for 30 year olds.
const PROFILE_AGE_YEARS = 30;

/**
// Age of the generated profiles. The user asked for 30 year olds.
 * the actual length of the month so the date is always valid (not 31/02).
 */
function randomBirthDate(ageYears = PROFILE_AGE_YEARS) {
  const now = new Date();
  const year = now.getFullYear() - ageYears;
  const month = Math.floor(Math.random() * 12) + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateUsername() {
  const prefixes = ['user', 'member', 'nordic', 'nexus', 'alpha', 'delta'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return prefix + Math.floor(1000 + Math.random() * 9000);
}

async function getSettings() {
  const data = await chrome.storage.local.get({ settings: DEFAULT_SETTINGS });
  const settings = { ...DEFAULT_SETTINGS, ...data.settings };
  settings.retentionLimit = normalizeRetention(settings.retentionLimit);
  if (!['en', 'sv', 'tr', 'ar', 'es', 'de', 'fr'].includes(settings.language)) {
    settings.language = DEFAULT_SETTINGS.language;
  }
  return settings;
}

async function createMailTmAccount(password) {
  const domainsRes = await fetch(`${MAILTM_BASE}/domains`);
  const domainsData = await domainsRes.json();
  const domain = domainsData['hydra:member']?.[0]?.domain;
  if (!domain) {
    const e = new Error('Kunde inte hämta mail.tm-domän.');
    e.errorCode = 'mailtmNoDomain';
    throw e;
  }

  const username = generateUsername().toLowerCase();
  const email = `${username}@${domain}`;

  const createRes = await fetch(`${MAILTM_BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password }),
  });
  if (!createRes.ok) { const e = new Error('Kunde inte skapa mail.tm-konto.'); e.errorCode = 'mailtmCreateFailed'; throw e; }

  const tokenRes = await fetch(`${MAILTM_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: email, password }),
  });
  if (!tokenRes.ok) { const e = new Error('Kunde inte autentisera mail.tm.'); e.errorCode = 'mailtmAuthFailed'; throw e; }
  const tokenData = await tokenRes.json();

  return {
    email,
    username,
    provider: 'mailtm',
    mailToken: tokenData.token,
    mailPassword: password,
  };
}

async function createTempMailAccount(rapidApiKey) {
  if (!rapidApiKey) {
    const e = new Error('temp-mail.org kräver RapidAPI-nyckel. Ange den under Inställningar eller välj mail.tm.');
    e.errorCode = 'needRapidApiKey';
    throw e;
  }

  const headers = {
    'x-rapidapi-key': rapidApiKey,
    'x-rapidapi-host': 'privatix-temp-mail-v1.p.rapidapi.com',
  };

  const domainsRes = await fetch(`${TEMPMAIL_RAPIDAPI}/request/domains/`, { headers });
  if (!domainsRes.ok) {
    const e = new Error('Kunde inte hämta temp-mail.org-domäner. Kontrollera RapidAPI-nyckeln.');
    e.errorCode = 'tempmailNoDomains';
    throw e;
  }
  const domains = await domainsRes.json();
  if (!domains?.length) {
    const e = new Error('Inga domäner tillgängliga från temp-mail.org.');
    e.errorCode = 'tempmailNoDomainsEmpty';
    throw e;
  }

  const rawDomain = domains[Math.floor(Math.random() * domains.length)];
  const domain = rawDomain.replace(/^@/, '');
  const username = generateUsername().toLowerCase();
  const email = `${username}@${domain}`;

  return {
    email,
    username,
    provider: 'tempmail',
    emailHash: md5(email),
    rapidApiKey,
  };
}

async function generateProfile() {
  const settings = await getSettings();
  const password = generateRandomString(settings.passwordLength, settings.useSpecialChars);
  const firstName = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey'][Math.floor(Math.random() * 5)];
  const lastName = ['Berg', 'Lind', 'Kaya', 'Nova', 'Vega'][Math.floor(Math.random() * 5)];

  let mailInfo;
  if (settings.emailProvider === 'tempmail') {
    mailInfo = await createTempMailAccount(settings.rapidApiKey);
  } else {
    mailInfo = await createMailTmAccount(password);
  }

// Random gender. Forms often use "man"/"woman" instead of
  // "male"/"female", vilket setSelectValue hanterar via synonymer.
  const genders = ['male', 'female'];
  const gender = genders[Math.floor(Math.random() * genders.length)];

  return {
    ...mailInfo,
    password,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    birthDate: randomBirthDate(),
    gender,
// The country is used by forms with country pickers. It matches the country
// the user themselves gave in the settings, which lowers the risk of a site
// treating the account as suspicious.
    country: settings.country || DEFAULT_SETTINGS.country,
    createdAt: new Date().toISOString(),
  };
}

// Words that indicate a link leads to a verification.
const VERIFY_URL_WORDS = /(confirm|verif|activat|validat|signup|sign-?up|register|auth|token|magic-?link|check|approve|complete)/i;
const VERIFY_ANCHOR_WORDS = /(verify|verifiera|bekräfta|bekrafta|confirm|confirma|activate|aktivera|validate|validera|accept|godkänn|godkann|continue|fortsätt|fortsatt|complete|slutför|sign in|logga in)/i;

// Words that indicate a link leads to a verification.
const LINK_NOISE_WORDS = /(unsubscribe|list-unsubscribe|manage[-_]?preferences|privacy|cookie|terms|legal|impressum|careers|facebook|instagram|(^|\/\/|www\.)x\.com|twitter|linkedin|youtube|tiktok|reddit|pinterest|github|cdn\.|track|beacon|pixel|\/open\.php|\/view|\.(png|jpe?g|gif|webp|svg|css|js)(\?|$))/i;

// Parameters that typically carry the verification secret.
const TOKEN_PARAMS = /[?&](token|code|key|hash|ticket|jwt|sig|otp|verify|confirm|activation|email_token)=/i;

const MAIL_PROVIDER_HOSTS = /(mail\.tm|mail-tm|guerrillamail|mailinator|maildrop|1secmail|yopmail|tempmail|temp-mail|uberip|mail\.guru)/i;

/**
 * The score puts a verification link above other things: clear verification
 * words in the URL or in the link text score highest, while noisy links
 * (tracking, social networks, images) score low. Links longer than 30
 */
function scoreVerificationLink(href, anchorText) {
  if (!href) return -1000;
  const url = href.trim();
  if (/^(javascript|mailto|tel|sms|data):/i.test(url)) return -1000;
  if (url.startsWith('#') || url.length < 8) return -1000;

  let score = 0;

  if (LINK_NOISE_WORDS.test(url)) score -= 150;
  if (MAIL_PROVIDER_HOSTS.test(url)) score -= 150;

  if (VERIFY_URL_WORDS.test(url)) score += 100;
  if (anchorText && VERIFY_ANCHOR_WORDS.test(anchorText)) score += 60;
  if (TOKEN_PARAMS.test(url)) score += 50;

// A link that points back to the mail service is never the verification.
  return score;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function absolutizeLink(href, baseUrl) {
  const raw = decodeHtmlEntities(href).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!baseUrl) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Ranks verification links instead of taking the first that "looks right".
 * Returns { links, confident } where confident is only true when a link
 * cleared the score threshold, so a real verification link and not just noise.
 */
function extractVerificationLinks(html, baseUrl) {
  const source = html || '';
  const best = new Map();

  const consider = (href, anchorText) => {
    const url = absolutizeLink(href, baseUrl);
    if (!url) return;
    const score = scoreVerificationLink(url, anchorText);
    if (score <= -1000) return;
    const existing = best.get(url);
    if (!existing || existing.score < score) best.set(url, { url, score });
  };

// 1) Anchors with their link text, the strongest signal.
  const anchorRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(source)) !== null) {
    consider(m[1], stripHtml(m[2] || '').trim());
  }

  // 2) Nakna URL:er i texten (plaintext-mejl saknar ofta ankare).
  const bareRe = /https?:\/\/[^\s"'<>()[\]{}\\^`|]+/gi;
  while ((m = bareRe.exec(source)) !== null) {
    consider(m[0], '');
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score);
  const strong = ranked.filter((c) => c.score >= 100);
  if (strong.length) {
    return { links: strong.map((c) => c.url), confident: true };
  }

// No clear verification link. Still take the best candidates, but mark the
// result as uncertain so that we do not claim the account is verified.
  const weak = ranked.filter((c) => c.score > 0).slice(0, 3);
  return { links: weak.map((c) => c.url), confident: false };
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ');
}

/**
 * allowGeneric=false is used once we already found a clear verification link.
 * Then we must not pick up arbitrary four to eight digit numbers (order
 * numbers, timestamps) as a "code", because they would win over the link
 */
function extractOtpFromContent(html, text, allowGeneric = true) {
  const plain = `${stripHtml(html || '')} ${text || ''}`;
  const candidates = [];

// Extract all digit combinations with context, preferring these
  const contextualPatterns = [
    /(?:verification|verify|code|pin|otp|passcode|security|token|challenge|auth)[:\s#-]*(\d{4,8})/gi,
    /(?:kod|verifiering|bekräftelse)[:\s#-]*(\d{4,8})/gi,
// Extract all digit combinations with context, preferring these
    /(?:enter|use|input|type|skriv|ange)[\s:]*(\d{4,8})[\s:]*(?:code|pin|otp|to|for|below|nedan|that|as)/gi,
    /(?:code|kod|pin|otp)[:\s]*(\d{3})[-\s](\d{3})/gi,
  ];

  for (const regex of contextualPatterns) {
    let m;
    while ((m = regex.exec(plain)) !== null) {
      const code = (m[1] || '') + (m[2] || '');
      const clean = code.replace(/\D/g, '');
      if (clean.length >= 4 && clean.length <= 8 && !/^20\d{2}$/.test(clean)) {
        candidates.push({ code: clean, contextual: true });
      }
    }
  }

// Generic patterns as a backup, only if nothing contextual was found
  if (allowGeneric && !candidates.some((c) => c.contextual)) {
    const genericPatterns = [
      /\b(\d{6})\b/g,
      /\b(\d{8})\b/g,
      /\b(\d{4})\b/g,
    ];
    for (const regex of genericPatterns) {
      let m;
      while ((m = regex.exec(plain)) !== null) {
        const clean = m[1].replace(/\D/g, '');
        if (clean.length >= 4 && clean.length <= 8 && !/^20\d{2}$/.test(clean)) {
          candidates.push({ code: clean, contextual: false });
        }
      }
    }
  }

  const six = candidates.filter((c) => c.code.length === 6);
  if (six.length) return six[0].code;
  const eight = candidates.filter((c) => c.code.length === 8);
  if (eight.length) return eight[0].code;
  const four = candidates.filter((c) => c.code.length === 4);
  if (four.length) return four[0].code;
  return null;
}

function getMailMsgId(msg) {
  const id = msg.id || (msg['@id'] ? msg['@id'].split('/').pop() : null);
  return id || String(Math.random());
}

function parseMailResult(html, text, subject, baseUrl) {
// Plain text mails often have no anchors at all, so we must search the text too.
  const haystack = [html || '', text || ''].filter(Boolean).join('\n');
  const { links, confident } = extractVerificationLinks(haystack, baseUrl);
// Only look for a loose code when we do not already have a clear link.
  const otp = extractOtpFromContent(html, text, !confident);
  return {
    success: !!(otp || links.length > 0),
    subject,
    links,
    linkConfident: confident,
    otp,
    bodyPreview: (text || stripHtml(html || '')).substring(0, 120),
  };
}

async function pollMailTmForVerification(token, baseUrl, maxAttempts = 40) {
  updateBadge('...', '#f59e0b');
  await sleep(6000);
  heartbeat();

  for (let i = 0; i < maxAttempts; i++) {
    updateBadge(`${i + 1}/${maxAttempts}`, '#3b82f6');
    try {
      const res = await fetch(`${MAILTM_BASE}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      heartbeat();

      if (!res.ok) {
        if (res.status === 401) {
          flashBadge('X', '#ef4444', 6000);
          return { success: false, errorCode: 'mailtmTokenExpired', error: 'E-posttoken har löpt ut. Registrera om kontot.' };
        }
        const fatal = classifyMailApiError(res);
        if (fatal) {
          flashBadge('X', '#ef4444', 6000);
          return { success: false, errorCode: fatal.errorCode, error: fatal.message, status: res.status };
        }
      } else {
        const data = await res.json();
        const messages = data['hydra:member'] || [];
        for (const msg of messages) {
          const msgId = getMailMsgId(msg);
          if (!msgId) continue;
          const msgRes = await fetch(`${MAILTM_BASE}/messages/${msgId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          heartbeat();
          if (!msgRes.ok) continue;
          const detail = await msgRes.json();
          const html = Array.isArray(detail.html) ? detail.html.join(' ') : detail.html || '';
          const text = detail.text || detail.intro || '';
          const result = parseMailResult(html, text, detail.subject, baseUrl);
          if (result.success) {
              flashBadge('✓', '#10b981', 4000);
            return result;
          }
        }
      }
    } catch (err) {
// Network error, so try again, but remember to keep the worker alive.
      heartbeat();
    }

    await sleep(3000);
    heartbeat();
  }
  flashBadge('X', '#ef4444', 6000);
  return { success: false, errorCode: 'timeoutMailtm', error: 'Timeout: Inget verifieringsmejl inom 2 min.' };
}

async function pollTempMailForVerification(emailHash, rapidApiKey, baseUrl, maxAttempts = 40) {
  const headers = {
    'x-rapidapi-key': rapidApiKey,
    'x-rapidapi-host': 'privatix-temp-mail-v1.p.rapidapi.com',
  };

  updateBadge('...', '#f59e0b');
  await sleep(6000);
  heartbeat();

  for (let i = 0; i < maxAttempts; i++) {
    updateBadge(`${i + 1}/${maxAttempts}`, '#3b82f6');
    try {
      const res = await fetch(
        `${TEMPMAIL_RAPIDAPI}/request/mail/id/${emailHash}/format/json/`,
        { headers }
      );
      heartbeat();

      if (!res.ok) {
        const fatal = classifyMailApiError(res);
        if (fatal) {
          flashBadge('X', '#ef4444', 6000);
          return { success: false, errorCode: fatal.errorCode, error: fatal.message, status: res.status };
        }
      } else {
        const emails = await res.json();
        if (Array.isArray(emails) && emails.length > 0) {
          for (const mail of emails) {
            const text = mail.mail_text_only || mail.mail_text || mail.mail_preview || '';
            const html = Array.isArray(mail.mail_html) ? mail.mail_html.join(' ') : mail.mail_html || '';
            const result = parseMailResult(html, text, mail.mail_subject, baseUrl);
            if (result.success) {
            flashBadge('✓', '#10b981', 4000);
              return result;
            }
          }
        }
      }
    } catch (err) {
      heartbeat();
    }

    await sleep(3000);
    heartbeat();
  }
  flashBadge('X', '#ef4444', 6000);
  return { success: false, errorCode: 'timeoutTempmail', error: 'Timeout: Inget verifieringsmejl från temp-mail.org inom 2 min.' };
}

async function pollForVerification(credentials, baseUrl) {
  if (credentials.provider === 'tempmail') {
    return pollTempMailForVerification(credentials.emailHash, credentials.rapidApiKey, baseUrl);
  }
  return pollMailTmForVerification(credentials.mailToken, baseUrl);
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch {}
}

async function findOtpTab(originalTabId) {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'chrome-extension://*/*'] });
  for (const tab of tabs) {
    if (tab.id === originalTabId) continue;
    try {
      await injectContentScript(tab.id);
      const detect = await chrome.tabs.sendMessage(tab.id, { action: 'detectOtpPage' }).catch(() => null);
      if (detect?.isOtpPage) return tab.id;
    } catch {}
  }
  return null;
}

const VERIFY_SUCCESS_URL = /(verified|activated|confirmed|success|complete|welcome|valid|done)/i;
const VERIFY_FAIL_URL = /(expired|invalid|error|failed|failure|already-used|denied)/i;

/**
 * Opens the verification link and then follows what the page actually says.
 * Returns { verified, url, reason } so that we only set verified=true when
 * we have evidence, not merely because a link happened to open.
 */
async function openVerificationLink(link) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url: link, active: false });
  } catch {
    return { opened: false, verified: false, errorCode: 'cannotOpenLink', reason: 'Kunde inte öppna verifieringslänken.' };
  }
  if (!tab?.id) {
    return { opened: false, verified: false, errorCode: 'cannotOpenLink', reason: 'Kunde inte öppna verifieringslänken.' };
  }

  const { pendingVerification } = await chrome.storage.local.get({ pendingVerification: null });
  if (pendingVerification) {
    await chrome.storage.local.set({
      pendingVerification: { ...pendingVerification, tabId: tab.id },
    });
  }

  return { opened: true, verified: true, tabId: tab.id, url: link };
}

/**
 * Lets the verification page load and then asks it what happened.
 * A link that leads to "expired" therefore does not count as a success.
 */
async function waitForVerificationOutcome(tabId, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastUrl = '';
  let sawUrl = false;

  while (Date.now() < deadline) {
    await sleep(2000);
    heartbeat();

    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return { verified: false, errorCode: 'tabClosed', reason: 'Verifieringsfliken stängdes innan vi hann bekräfta.' };
    }
    if (!tab) continue;

    const url = tab.url || '';
    if (url !== lastUrl) {
      lastUrl = url;
      sawUrl = true;
      const outcome = await chrome.tabs
        .sendMessage(tabId, { action: 'verificationOutcome' })
        .catch(() => null);
      if (outcome?.failed) {
        return { verified: false, errorCode: 'linkRejected', url, reason: outcome.reason || 'Verifieringssidan nekade koden.' };
      }
      if (outcome?.verified) {
        return { verified: true, url, via: 'page' };
      }
      if (VERIFY_FAIL_URL.test(url)) {
        return { verified: false, errorCode: 'linkExpired', url, reason: 'Verifieringslänken är ogiltig eller utgången.' };
      }
      if (VERIFY_SUCCESS_URL.test(url)) {
        return { verified: true, url, via: 'url' };
      }
    }
  }

  if (!sawUrl) {
    return { verified: false, errorCode: 'noResponse', reason: 'Verifieringssidan svarade inte alls.' };
  }
  return {
    verified: false,
    errorCode: 'unconfirmed',
    url: lastUrl,
    reason: 'Kunde inte bekräfta verifieringen — sidan gav ingen tydlig bekräftelse.',
  };
}

async function applyVerificationToTab(tabId, mailResult, settings) {
// 1) A verification link is the strongest signal, so open it first.
  if (mailResult.links?.length > 0 && settings.autoClickVerification) {
    const link = mailResult.links[0];
    const opened = await openVerificationLink(link);
    if (!opened.opened) {
      return { method: 'link', link, opened: false, success: false, code: opened.code, error: opened.reason };
    }

    if (!mailResult.linkConfident) {
// The link was found but is not certainly a verification link. We open it
// in the background but do not claim the account is verified.
      return {
        method: 'link',
        link,
        opened: true,
        success: false,
        unconfirmed: true,
        errorCode: 'unconfirmed',
        error: 'Hittade en möjlig länk men kunde inte bekräfta att den verifierar kontot. Öppna den manuellt om du vill.',
      };
    }

    const outcome = await waitForVerificationOutcome(opened.tabId);
    if (outcome.verified) {
      return { method: 'link', link, opened: true, success: true, verifiedUrl: outcome.url };
    }
    return {
      method: 'link',
      link,
      opened: true,
      success: false,
      errorCode: outcome.errorCode || 'unconfirmed',
      error: outcome.reason,
    };
  }

  // 2) Annars: letta upp en kod och fyll i den.
  if (mailResult.otp) {
    await injectContentScript(tabId);
    let fillRes = await chrome.tabs
      .sendMessage(tabId, {
        action: 'fillOtp',
        code: mailResult.otp,
        autoSubmit: settings.autoSubmitForm !== false,
      })
      .catch(() => null);

    if (!fillRes?.success) {
      const otpTabId = await findOtpTab(tabId);
      if (otpTabId) {
        tabId = otpTabId;
        fillRes = await chrome.tabs
          .sendMessage(otpTabId, {
            action: 'fillOtp',
            code: mailResult.otp,
            autoSubmit: settings.autoSubmitForm !== false,
          })
          .catch(() => null);
      }
    }

    if (fillRes?.success) {
      return { method: 'otp', tabId, code: mailResult.otp, success: true, ...fillRes };
    }
    return {
      method: 'otp',
      code: mailResult.otp,
      errorCode: 'codeNoField',
      success: false,
      error: `Hittade kod ${mailResult.otp} men ingen verifieringssida med kodfält hittades.`,
    };
  }

  return { method: 'none', success: false, errorCode: 'nothingExtracted', error: 'Hittade mail men ingen verifieringslänk eller kod kunde extraheras.' };
}

const VERIFICATION_JOB_TTL = 4 * 60 * 1000;
let verificationInProgress = false;

/**
 * Runs the whole verification flow: polls the inbox, opens the link or code
 * and confirms the result. The job is stored so it can be resumed if the
 * service worker is interrupted in the middle of the wait.
 */
/**
 * Runs the verification on the built in test page. The page shows the code on
 * screen instead of mailing it, so we read it and fill it in, the same path
 * as on a real site, only with the code from the page instead of an inbox.
 * The user should never have to click Verify themselves.
 */
async function runLocalTestVerification(account, tabId, settings) {
  updateBadge('…', '#f59e0b');
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    await sleep(1500);
    heartbeat();

    await injectContentScript(tabId).catch(() => {});

    const detect = await chrome.tabs.sendMessage(tabId, { action: 'detectOtpPage' }).catch(() => null);
    if (!detect?.isOtpPage) continue;

    const visible = await chrome.tabs.sendMessage(tabId, { action: 'readVisibleCode' }).catch(() => null);
    const code = visible?.code;
    if (!code) continue;

    const filled = await chrome.tabs
      .sendMessage(tabId, {
        action: 'fillOtp',
        code,
        autoSubmit: settings.autoSubmitForm !== false,
      })
      .catch(() => null);

    if (filled?.success) {
      await markAccountVerified(account.id);
      flashBadge('✓', '#10b981', 4000);
      return { success: true, method: 'otp', code, submitted: !!filled.result?.submitted, localSimulated: true };
    }
  }

  flashBadge('✗', '#ef4444', 6000);
  return {
    success: false,
    localSimulated: true,
    errorCode: 'localTestTimeout',
    error: 'The test page never showed a verification code.',
  };
}

async function markAccountVerified(accountId) {
  if (!accountId) return;
  const data = await chrome.storage.local.get({ accounts: [] });
  await chrome.storage.local.set({
    accounts: data.accounts.map((a) =>
      a.id === accountId ? { ...a, verified: true, verifiedAt: new Date().toISOString() } : a
    ),
  });
}

/**
 * Is a verification already running?
 *
 * The in memory variable is the only reliable signal while the worker lives.
 * The stored job is only used to detect dead jobs: if the pulse is older than
 * STALE the worker died mid task and the lock has to be released, otherwise
 * it blocks here for four minutes (up to VERIFICATION_JOB_TTL).
 */
const VERIFICATION_JOB_STALE_MS = 25000;

async function isVerificationBusy() {
  if (verificationInProgress) return true;
  const { verificationJob } = await chrome.storage.local.get({ verificationJob: null });
  if (!verificationJob?.account) return false;

  const lastSeen = verificationJob.heartbeatAt || verificationJob.startedAt || 0;
  if (Date.now() - lastSeen > VERIFICATION_JOB_STALE_MS) {
// Dead job, so remove it so it does not block forever.
    await chrome.storage.local.remove('verificationJob');
    return false;
  }
  return true;
}

async function runAutoVerification(account, tabId, baseUrl) {
  const settings = await getSettings();

// The extension test page simulates the verification inside the page. Polling a
// real inbox would be pointless, so we read the code off the page instead.
  if (typeof baseUrl === 'string' && baseUrl.startsWith('chrome-extension://')) {
    await chrome.storage.local.remove(['pendingVerification', 'verificationJob']);
    return runLocalTestVerification(account, tabId, settings);
  }

  const credentials = {
    provider: account.provider,
    mailToken: account.mailToken,
    emailHash: account.emailHash,
    rapidApiKey: account.rapidApiKey,
  };

  if (!credentials.mailToken && !credentials.emailHash) {
    flashBadge('X', '#ef4444', 6000);
    return { success: false, errorCode: 'noMailCredentials', error: 'Saknar e-postuppgifter för verifiering.' };
  }

  await chrome.storage.local.set({
    verificationJob: { account, tabId, startedAt: Date.now() },
  });

  let mailResult;
  try {
    mailResult = await pollForVerification(credentials, baseUrl);
  } finally {
    await chrome.storage.local.remove('verificationJob');
  }

  if (!mailResult.success && !mailResult.otp && !mailResult.links?.length) {
    flashBadge('X', '#ef4444', 6000);
    return mailResult.error
      ? mailResult
      : { success: false, errorCode: 'noMailFound', error: 'Inget verifieringsmejl hittades.' };
  }

  const applied = await applyVerificationToTab(tabId, mailResult, settings);

// We only set verified=true when we actually have evidence for it.
  if (applied?.success) {
    await chrome.storage.local.remove('pendingVerification');
    const data = await chrome.storage.local.get({ accounts: [] });
    const accounts = data.accounts.map((a) =>
      a.id === account.id ? { ...a, verified: true, verifiedAt: new Date().toISOString() } : a
    );
    await chrome.storage.local.set({ accounts });
    flashBadge('✓', '#10b981', 4000);
    return { success: true, ...applied, subject: mailResult.subject };
  }

  flashBadge('!', '#f59e0b', 6000);
  return {
    success: false,
    method: applied?.method,
    code: mailResult.otp,
    link: mailResult.links?.[0] || null,
    errorCode: applied?.errorCode || 'generic',
    error: applied?.error || 'Kunde inte verifiera kontot automatiskt.',
  };
}

/**
 * If the worker was restarted in the middle of a wait we continue from
 * where we left off, as long as the job is not too old.
 */
async function resumeVerificationIfNeeded() {
  if (verificationInProgress) return;
  const { verificationJob } = await chrome.storage.local.get({ verificationJob: null });
  if (!verificationJob?.account) return;
  if (Date.now() - (verificationJob.startedAt || 0) > VERIFICATION_JOB_TTL) {
    await chrome.storage.local.remove('verificationJob');
    return;
  }
// If the job has a fresh pulse another worker instance is already on it,
// so we must not run a second poll in parallel, just let that one handle it.
  const lastSeen = verificationJob.heartbeatAt || verificationJob.startedAt || 0;
  if (Date.now() - lastSeen <= VERIFICATION_JOB_STALE_MS) return;

  verificationInProgress = true;
  flashBadge('…', '#f59e0b', 2500);
  try {
    await runAutoVerification(verificationJob.account, verificationJob.tabId, verificationJob.baseUrl);
  } catch {
/* quietly, the next navigation tries again */
  } finally {
    verificationInProgress = false;
  }
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

async function getAccountsForSite(hostname) {
  const data = await chrome.storage.local.get({ accounts: [] });
  const key = getSiteKey(`https://${hostname}`);
  return data.accounts.filter((a) => {
    const site = (a.website || '').replace(/^www\./, '');
    const current = hostname.replace(/^www\./, '');
    return (
      site === key ||
      site === current ||
      current.includes(site) ||
      site.includes(current) ||
      (key.includes('yahoo') && site.includes('yahoo'))
    );
  });
}

/**
 * Trims the account list to the save limit. The list is kept newest first, so
 * when it passes the limit the oldest are removed automatically.
 * Returns { accounts, removed } so the calling interface can inform the user.
 */
function applyRetention(accounts, limit) {
  const max = normalizeRetention(limit);
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length <= max) return { accounts: list, removed: 0 };
  return { accounts: list.slice(0, max), removed: list.length - max };
}

/** Sorts newest first, using createdAt as the basis. */
function sortNewestFirst(accounts) {
  return [...accounts].sort((a, b) => {
    const ta = Date.parse(a?.createdAt || '') || 0;
    const tb = Date.parse(b?.createdAt || '') || 0;
    return tb - ta;
  });
}

async function saveAccount(account) {
  const settings = await getSettings();
  const data = await chrome.storage.local.get({ accounts: [] });
// The same website plus e mail replaces the old account instead of duplicating.
  const deduped = (data.accounts || []).filter(
    (a) => !(a.website === account.website && a.email === account.email)
  );
  const merged = sortNewestFirst([account, ...deduped]);
  const { accounts, removed } = applyRetention(merged, settings.retentionLimit);
  await chrome.storage.local.set({ accounts });
  return { accounts, removed };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || verificationInProgress) return;

  const { pendingVerification, verificationJob } = await chrome.storage.local.get({
    pendingVerification: null,
    verificationJob: null,
  });
  if (!pendingVerification?.account) return;

// If a job is already running, runAutoVerification sees to it. We only take
// over when the job has died or never started.
  if (verificationJob && Date.now() - (verificationJob.startedAt || 0) <= VERIFICATION_JOB_TTL) return;

  const isVerificationUrl =
    /(verify|verification|challenge|otp|code|confirm|verif|activate|aktivera|magic-?link)/i.test(tab.url);
  if (!isVerificationUrl) return;

  const { accounts } = await chrome.storage.local.get({ accounts: [] });
  const current = accounts.find((a) => a.id === pendingVerification.account?.id);
  if (current?.verified) {
    flashBadge('✓', '#10b981', 3000);
    return;
  }

  flashBadge('🔑', '#8b5cf6', 2500);
  verificationInProgress = true;
  try {
    await runAutoVerification(pendingVerification.account, tabId, tab.url);
  } finally {
    verificationInProgress = false;
  }
});

// Resumes an interrupted verification when the worker starts.
chrome.runtime.onStartup?.addListener(() => { resumeVerificationIfNeeded(); });
resumeVerificationIfNeeded();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getLicenseStatus': {
          const canStart = await canStartRun();
          const limits = await getFeatureLimits();
          sendResponse({
            success: true,
            isPro: canStart.tier === 'pro',
            canStart,
            limits,
          });
          break;
        }

        case 'consumeRunSlot': {
          const slot = await consumeFreeRunSlot();
          sendResponse({ success: slot.allowed, ...slot });
          break;
        }

        case 'activateLicense': {
          const res = await activateLicense(request.key);
          sendResponse(res);
          break;
        }

        case 'deactivateLicense': {
          sendResponse(await deactivateLicense());
          break;
        }

        case 'getSettings':
          sendResponse({ success: true, settings: await getSettings() });
          break;

        case 'saveSettings': {
          const next = { ...DEFAULT_SETTINGS, ...request.settings };
          next.retentionLimit = normalizeRetention(next.retentionLimit);
          if (!['en', 'sv', 'tr', 'ar', 'es', 'de', 'fr'].includes(next.language)) {
            next.language = DEFAULT_SETTINGS.language;
          }
          await chrome.storage.local.set({ settings: next });
// A lowered save limit must apply right away, so trim the list now.
          const { accounts } = await chrome.storage.local.get({ accounts: [] });
          const trimmed = applyRetention(sortNewestFirst(accounts), next.retentionLimit);
          if (trimmed.removed > 0) await chrome.storage.local.set({ accounts: trimmed.accounts });
          sendResponse({ success: true, settings: next, removed: trimmed.removed });
          break;
        }

        case 'getNewProfile': {
// Hard gate: the cooldown is checked here, not only in the popup, so a
// A strict save limit must apply right away, so trim the list now.
// always detach their own popup, but this is the way to a profile.
          const slot = await consumeFreeRunSlot();
          if (!slot.allowed) {
            sendResponse({ success: false, ...slot });
            break;
          }
          sendResponse({ success: true, profile: await generateProfile() });
          break;
        }

        case 'saveAccount': {
          const res = await saveAccount(request.account);
          sendResponse({ success: true, accounts: res.accounts, removed: res.removed });
          break;
        }

        case 'getAccounts':
          sendResponse({ success: true, accounts: (await chrome.storage.local.get({ accounts: [] })).accounts });
          break;

        case 'getAccountsForSite':
          sendResponse({ success: true, accounts: await getAccountsForSite(request.hostname) });
          break;

        case 'deleteAccount':
          {
            const data = await chrome.storage.local.get({ accounts: [] });
            const accounts = data.accounts.filter((a) => a.id !== request.id);
            await chrome.storage.local.set({ accounts });
            sendResponse({ success: true, accounts });
          }
          break;

        case 'pollVerificationEmail': {
          const settings = await getSettings();
          const credentials = {
            provider: request.provider,
            mailToken: request.mailToken,
            emailHash: request.emailHash,
            rapidApiKey: request.rapidApiKey || settings.rapidApiKey,
          };
          const result = await pollForVerification(credentials, request.baseUrl);

          if (result.links?.length > 0 || result.otp) {
            const applied = await applyVerificationToTab(request.tabId, result, settings);
            sendResponse({ ...result, applied, link: result.links?.[0] || null });
          } else {
            sendResponse(result);
          }
          break;
        }

        case 'autoVerify': {
          if (await isVerificationBusy()) {
            sendResponse({ success: false, errorCode: 'alreadyRunning', error: 'En verifiering pågår redan. Vänta ett ögonblick.' });
            break;
          }
          flashBadge('…', '#f59e0b', 2500);
          verificationInProgress = true;
          try {
            const result = await runAutoVerification(request.account, request.tabId, request.baseUrl);
            sendResponse(result);
          } finally {
            verificationInProgress = false;
          }
          break;
        }

        case 'startPendingVerification': {
          await chrome.storage.local.set({
            pendingVerification: { tabId: request.tabId, account: request.account },
          });
          sendResponse({ success: true });
          break;
        }

        case 'isOtpPage': {
          sendResponse({ success: true });
          break;
        }

        case 'exportEncrypted': {
          const data = await chrome.storage.local.get({ accounts: [] });
          const encrypted = await encryptData(JSON.stringify(data.accounts), request.password);
          sendResponse({ success: true, encrypted });
          break;
        }

        case 'importEncrypted': {
          const decrypted = await decryptData(request.encrypted, request.password);
          const imported = JSON.parse(decrypted);
          if (!Array.isArray(imported)) throw new Error('Ogiltig filstruktur.');
          const settings = await getSettings();
          const data = await chrome.storage.local.get({ accounts: [] });
          const merged = [...imported];
          data.accounts.forEach((existing) => {
            if (!merged.some((m) => m.website === existing.website && m.email === existing.email)) {
              merged.push(existing);
            }
          });
          const trimmed = applyRetention(sortNewestFirst(merged), settings.retentionLimit);
          await chrome.storage.local.set({ accounts: trimmed.accounts });
          sendResponse({ success: true, accounts: trimmed.accounts, removed: trimmed.removed });
          break;
        }

        default:
          sendResponse({ success: false, errorCode: 'unknownAction', error: 'Okänd åtgärd.' });
      }
    } catch (err) {
      sendResponse({ success: false, errorCode: err?.errorCode || 'generic', error: err.message || String(err) });
    }
  })();
  return true;
});
