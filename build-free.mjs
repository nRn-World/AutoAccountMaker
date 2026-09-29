#!/usr/bin/env node
/**
 * build-free.mjs, generates the free version of AutoAccountMaker
 *
 * The source tree in extension/ holds the license signing secret, which may
 * never be published. This script therefore builds free-build/: a free version
 * with no keys, no Pro tier and no secret. The cooldown (one registration
 * every three hours) stays, because that is the free tier.
 *
 * Run:  node build-free.mjs
 * Test:  the next step loads free-build/ in a real browser.
 *
 * The script EXITS WITH AN ERROR if any secret is left in the output. That is
 * the last line of defense, not a formality.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'free-build');
const FREE_SRC = path.join(ROOT, 'free-src');

// Patterns that must NEVER leave the source tree. If any of this ends up in
// free-build/, anyone can mint Pro keys.
//
// NOTE: the actual secret must NOT be written here. This script is version
// controlled, so a hardcoded secret here would be a leak exactly like the one we
// are trying to stop. We match the shape instead: 64 hex characters.
const SECRET_SHAPE = /['"][0-9a-f]{64}['"]/;

const FORBIDDEN = [
  { name: 'secret in cleartext (64 hex)', re: SECRET_SHAPE },
  { name: 'MASTER_SECRET with a value', re: /MASTER_SECRET\s*=\s*['"][0-9a-f]{32,}/i },
  { name: 'HMAC key generation', re: /hmacHex|createHmac|verifyHmacKey|checksumForSerial/ },
  { name: 'sold or generated key', re: /AAM-PRO-\d{4}-[0-9a-f]{4}-[0-9a-f]{4}/i },
  { name: 'key hash list', re: /LICENSE_KEY_HASHES\s*=\s*new Set\(\[[^\]]*[0-9a-f]{32}/ },
  { name: 'license key field', re: /id="inputLicenseKey"|activateLicense|btnActivateLicense/ },
  { name: 'key generator', re: /AAM-PRO-\$\{/ },
  // CODE only, not translation strings. "licenseProActive" in i18n.js is an
  // ordinary string and must not block the build.
  { name: 'signature code left over', re: /hmacHex|verifyHmacKey|checksumForSerial|safeEqual/ },
];

const problems = [];
function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Removes an HTML block between two markers, the markers included. */
function cutBlock(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    problems.push(`${label}: the start marker "${startMarker}" was not found`);
    return text;
  }
  const endIdx = text.indexOf(endMarker, start);
  if (endIdx === -1) {
    problems.push(`${label}: the end marker "${endMarker}" was not found`);
    return text;
  }
  return text.slice(0, start) + text.slice(endIdx + endMarker.length);
}

/**
 * Removes a whole <div> element by counting the depth of opening and
 * closing tags. A plain indexOf on "</div>" is not enough, because the license
 * box holds several nested divs, and it is then easy to leave half of the
 * interface behind. That is exactly what happened the first time.
 */
function removeElement(text, openTag, label) {
  const start = text.indexOf(openTag);
  if (start === -1) {
    problems.push(`${label}: "${openTag}" was not found`);
    return text;
  }
  const tag = openTag.match(/^<([a-zA-Z][\w-]*)/)[1];
  const open = new RegExp(`<${tag}\\b`, 'gi');
  const close = new RegExp(`</${tag}>`, 'gi');
  let depth = 0, i = start;
  while (i < text.length) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(text);
    const c = close.exec(text);
    if (c && (!o || c.index < o.index)) {
      depth--;
      i = c.index + c[0].length;
      if (depth === 0) return text.slice(0, start) + text.slice(i);
    } else if (o) {
      depth++;
      i = o.index + o[0].length;
    } else break;
  }
  problems.push(`${label}: could not match a closing </${tag}>`);
  return text;
}

// ---------------------------------------------------------------------------
// 1) Clean the directory
// ---------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(SRC, OUT);

