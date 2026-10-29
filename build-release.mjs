#!/usr/bin/env node
/**
 * build-release.mjs: builds the two store packages from free-build/.
 *
 *   release/autoaccountmaker-chrome-<version>.zip    Chrome Web Store (and Edge)
 *   release/autoaccountmaker-firefox-<version>.zip   addons.mozilla.org
 *
 * The two stores want different manifests, so each zip gets its own. The code is the same.
 * Before anything is written the script checks the things the stores reject for:
 * a bad manifest, missing files, inline scripts, eval, remote code, wrong icon sizes,
 * and any trace of license key material in the package.
 *
 * Run:  node build-release.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'free-build');
const OUT = path.join(ROOT, 'release');

// Everything that goes into a package. Anything not listed stays out, so a screenshot,
// an exported CSV or a leftover from development can never end up in an upload.
const FILES = [
  'background.js', 'content.js', 'i18n.js', 'license.js',
  'options.html', 'options.js', 'popup.html', 'popup.js', 'vault.js',
  'test-sida.html', 'test-sida.js',
  'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png', 'icons/kofi-coffee.png',
];

const problems = [];
const fail = (msg) => problems.push(msg);

// ---------------------------------------------------------------------------- manifests
const base = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const VERSION = base.version;

function chromeManifest() {
  const m = structuredClone(base);
  delete m.browser_specific_settings; // a Firefox only key, Chrome warns about it
  return m;
}

function firefoxManifest() {
  const icons = base.icons;
  return {
    manifest_version: 3,
    name: base.name,
    version: base.version,
    description: base.description,
    // sidePanel is Chrome only. Firefox gets a sidebar instead, opened from the toolbar button.
    permissions: base.permissions.filter((p) => p !== 'sidePanel'),
    host_permissions: base.host_permissions,
    action: { default_title: base.name, default_icon: base.action.default_icon },
    sidebar_action: { default_panel: 'popup.html', default_title: base.name, default_icon: icons },
    // Firefox runs the service worker as an event page: the scripts are listed, and
    // license.js comes first because background.js reads its functions.
    background: { scripts: ['license.js', 'background.js'] },
    content_scripts: base.content_scripts,
    options_ui: { page: 'options.html', open_in_tab: true },
    icons,
    browser_specific_settings: {
      gecko: {
        id: 'autoaccountmaker@nrnworld.com',
        strict_min_version: '140.0',
        // Nothing the user types or browses is sent to the developer or collected.
        data_collection_permissions: { required: ['none'] },
      },
      // data_collection_permissions needs Firefox for Android 142, so the minimum is stated here.
      gecko_android: { strict_min_version: '142.0' },
    },
  };
}

// ---------------------------------------------------------------------------- checks
function readPng(rel) {
  const buf = fs.readFileSync(path.join(SRC, rel));
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), colorType: buf[25] };
}

for (const rel of FILES) {
  if (!fs.existsSync(path.join(SRC, rel))) fail(`missing file: ${rel}`);
}

// Every local file an HTML page loads must be in the package.
for (const rel of FILES.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(SRC, rel), 'utf8');
  for (const m of html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/gi)) fail(`${rel}: inline <script> (blocked by the extension CSP): ${m[0]}`);
  for (const m of html.matchAll(/\son(click|load|change|submit|error|input)\s*=/gi)) fail(`${rel}: inline event handler on${m[1]}`);
  for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:|#)/i.test(ref)) {
      if (/<script[^>]*\ssrc="https?:/i.test(html)) fail(`${rel}: remote script`);
      continue;
    }
    if (!FILES.includes(ref)) fail(`${rel} loads ${ref}, which is not in the package`);
  }
}

for (const rel of FILES.filter((f) => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(SRC, rel), 'utf8');
  if (/\beval\s*\(/.test(code)) fail(`${rel}: eval()`);
  if (/new\s+Function\s*\(/.test(code)) fail(`${rel}: new Function()`);
  // Anything that looks like license key material or a signing secret.
  if (/MASTER_SECRET|b228303c|CE1F-?C6AB|[0-9a-f]{64}/i.test(code.replace(/LICENSE_KEY_PBKDF2\s*=\s*'[0-9a-f]{64}'/, ''))) {
    fail(`${rel}: contains something that looks like license key material`);
  }
}
{
  // The one allowed 64 character value is the PBKDF2 hash of the key, which cannot be reversed.
  const lic = fs.readFileSync(path.join(SRC, 'license.js'), 'utf8');
  if (!/LICENSE_KEY_PBKDF2\s*=\s*'[0-9a-f]{64}'/.test(lic)) fail('license.js: expected the hashed license key constant');
  if (/AAM-PRO-[0-9A-Z]{4}-[0-9A-F]{4}-[0-9A-F]{4}/.test(lic)) fail('license.js: contains a license key');
}

for (const [size, rel] of [[16, 'icons/icon16.png'], [48, 'icons/icon48.png'], [128, 'icons/icon128.png']]) {
  const png = readPng(rel);
  if (!png) fail(`${rel}: not a PNG`);
  else if (png.w !== size || png.h !== size) fail(`${rel}: is ${png.w}x${png.h}, expected ${size}x${size}`);
}

for (const [name, m] of [['chrome', chromeManifest()], ['firefox', firefoxManifest()]]) {
  if (m.manifest_version !== 3) fail(`${name}: manifest_version must be 3`);
  if (!/^\d+(\.\d+){0,3}$/.test(m.version)) fail(`${name}: bad version ${m.version}`);
  if (!m.description || m.description.length > 132) fail(`${name}: description must be 1-132 characters`);
  if (m.name.length > 45) fail(`${name}: name longer than 45 characters`);
  const refs = [
    ...(m.content_scripts || []).flatMap((c) => c.js || []),
    ...Object.values(m.icons || {}),
    ...(m.background?.scripts || []),
    m.background?.service_worker,
    m.options_page, m.options_ui?.page, m.side_panel?.default_path, m.sidebar_action?.default_panel,
  ].filter(Boolean);
  for (const r of refs) if (!FILES.includes(r)) fail(`${name}: manifest points at ${r}, which is not in the package`);
}

if (problems.length) {
  console.error('\nThe packages were NOT built. Fix these first:\n');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

// ---------------------------------------------------------------------------- zip writer
// A small zip writer so the build needs no tools or packages. Paths use forward slashes
// and manifest.json sits at the root, which is what both stores require.
function crc32(buf) {
  return typeof zlib.crc32 === 'function' ? zlib.crc32(buf) >>> 0 : (() => {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  })();
}

function makeZip(entries) {
  const date = new Date();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

// Code that only makes sense in Chrome is cut out of the Firefox package, so Mozilla's
// checker does not flag an API Firefox does not have.
function forTarget(target, rel) {
  const data = fs.readFileSync(path.join(SRC, rel));
  if (target !== 'firefox' || rel !== 'background.js') return data;
  const code = data.toString('utf8');
  const cut = code.replace(/\/\/ BEGIN-CHROME-ONLY[\s\S]*?\/\/ END-CHROME-ONLY\r?\n/, '');
  if (cut === code || /sidePanel/.test(cut.replace(/\/\/.*$/gm, ''))) fail('background.js: the Chrome-only block was not cut out');
  return Buffer.from(cut, 'utf8');
}

function build(target, manifest) {
  const entries = [{ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') }];
  for (const rel of FILES) entries.push({ name: rel, data: forTarget(target, rel) });
  if (problems.length) {
    console.error('\nThe ' + target + ' package was NOT built:\n');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  const file = path.join(OUT, `autoaccountmaker-${target}-${VERSION}.zip`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, makeZip(entries));
  console.log(`  ${path.relative(ROOT, file)}  ${entries.length} files  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  return file;
}

console.log(`\nBuilt version ${VERSION}:`);
build('chrome', chromeManifest());
build('firefox', firefoxManifest());
console.log('\nChecks passed: manifest, files, inline scripts, eval, remote code, icons, license material.\n');
