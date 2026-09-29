#!/usr/bin/env node
/**
 * build-free.mjs — genererar gratisversionen av AutoAccountMaker
 *
 * Källträdet i extension/ innehåller licenssigneringshemligheten, som aldrig
 * får publiceras. Det här skriptet bygger därför free-build/ — en gratisversion
 * UTAN nycklar, UTAN Pro-nivå och UTAN hemlighet. Cooldownen (1 registrering
 * per 3 timmar) finns kvar, eftersom det är gratisnivån.
 *
 * Kör:  node build-free.mjs
 * Test:  det efterföljande steget laddar free-build/ i en riktig browser.
 *
 * Skriptet AVSLUTAR MED ett fel om någon hemlighet finns kvar i utdata. Det är
 * den sista försvarslinjen, inte en formalitet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'extension');
const OUT = path.join(ROOT, 'free-build');
const FREE_SRC = path.join(ROOT, 'free-src');

// Mönster som ALDRIG får lämna källträdet. Om något av detta hamnar i
// free-build/ kan vem som helst skapa Pro-nycklar.
//
// OBS: här får INTE den faktiska hemligheten skrivas ut. Detta skript versions-
// sätts, så en hårdkodad hemlighet här vore en läcka precis som den vi försöker
// stoppa. Vi matchar formen i stället: 64 hex-tecken.
const SECRET_SHAPE = /['"][0-9a-f]{64}['"]/;

const FORBIDDEN = [
  { name: 'hemlighet i klartext (64 hex)', re: SECRET_SHAPE },
  { name: 'MASTER_SECRET med värde', re: /MASTER_SECRET\s*=\s*['"][0-9a-f]{32,}/i },
  { name: 'HMAC-nyckelgenerering', re: /hmacHex|createHmac|verifyHmacKey|checksumForSerial/ },
  { name: 'såld eller genererad nyckel', re: /AAM-PRO-\d{4}-[0-9a-f]{4}-[0-9a-f]{4}/i },
  { name: 'nyckel-hashlista', re: /LICENSE_KEY_HASHES\s*=\s*new Set\(\[[^\]]*[0-9a-f]{32}/ },
  { name: 'aktiveringsnyckel-fält', re: /id="inputLicenseKey"|activateLicense|btnActivateLicense/ },
  { name: 'nyckelgenerator', re: /AAM-PRO-\$\{/ },
  // Endast KOD, inte översättningssträngar. "licenseProActive" i i18n.js är en
  // vanlig text och ska inte blockera bygget.
  { name: 'signaturkod kvar', re: /hmacHex|verifyHmacKey|checksumForSerial|safeEqual/ },
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

/** Tar bort ett HTML-block mellan två markörer, inklusive markörerna. */
function cutBlock(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start === -1) {
    problems.push(`${label}: startmarkören "${startMarker}" hittades inte`);
    return text;
  }
  const endIdx = text.indexOf(endMarker, start);
  if (endIdx === -1) {
    problems.push(`${label}: slutmarkören "${endMarker}" hittades inte`);
    return text;
  }
  return text.slice(0, start) + text.slice(endIdx + endMarker.length);
}

/**
 * Tar bort ett helt <div>-element genom att räkna djupet på öppnande och
 * stängande taggar. En enkel indexOf mot "</div>" räcker inte — licensrutan
 * innehåller flera nästlade divar, och då blir det lätt att lämna halva
 * gränssnittet kvar. Det var exakt vad som hände första gången.
 */
function removeElement(text, openTag, label) {
  const start = text.indexOf(openTag);
  if (start === -1) {
    problems.push(`${label}: "${openTag}" hittades inte`);
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
  problems.push(`${label}: kunde inte matcha slutet </${tag}>`);
  return text;
}

// ---------------------------------------------------------------------------
// 1) Rensa katalogen
// ---------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(SRC, OUT);

// license.js ersätts av cooldown.js. signaturhemligheten lämnar aldrig den
// privata katalogen.
fs.rmSync(path.join(OUT, 'license.js'), { force: true });
fs.copyFileSync(path.join(FREE_SRC, 'cooldown.js'), path.join(OUT, 'cooldown.js'));

// ---------------------------------------------------------------------------
// 2) popup.html — ta bort nyckelfältet och CSS:en för det
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'popup.html');
  let s = read(f);

  // Hela licensrutan, inklusive alla nästlade divar.
  s = removeElement(s, '<div class="license" id="licenseBox">', 'popup.html licensbox');

  // Istället en enkel rad som berättar om gratisnivån, så användaren inte
  // blir förvånad när knappen låser efter en körning.
  s = s.replace(
    '  <button class="btn-verify" id="btnVerify" style="display:none;"',
    '  <div class="free-note" id="freeNote" data-i18n="popup.freeTierNote">Free version: one automated sign-up every 3 hours.</div>\n\n  <button class="btn-verify" id="btnVerify" style="display:none;"'
  );

  // license.js finns inte kvar, så taggen måste bort. Lämnas den ger
  // webbläsaren ERR_FILE_NOT_FOUND i konsolen varje gång popupen öppnas.
  s = s.replace(/\s*<script src="license\.js"><\/script>\n/, '\n');

  // CSS-blocket för licensen
  s = s.replace(/    \/\* Licens \/ gratis-nivå \*\/[\s\S]*?\.license-deactivate:hover \{[^}]*\}\n/,
    `    .free-note {\n      margin-top: 8px;\n      padding: 7px 10px;\n      background: #1e293b;\n      border: 1px solid #334155;\n      border-radius: 8px;\n      font-size: 10px;\n      color: #64748b;\n      text-align: center;\n    }\n`);

  if (s.includes('license.js')) {
    problems.push('popup.html: license.js finns kvar i en script-tagg');
  }

  write(f, s);
}

