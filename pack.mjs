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
 * Out:  dist/autoaccountmaker-form-filler-chrome-1.13.3.zip
 *       dist/autoaccountmaker-form-filler-firefox-1.13.3.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'store-build');
const DIST = path.join(ROOT, 'dist');

// ---------------------------------------------------------------------------
// Pure-Node ZIP builder with forward-slash entry names.
//
// Compress-Archive on Windows stores paths with backslash separators, which
// makes the Firefox Add-on linter fail with "Invalid file name in archive:
// icons\icon128.png". This function builds the ZIP entirely in Node so there
// are no external tools and no encoding issues with non-ASCII folder names
// (like "Chrome Tillägg").
// ---------------------------------------------------------------------------
function buildZipNode(srcDir, destFile) {
  const parts = []; // { header: Buffer, data: Buffer, offset: number, name: string, crc: number, size: number, compressed: number }
  let offset = 0;

  function walkDir(dir, base = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name; // always forward slash
      if (entry.isDirectory()) { walkDir(abs, rel); continue; }

      const raw = fs.readFileSync(abs);
      const compressed = zlib.deflateRawSync(raw, { level: 9 });

      // Use deflate only if it actually shrinks the data.
      const useDeflate = compressed.length < raw.length;
      const data = useDeflate ? compressed : raw;
      const method = useDeflate ? 8 : 0;

      const crc = crc32(raw);
      const nameBytes = Buffer.from(rel, 'utf8');
      const now = new Date();
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

      // Local file header
      const local = Buffer.alloc(30 + nameBytes.length);
      local.writeUInt32LE(0x04034b50, 0);   // signature
      local.writeUInt16LE(20, 4);            // version needed
      local.writeUInt16LE(0x0800, 6);        // flags: UTF-8
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(dosTime, 10);
      local.writeUInt16LE(dosDate, 12);
      local.writeUInt32LE(crc >>> 0, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(raw.length, 22);
      local.writeUInt16LE(nameBytes.length, 26);
      local.writeUInt16LE(0, 28);            // extra length
      nameBytes.copy(local, 30);

      parts.push({ local, data, offset, name: nameBytes, crc, size: raw.length, compressed: data.length, method, dosTime, dosDate });
      offset += local.length + data.length;
    }
  }

  walkDir(srcDir);

  // Central directory
  const cdParts = [];
  for (const p of parts) {
    const cd = Buffer.alloc(46 + p.name.length);
    cd.writeUInt32LE(0x02014b50, 0);    // signature
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0x0800, 8);         // flags: UTF-8
    cd.writeUInt16LE(p.method, 10);
    cd.writeUInt16LE(p.dosTime, 12);
    cd.writeUInt16LE(p.dosDate, 14);
    cd.writeUInt32LE(p.crc >>> 0, 16);
    cd.writeUInt32LE(p.compressed, 20);
    cd.writeUInt32LE(p.size, 24);
    cd.writeUInt16LE(p.name.length, 28);
    cd.writeUInt16LE(0, 30);             // extra
    cd.writeUInt16LE(0, 32);             // comment
    cd.writeUInt16LE(0, 34);             // disk start
    cd.writeUInt16LE(0, 36);             // int attr
    cd.writeUInt32LE(0, 38);             // ext attr
    cd.writeUInt32LE(p.offset, 42);
    p.name.copy(cd, 46);
    cdParts.push(cd);
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(parts.length, 8);
  eocd.writeUInt16LE(parts.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  const localBuffers = parts.flatMap(p => [p.local, p.data]);
  fs.writeFileSync(destFile, Buffer.concat([...localBuffers, cdBuf, eocd]));
}

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

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

    if (process.platform === 'win32') {
      // Compress-Archive on Windows stores entries with backslash separators,
      // which makes the Firefox Add-on linter reject the archive with
      // "Invalid file name in archive: icons\icon128.png".
      //
      // We build the ZIP entirely in Node.js using the built-in
      // zlib (deflate) + manual ZIP format construction, so there are no
      // external dependencies and no PowerShell encoding issues with non-ASCII
      // paths (like "Chrome Tillägg").
      buildZipNode(SRC, out);
    } else {
      execFileSync('zip', ['-r', '-q', out, '.'], { cwd: SRC, stdio: 'inherit' });
    }
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
  
  // Firefox MV3 uses options_ui instead of options_page
  if (m.options_page) {
    m.options_ui = { page: m.options_page };
    delete m.options_page;
  }
  
  // Firefox requires explicit data collection declaration inside browser_specific_settings.gecko
  // Reference: https://extensionworkshop.com/documentation/publish/add-on-policies/#data-disclosure-collection-and-management
  if (!m.browser_specific_settings) m.browser_specific_settings = {};
  if (!m.browser_specific_settings.gecko) m.browser_specific_settings.gecko = {};
  
  m.browser_specific_settings.gecko.id = 'autoaccountmaker@nrnworld.com';
  // strict_min_version must be 140 for desktop Firefox to support data_collection_permissions
  m.browser_specific_settings.gecko.strict_min_version = '140.0';
  // data_collection_permissions.required must be an array containing "none" or data category strings
  // This extension collects no data, so required: ["none"]
  // Reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings
  m.browser_specific_settings.gecko.data_collection_permissions = {
    required: ['none']
  };
  // gecko_android.strict_min_version must be 142 to support data_collection_permissions on Android
  if (!m.browser_specific_settings.gecko_android) {
    m.browser_specific_settings.gecko_android = {};
  }
  m.browser_specific_settings.gecko_android.strict_min_version = '142.0';
});

console.log(`Paketerade ${included.length} filer från store-build/`);
for (const f of [chrome, firefox]) {
  console.log('  ' + path.relative(ROOT, f) + '  ' + fs.statSync(f).size + ' byte');
}
console.log('');
console.log('Färdiga paket skapade:');
console.log('  Chrome:  dist/autoaccountmaker-form-filler-chrome-' + VERSION + '.zip (service_worker)');
console.log('  Firefox: dist/autoaccountmaker-form-filler-firefox-' + VERSION + '.zip (background scripts + gecko.id)');