// license.js is replaced by cooldown.js. The signing secret never leaves the
// private directory.
fs.rmSync(path.join(OUT, 'license.js'), { force: true });
fs.copyFileSync(path.join(FREE_SRC, 'cooldown.js'), path.join(OUT, 'cooldown.js'));

// ---------------------------------------------------------------------------
// 2) popup.html: remove the key field and its CSS
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'popup.html');
  let s = read(f);

  // The whole license box, including all nested divs.
  s = removeElement(s, '<div class="license" id="licenseBox">', 'popup.html license box');

  // Instead a single line that states the free tier, so the user is not
  // surprised when the button locks after a run. The note is itself the link to
  // the shop: the free build has no license box left, so this is the only place
  // a free user can find out that Pro exists.
  s = s.replace(
    '  <button class="btn-verify" id="btnVerify" style="display:none;"',
    '  <a class="free-note" id="freeNote" href="https://ko-fi.com/s/da557f599c" target="_blank" rel="noopener noreferrer" data-i18n="popup.freeTierNote">Free version: one automated sign-up every 3 hours.</a>\n\n  <button class="btn-verify" id="btnVerify" style="display:none;"'
  );

  // license.js does not survive, so the tag has to go. Leaving it makes the
  // browser log ERR_FILE_NOT_FOUND every time the popup is opened.
  s = s.replace(/\s*<script src="license\.js"><\/script>\n/, '\n');

  // CSS block for the license. Anchored on class names, never on the comment
  // text, so translating the popup cannot silently break the strip.
  s = s.replace(/    \/\*[^*]*\*\/\n    \.license \{[\s\S]*?\.license-deactivate:hover \{[^}]*\}\n/,
    `    .free-note {\n      display: block;\n      margin-top: 8px;\n      padding: 7px 10px;\n      background: #1e293b;\n      border: 1px solid #334155;\n      border-radius: 8px;\n      font-size: 10px;\n      color: #64748b;\n      text-align: center;\n      text-decoration: none;\n      transition: border-color 0.15s, color 0.15s;\n    }\n    .free-note:hover {\n      color: #e2e8f0;\n      border-color: #10b981;\n    }\n`);

  if (s.includes('license.js')) {
    problems.push('popup.html: license.js is still present in a script tag');
  }

  write(f, s);
}

// ---------------------------------------------------------------------------
// 3) popup.js: remove all Pro logic
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'popup.js');
  let s = read(f);

  // DOM references
  s = s.replace(
    /const licenseStatus = document\.getElementById\('licenseStatus'\);[\s\S]*?const btnDeactivateLicense = document\.getElementById\('btnDeactivateLicense'\);\n/,
    ''
  );

  // renderLicenseState / refreshLicenseState / startLicenseCountdown.
  // Anchored on the function names so translating the comments cannot break it.
  s = s.replace(
    /\/\*\*[\s\S]*?\*\/\s*function renderLicenseState[\s\S]*?\n\}\n\nfunction startLicenseCountdown\(\)[\s\S]*?\n\}\n\n/,
    ''
  );
  s = s.replace(/btnActivateLicense\?\.addEventListener\('click'[\s\S]*?\n\}\);\n\nbtnDeactivateLicense\?\.addEventListener\('click'[\s\S]*?\n\}\);\n\n/, '');
  s = s.replace(/if \(btnBuyPro && typeof KOFI_URL === 'string' && KOFI_URL\) \{[\s\S]*?\n\}\n\n/, '');

  // Remaining calls
  s = s.replace(/  await refreshLicenseState\(\);\n  startLicenseCountdown\(\);\n/, '');
  // The cooldown is rejected here, so mirror it in the interface with a
  // countdown and the buy button. Anchored on the guard, not on the comment.
  s = s.replace(
    /[ \t]*\/\/[^\n]*\n    if \(profileRes\?\.reason === 'cooldown'\) \{[\s\S]*?\n    \}\n/,
    `// The cooldown is rejected here, so show the time left and lock the button.
    if (profileRes?.reason === 'cooldown') {
      cooldownUntil = Date.now() + (profileRes.remainingMs || 0);
      log(t('popup.licenseCooldownText', profileRes.remainingLabel || ''), 'error');
      statusText.textContent = t('popup.licenseFreeBlocked');
      stepsBox.classList.remove('visible');
      btnRegister.disabled = true;
      btnLogin.disabled = false;
      return;
    }
`
  );
  s = s.replace(/  renderLicenseState\(isPro \? 0 : Math\.max\(0, cooldownUntil - Date\.now\(\)\)\);\n/,
                '  cooldownUntil = 0;\n');
  s = s.replace(/^let isPro = false;\n/m, '');
  s = s.replace(/^let cooldownUntil = 0;\nlet cooldownUntil = 0;\n/m, 'let cooldownUntil = 0;\n');
  s = s.replace(/^let licenseTimer = null;\n/m, '');

  // Afterwards no Pro reference may remain.
  for (const bad of ['isPro', 'renderLicenseState', 'refreshLicenseState', 'startLicenseCountdown',
                     'licenseTimer', 'licenseStatus', 'licenseCooldown', 'licensePro',
                     'licenseEntry', 'btnBuyPro', 'inputLicenseKey', 'btnActivateLicense',
                     'btnDeactivateLicense', 'licenseResult', 'KOFI_URL']) {
    if (new RegExp(`\\b${bad}\\b`).test(s)) {
      problems.push(`popup.js: "${bad}" is still present after removal`);
    }
  }

  write(f, s);
}