// ---------------------------------------------------------------------------
// 3) popup.js — ta bort all Pro-logik
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'popup.js');
  let s = read(f);

  // DOM-referenser
  s = s.replace(
    /const licenseStatus = document\.getElementById\('licenseStatus'\);[\s\S]*?const btnDeactivateLicense = document\.getElementById\('btnDeactivateLicense'\);\n/,
    ''
  );

  // renderLicenseState / refreshLicenseState / nyckelhanterare
  s = s.replace(
    /\/\*\*\n \* Speglar cooldownen[\s\S]*?\n\}\n\nasync function refreshLicenseState\(\)[\s\S]*?\n\}\n\nfunction startLicenseCountdown\(\)[\s\S]*?\n\}\n\n/,
    ''
  );
  s = s.replace(/btnActivateLicense\?\.addEventListener\('click'[\s\S]*?\n\}\);\n\nbtnDeactivateLicense\?\.addEventListener\('click'[\s\S]*?\n\}\);\n\n/, '');
  s = s.replace(/if \(btnBuyPro && typeof KOFI_URL === 'string' && KOFI_URL\) \{[\s\S]*?\n\}\n\n/, '');

  // Kvarvarande anrop
  s = s.replace(/  await refreshLicenseState\(\);\n  startLicenseCountdown\(\);\n/, '');
  s = s.replace(
    /\/\/ Cooldownen avvisar här[\s\S]*?\n    if \(profileRes\?\.reason === 'cooldown'\) \{[\s\S]*?\n    \}\n/,
    `// Cooldownen avvisar här. Visa tiden kvar och lås knappen.
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

  // Efteråt får ingen Pro-referens finnas kvar.
  for (const bad of ['isPro', 'renderLicenseState', 'refreshLicenseState', 'startLicenseCountdown',
                     'licenseTimer', 'licenseStatus', 'licenseCooldown', 'licensePro',
                     'licenseEntry', 'btnBuyPro', 'inputLicenseKey', 'btnActivateLicense',
                     'btnDeactivateLicense', 'licenseResult', 'KOFI_URL']) {
    if (new RegExp(`\\b${bad}\\b`).test(s)) {
      problems.push(`popup.js: "${bad}" finns kvar efter borttagningen`);
    }
  }

  write(f, s);
}

// ---------------------------------------------------------------------------
// 4) background.js — inga licensmeddelanden, import av cooldown.js
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'background.js');
  let s = read(f);

  s = s.replace(
    /\/\/ license\.js laddas in[\s\S]*?\nif \(typeof importScripts === 'function'\) \{\n  importScripts\('license\.js'\);\n\}/,
    "// cooldown.js (gratisnivåns spärr) laddas in i service workern.\nif (typeof importScripts === 'function') {\n  importScripts('cooldown.js');\n}"
  );

  // Ta bort de fyra licensmeddelandena
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
// 5) MANIFEST — peka om till cooldown.js
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'manifest.json');
  const m = JSON.parse(read(f));
  m.version = m.version || '1.12.0';
  write(f, JSON.stringify(m, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// 6) Läsbar rad: berätta vad som faktiskt togs bort
// ---------------------------------------------------------------------------
console.log('Genererade free-build/');
console.log('  borttaget: license.js (signaturhemlighet, nyckelvalidering, Pro)');
console.log('  ersatt:    cooldown.js (1 registrering per 3 timmar)');
console.log('  borttaget: nyckelfält, Pro-knapp, Pro-status i popupen');
console.log('  borttaget: activateLicense / getLicenseStatus / deactivateLicense');

// ---------------------------------------------------------------------------
// 7) FÖRSTÅNDEFÖRSVAR — stoppa bygget om en hemlighet finns kvar
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
  console.error('\nBYGGET AVBRÖTS. Följande finns i gratisversionen och får inte publiceras:');
  for (const o of offenders) console.error('  - ' + o);
  process.exit(1);
}

if (problems.length) {
  console.error('\nBYGGET AVBRÖTS. Följande gick inte att hantera:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log('\nKontrollerad: ingen hemlighet, ingen nyckel, ingen Pro i free-build/.');
