/**
 * pack.mjs: builds the uploadable zips for the Chrome Web Store and for
 * addons.mozilla.org.
 *
 * Both stores want a plain zip of the extension folder: manifest.json at the
 * root, no outer folder, no source maps, no screenshots, no test pages. This
 * script makes sure the folder is clean first, because a stray file in the
 * upload is the most common reason a review comes back with a question.
 *
 * Run:  node pack.mjs
 * Out:  dist/autoaccountmaker-form-filler-chrome-1.12.0.zip
 *       dist/autoaccountmaker-form-filler-firefox-1.12.0.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'store-build');
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(path.join(SRC, 'manifest.json'))) {
  console.error('store-build/manifest.json saknas. Kör: node build-store.mjs');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const VERSION = manifest.version;

// ---------------------------------------------------------------------------
// What may go into a store upload. Anything not listed is refused, so a
// leftover from development can never end up in a published package.
// ---------------------------------------------------------------------------
const ALLOWED = new Set([
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.js',
  'options.css',
  'i18n.js',
  'cooldown.js',
  'icon16.png',
  'icon48.png',
  'icon128.png',
  'PRIVACY.md',
  'LICENCE.md',
]);

// Recursively, because the icons live in a subfolder.
function allowedRel(rel) {
  const base = path.basename(rel);
  if (ALLOWED.has(base)) return true;
  return /(^|\/)icons\/icon(16|48|128)\.png$/.test(rel.replace(/\\/g, '/'));
}

const problems = [];
const included = [];

function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? path.join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) { walk(abs, relPath); continue; }
    if (allowedRel(relPath)) included.push(relPath);
    else problems.push(`  ${relPath} finns i store-build/ men hör inte hemma i ett butikspaket`);
  }
}

walk(SRC);

// A store package must not carry the private build's secrets. These patterns
// are the same ones build-free.mjs refuses, so the same failure cannot slip
// through here unnoticed.
const FORBIDDEN = [
  { name: 'hemlighet i klartext (64 hex)', re: /['"][0-9a-f]{64}['"]/ },
  { name: 'MASTER_SECRET med värde', re: /MASTER_SECRET\s*=\s*['"][0-9a-f]{32,}/i },
  { name: 'HMAC-nyckelgenerering', re: /hmacHex|createHmac|verifyHmacKey|checksumForSerial/ },
  { name: 'såld eller genererad nyckel', re: /AAM-PRO-\d{4}-[0-9a-f]{4}-[0-9a-f]{4}/i },
  { name: 'licensnyckel-fält', re: /inputLicenseKey|btnActivateLicense/ },
];

for (const rel of included) {
  const p = path.join(SRC, rel);
  if (!/\.(js|json|html|css|md|txt)$/i.test(rel)) continue;
  const text = fs.readFileSync(p, 'utf8');
  for (const rule of FORBIDDEN) {
    if (rule.re.test(text)) problems.push(`  ${rel}: ${rule.name}`);
  }
}

// Remote code is forbidden by both stores, and it is worth proving there is
// none rather than assuming it.
for (const rel of included) {
  if (!/\.(js|html)$/i.test(rel)) continue;
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
  if (/<script[^>]+src\s*=\s*["']https?:/i.test(text)) problems.push(`  ${rel}: fjärr script-tagg`);
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) problems.push(`  ${rel}: eval eller new Function`);
}

if (problems.length) {
  console.error('\nPACKETET AVBRÖTS. Följande måste åtgärdas först:');
  for (const p of problems) console.error(p);
  process.exit(1);
}

fs.mkdirSync(DIST, { recursive: true });

function zip(outName, manifestModifier = null) {
  const out = path.join(DIST, outName);
  fs.rmSync(out, { force: true });

  const manifestPath = path.join(SRC, 'manifest.json');
  const originalManifest = fs.readFileSync(manifestPath, 'utf8');

  try {
    if (manifestModifier) {
      const parsed = JSON.parse(originalManifest);
      manifestModifier(parsed);
      fs.writeFileSync(manifestPath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
    }

    // Run from inside store-build so manifest.json lands at the zip root.
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path * -DestinationPath '${out.replace(/'/g, "''")}' -Force`,
    ], { cwd: SRC, stdio: 'inherit' });
  } finally {
    fs.writeFileSync(manifestPath, originalManifest, 'utf8');
  }

  return out;
}

// Chrome uses service_worker in MV3
const chrome = zip(`autoaccountmaker-form-filler-chrome-${VERSION}.zip`, (m) => {
  m.background = { service_worker: 'background.js' };
});

// Firefox uses background scripts in MV3 for robust compatibility and linter compliance
const firefox = zip(`autoaccountmaker-form-filler-firefox-${VERSION}.zip`, (m) => {
  m.background = { scripts: ['cooldown.js', 'background.js'] };
});

console.log(`Paketerade ${included.length} filer från store-build/`);
for (const f of [chrome, firefox]) {
  console.log('  ' + path.relative(ROOT, f) + '  ' + fs.statSync(f).size + ' byte');
}
console.log('');
console.log('Färdiga paket skapade:');
console.log('  Chrome:  dist/autoaccountmaker-form-filler-chrome-' + VERSION + '.zip (service_worker)');
console.log('  Firefox: dist/autoaccountmaker-form-filler-firefox-' + VERSION + '.zip (background scripts + gecko.id)');