// ---------------------------------------------------------------------------
// 4) background.js: no license messages, import cooldown.js instead
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'background.js');
  let s = read(f);

  // Swap the license import for the cooldown import. Matches on the import
  // call itself so any comment above it may be in any language.
  s = s.replace(
    /(?:\/\/[^\n]*\n)+if \(typeof importScripts === 'function'\) \{\n  importScripts\('license\.js'\);\n\}/,
    "// cooldown.js, the free tier rate limit, is loaded into the service worker.\nif (typeof importScripts === 'function') {\n  importScripts('cooldown.js');\n}"
  );

  // Remove the four license messages
  s = s.replace(
    /        case 'getLicenseStatus': \{[\s\S]*?\n        \}\n\n        case 'deactivateLicense': \{\n          sendResponse\(await deactivateLicense\(\)\);\n          break;\n        \}\n\n/,
    ''
  );
  s = s.replace(
    /        case 'getLicenseStatus': \{[\s\S]*?        case 'getSettings':/,
    '        case \'getSettings\':'
  );

  write(f, s);
}

// ---------------------------------------------------------------------------
// 5) MANIFEST: point it at cooldown.js
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'manifest.json');
  const m = JSON.parse(read(f));
  m.version = m.version || '1.12.0';
  write(f, JSON.stringify(m, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// 6) Readable line: report what was actually removed
// ---------------------------------------------------------------------------
console.log('Generated free-build/');
console.log('  removed:    license.js (signing secret, key validation, Pro)');
console.log('  replaced:   cooldown.js (one registration every three hours)');
console.log('  removed:    key field, Pro button, Pro status in the popup');
console.log('  removed:    activateLicense / getLicenseStatus / deactivateLicense');

// ---------------------------------------------------------------------------
// 7) LAST LINE OF DEFENSE: stop the build if a secret is left over
// ---------------------------------------------------------------------------
const offenders = [];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(p); continue; }
    if (!/\.(js|json|html|css|md|txt)$/i.test(entry.name)) continue;
    const text = read(p);
    for (const rule of FORBIDDEN) {
      if (rule.re.test(text)) {
        offenders.push(`${path.relative(OUT, p)} — ${rule.name}`);
      }
    }
  }
}
scan(OUT);

if (offenders.length) {
  console.error('\nBUILD ABORTED. The following is in the free version and may not be published:');
  for (const o of offenders) console.error('  - ' + o);
  process.exit(1);
}

if (problems.length) {
  console.error('\nBUILD ABORTED. The following could not be handled:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log('\nVerified: no secret, no key and no Pro in free-build/.');
