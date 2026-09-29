/**
 * verify-zip.mjs: reads the packed zip back and checks it as a store would.
 *
 * The zip is what gets uploaded, so the zip is what has to be correct. This
 * unpacks it to a throwaway folder and runs the same checks against the
 * extracted files, not against store-build/, because that is what the reviewer
 * receives.
 *
 * Run:  node verify-zip.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, '.zip-verify');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); pass++; }
  else { console.log('  FAIL  ' + name + (extra ? '\n          ' + extra : '')); fail++; }
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ saknas. Kör: node pack.mjs');
  process.exit(1);
}
const zips = fs.readdirSync(DIST).filter((f) => f.endsWith('.zip'));
check('there is a zip to verify', zips.length > 0, zips.join(', '));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-build/manifest.json'), 'utf8'));

for (const zipName of zips) {
  console.log('\n=== ' + zipName + ' ===');
  const zipPath = path.join(DIST, zipName);
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  execFileSync('powershell', [
    '-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${TMP.replace(/'/g, "''")}' -Force`,
  ], { stdio: 'inherit' });

  check('manifest.json is at the zip root', fs.existsSync(path.join(TMP, 'manifest.json')));
  check('there is no extra wrapping folder', fs.readdirSync(TMP).length > 3);

  const m = JSON.parse(fs.readFileSync(path.join(TMP, 'manifest.json'), 'utf8'));

  // Chrome Web Store requirements
  console.log('  -- Chrome Web Store --');
  check('manifest_version is 3', m.manifest_version === 3);
  check('version is 1 to 4 dot separated integers', /^\d{1,5}(\.\d{1,5}){0,3}$/.test(m.version), m.version);
  check('name is at most 45 characters', (m.name || '').length <= 45, `${(m.name || '').length} chars: ${m.name}`);
  check('description is at most 132 characters', (m.description || '').length <= 132, `${(m.description || '').length} chars`);
  check('description does not end mid sentence', !/\s$/.test(m.description || 'x'));
  check('there is an icon at every size', [16, 48, 128].every((s) => fs.existsSync(path.join(TMP, 'icons', `icon${s}.png`))));
  check('the privacy policy is included', fs.existsSync(path.join(TMP, 'PRIVACY.md')));
  check('the licence is included', fs.existsSync(path.join(TMP, 'LICENCE.md')));
  check('a minimum Chrome version is declared', !!m.minimum_chrome_version, m.minimum_chrome_version);
  if (zipName.includes('chrome')) {
    check('chrome background is service_worker', !!m.background?.service_worker);
  }

  // Firefox requirements
  console.log('  -- addons.mozilla.org --');
  check('a gecko id is present', !!(m.browser_specific_settings || {}).gecko?.id,
    (m.browser_specific_settings || {}).gecko?.id);
  check('the gecko id looks like an e-mail address',
    /^[^@\s]+@[^@\s]+$/.test((m.browser_specific_settings || {}).gecko?.id || ''));
  check('a minimum Firefox version is declared', !!m.browser_specific_settings.gecko.strict_min_version);
  check('the extension name does not claim to be Mozilla', !/mozilla|firefox/i.test(m.name || ''));
  if (zipName.includes('firefox')) {
    check('firefox background uses scripts array', Array.isArray(m.background?.scripts));
  }

  // Least privilege & store policy checks
  check('least privilege: tabs permission is omitted', !m.permissions?.includes('tabs'));
  check('least privilege: broad host_permissions are omitted', !m.host_permissions || m.host_permissions.length === 0);
  check('no external bot/shop URL in homepage_url', !m.homepage_url || !/ko-fi/i.test(m.homepage_url));

  // Shared policy requirements, checked against the extracted files
  console.log('  -- policy --');
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(path.relative(TMP, p).replace(/\\/g, '/'));
    }
  })(TMP);

  check('no source maps are shipped', !files.some((f) => f.endsWith('.map')));
  check('no markdown docs other than the two policy files',
    !files.some((f) => /\.md$/i.test(f) && !/^(PRIVACY|LICENCE)\.md$/.test(f)),
    files.filter((f) => /\.md$/i.test(f)).join(', '));
  check('no csv or log files are shipped', !files.some((f) => /\.(csv|log)$/i.test(f)));
  check('no test page is shipped', !files.some((f) => /test/i.test(f)));
  check('no node_modules or package files', !files.some((f) => /node_modules|package\.json/.test(f)));

  const all = files
    .filter((f) => /\.(js|html|json|md)$/i.test(f))
    .map((f) => fs.readFileSync(path.join(TMP, f), 'utf8'))
    .join('\n');

  check('no remote code: no script tag pointing at http', !/<script[^>]+src\s*=\s*["']https?:/i.test(all));
  check('no eval', !/\beval\s*\(/.test(all));
  check('no new Function', !/\bnew\s+Function\s*\(/.test(all));
  check('no obfuscated code', !/atob\s*\(|fromCharCode|\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x/i.test(all));
  check('no 64 character hex literal', !/['"][0-9a-f]{64}['"]/.test(all));
  check('no MASTER_SECRET assignment', !/MASTER_SECRET\s*=\s*['"][0-9a-f]/i.test(all));
  check('no license key format', !/AAM-PRO-\d{4}/i.test(all));
  check('no network library usage', !/\bXMLHttpRequest\b|navigator\.sendBeacon/.test(all));
  check('the only network calls are none at all', !/\bfetch\s*\(/.test(all));
  check('no email provider host', !/mail\.tm|rapidapi/i.test(all));
  check('no account creation function', !/createMailTmAccount|createTempMailAccount|generateProfile/.test(all));
  // Comments are stripped first, so a comment may name a forbidden thing in
  // order to explain why it is absent. Code may not.
  const code = all
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  check('no cookie or consent banner handling', !/dismissConsentBanners|accept all cookies|reject non-essential/i.test(code));
  check('no proof of work handling', !/not a robot|inte en robot/i.test(code));
  // The only click in the whole package is inside the country listbox helper.
  // Counted by finding the helper body, so a rename fails the check.
  const helper = (() => {
    const m = /function selectListboxOption\([^)]*\)\s*\{/.exec(code);
    if (!m) return null;
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(m.index + m[0].length, i); }
    }
    return null;
  })();
  check('the listbox helper is present', helper !== null);
  const allowed = helper ? (helper.match(/\.click\(\)/g) || []).length : 0;
  const total = (code.match(/\.click\(\)/g) || []).length;
  check('every click is inside the country listbox helper', total === allowed,
    `${total} clicks total, ${allowed} allowed`);
  check('the phrase "press submit yourself" is documented', /press submit/i.test(all));

  // The description must match the behaviour, since the review compares them
  const d = (m.description || '').toLowerCase();
  check('the description says the user submits',
    /submit/i.test(d) && /you/i.test(d), m.description);
  check('the description does not promise automation', !/automatic|automatisk|auto|one click/i.test(d));
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n================ ${pass} passed, ${fail} failed ================`);
process.exit(fail ? 1 : 0);
