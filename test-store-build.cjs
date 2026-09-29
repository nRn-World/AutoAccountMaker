/**
 * test-store-build.js: proves the store build does what it says.
 *
 * The point of the store build is that it fills fields and then stops. A
 * description is not evidence, so this test loads the real extension in a real
 * browser and checks the behaviour instead:
 *
 *   1. the extension loads and the popup opens with no errors
 *   2. the license system and the account vault are gone
 *   3. it fills the text fields from the saved details
 *   4. it does NOT submit the form
 *   5. it does NOT tick the terms checkbox
 *   6. it does NOT click away a consent banner
 *   7. the background worker contains no network code and no identity generator
 *   8. the only actions the content script accepts are the allowed ones
 *   9. the seven languages are complete
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  PASS  ' + name); pass++; }
  else { console.log('  FAIL  ' + name + (extra ? '\n          ' + extra : '')); fail++; }
}

function section(title) { console.log('\n=== ' + title + ' ==='); }

/**
 * Read once, with a default, before anything uses it.
 *
 * These were read at the top of the file while the defaults were set further
 * down inside the async body, so OUT was undefined and Chrome was launched with
 * --load-extension=undefined. That produced a "could not load extension"
 * dialog and a manifest error, and the test exited without a summary.
 */
const path0 = require('path');
const os0 = require('os');

const OUT = process.env.OUT_DIR
  ? path0.resolve(process.env.OUT_DIR)
  : path0.join(__dirname, 'store-build');
const PROFILE = process.env.TMP_PROFILE
  ? path0.resolve(process.env.TMP_PROFILE)
  : path0.join(os0.tmpdir(), 'aam-store-test-profile');

// Fail before opening a browser rather than after, so a wrong path is an
// obvious message instead of a Chrome dialog.
if (!fs.existsSync(path0.join(OUT, 'manifest.json'))) {
  console.error(`No manifest.json in ${OUT}`);
  console.error('Build it first:  node build-store.mjs');
  process.exit(1);
}

// A page that records what the extension did to it, so "did not submit" and
// "did not tick" can be asserted rather than assumed.
const FIXTURE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Filler fixture</title></head>
<body>
  <form id="f" onsubmit="window.__submitted = true; return false;">
    <input id="email" name="email" type="email" autocomplete="email">
    <input id="fn" name="firstName" autocomplete="given-name">
    <input id="ln" name="lastName" autocomplete="family-name">
    <input id="pw" name="password" type="password" autocomplete="new-password">
    <input id="un" name="username" autocomplete="username">
    <label><input id="tos" type="checkbox" required> I agree to the Terms of Service</label>
    <button id="submit" type="submit">Create account</button>
  </form>
  <div id="banner" style="position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.6)">
    <button id="acceptCookies">Accept all cookies</button>
  </div>
  <script>
    window.__submitted = false;
    window.__bannerClicks = 0;
    document.getElementById('acceptCookies').addEventListener('click', function () {
      window.__bannerClicks++;
      document.getElementById('banner').style.display = 'none';
    });
  </script>
</body></html>`;

(async () => {
  const http = require('http');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(FIXTURE);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chromium', headless: false, viewport: null,
    args: [
      '--disable-features=Translate,OptimizationGuideModelDownloading',
      `--disable-extensions-except=${OUT}`, `--load-extension=${OUT}`,
    ],
  });
  let [page] = ctx.pages();

  try {
    section('1) Tillägget laddar sig som ett tillägg');
    const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 20000 });
    check('the service worker started', !!sw);

    const extId = new URL(sw.url()).host;
    const popup = await ctx.newPage();
    const popupErrors = [];
    popup.on('pageerror', (e) => popupErrors.push(e.message));
    await popup.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded' });
    await popup.waitForTimeout(1500);
    check('the popup opens without JavaScript errors', popupErrors.length === 0, popupErrors.join('; '));

    section('2) Licenssystemet och kontovalvet är borta');
    const popupHtml = fs.readFileSync(path.join(OUT, 'popup.html'), 'utf8');
    check('there is NO license key field', !/inputLicenseKey|licenseBox|btnActivateLicense/.test(popupHtml));
    check('there is NO account vault', !/vault|accountList/.test(popupHtml));
    check('there IS a fill button', /id="btnFill"/.test(popupHtml));

    section('3) Det fyller i fälten från sparade uppgifter');
    const page2 = await ctx.newPage();
    await page2.goto(url, { waitUntil: 'domcontentloaded' });

    const setRes = await sw.evaluate(async () => {
      await chrome.storage.local.set({
        details: {
          email: 'testperson@example.org', password: 'correct-horse-battery',
          firstName: 'Test', lastName: 'Person', username: 'testperson',
          phone: '', address: '', city: '', zip: '', country: 'SE',
          birthDate: '', gender: '', company: '', jobTitle: '',
          fullName: 'Test Person',
        },
      });
      return true;
    });
    check('the details were saved', setRes === true);

    // chrome.runtime is not reachable from a page context, so the same message
    // the popup sends is sent from inside the extension instead. The tab id is
    // looked up by URL from the worker, which has the tabs permission.
    await page2.waitForTimeout(1200);
    const res = await sw.evaluate(async (target) => {
      const tabs = await chrome.tabs.query({ url: target.replace(/\/$/, '') + '/*' });
      const tab = tabs[0];
      if (!tab) return { success: false, error: 'no tab found for ' + target };
      try {
        return await chrome.tabs.sendMessage(tab.id, { action: 'fillRegistration' });
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }, url);

    check('the content script answered', !!res && res.success === true, JSON.stringify(res).slice(0, 200));

    const values = await page2.evaluate(() => ({
      email: document.getElementById('email').value,
      firstName: document.getElementById('fn').value,
      lastName: document.getElementById('ln').value,
      password: document.getElementById('pw').value,
      username: document.getElementById('un').value,
    }));
    check('the e mail field was filled', values.email === 'testperson@example.org', 'got "' + values.email + '"');
    check('the first name was filled', values.firstName === 'Test', 'got "' + values.firstName + '"');
    check('the last name was filled', values.lastName === 'Person', 'got "' + values.lastName + '"');
    check('the password was filled', values.password === 'correct-horse-battery');
    check('the username was filled', values.username === 'testperson');

    section('4) Det skickar INTE formuläret');
    const submitted = await page2.evaluate(() => window.__submitted);
    check('the form was NOT submitted', submitted === false, '__submitted=' + submitted);
    const stillThere = await page2.evaluate(() => !!document.getElementById('f'));
    check('the form is still on the page', stillThere);

    section('5) Det kryssar INTE i villkorsrutan');
    const tos = await page2.evaluate(() => document.getElementById('tos').checked);
    check('the terms checkbox is STILL unticked', tos === false, 'checked=' + tos);
    const reported = (res && res.result && res.result.checkboxes) || [];
    check('the pending checkbox is REPORTED to the user', reported.length > 0, JSON.stringify(reported));
    const reportedLabel = reported.map((c) => c.label || '').join(' ').toLowerCase();
    check('the reported checkbox mentions the terms', /terms|agree/.test(reportedLabel), reportedLabel);

    section('6) Det klickar INTE bort samtyckesbannern');
    const bannerClicks = await page2.evaluate(() => window.__bannerClicks);
    check('the cookie banner was NOT clicked', bannerClicks === 0, 'clicks=' + bannerClicks);
    const bannerVisible = await page2.evaluate(() => document.getElementById('banner').style.display !== 'none');
    check('the banner is still visible', bannerVisible);

    section('7) Bakgrunden har ingen nätverkskod och ingen identitetsgenerator');
    const bg = fs.readFileSync(path.join(OUT, 'background.js'), 'utf8');
    check('no fetch in the background worker', !/\bfetch\s*\(/.test(bg));
    check('no XMLHttpRequest', !/XMLHttpRequest/.test(bg));
    check('no mail.tm or RapidAPI host', !/mail\.tm|rapidapi/i.test(bg));
    check('no generated identity', !/generateProfile|randomBirthDate|generateUsername|createMailTmAccount/.test(bg));
    check('no verification polling', !/pollForVerification|pollMailTm|pollTempMail/.test(bg));
    check('no license key handling', !/MASTER_SECRET|hmacHex|validateLicenseFormat/.test(bg));

    section('8) Content script tar bara emot tillåtna åtgärder');
    const content = fs.readFileSync(path.join(OUT, 'content.js'), 'utf8');
    const allowed = ['ping', 'fillRegistration', 'fillLogin', 'fillOtp', 'listPendingCheckboxes', 'prepareForRegistration'];
    check('there is an allowlist', /ALLOWED_ACTIONS/.test(content));
    for (const a of allowed) {
      check(`"${a}" is on the allowlist`, content.includes(`'${a}'`));
    }
    for (const forbidden of ['verificationOutcome', 'readVisibleCode', 'prepareAuto', 'autoSubmit']) {
      check(`"${forbidden}" is NOT handled`, !new RegExp(`action === '${forbidden}'`).test(content));
    }
    check('no code calls findSubmitButton or findVerifyButton', !/findSubmitButton|findVerifyButton/.test(content));
    check('no code dismisses consent banners', !/dismissConsentBanners|accept all cookies|inte en robot/i.test(content));
    check('no code ticks a checkbox', !/\.click\(\)\s*;\s*\n\s*out\.push/.test(content));

    section('9) Manifesten är komplett för båda butikerna');
    const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
    check('manifest version 3', manifest.manifest_version === 3);
    check('it has a version', !!manifest.version);
    check('it has a description', (manifest.description || '').length > 20);
    check('it has a name', !!manifest.name && manifest.name.length <= 45, 'name length ' + (manifest.name || '').length);
    check('it has a Firefox add-on id', !!(manifest.browser_specific_settings || {}).gecko?.id);
    check('it declares a minimum Firefox version', !!manifest.browser_specific_settings.gecko.strict_min_version);
    check('no unlimitedStorage without asking', manifest.permissions.includes('unlimitedStorage') === false);
    check('no mail provider host permission', !manifest.host_permissions.some((h) => /mail|rapidapi/.test(h)));

    section('10) Alla sju språk är kompletta');
    const i18nSrc = fs.readFileSync(path.join(OUT, 'i18n.js'), 'utf8');
    const sandbox = { chrome: { storage: { local: { get: async () => ({ settings: { language: 'en' } }) } } }, console };
    const vm = require('vm');
    vm.runInContext(
      i18nSrc + '\n;globalThis.__I = { DICT, SUPPORTED_LANGUAGES, t, setLanguage };',
      vm.createContext(sandbox), { filename: 'i18n.js' }
    );
    const I = sandbox.__I;
    check('seven languages are registered', I.SUPPORTED_LANGUAGES.length === 7, I.SUPPORTED_LANGUAGES.join(','));
    const flatten = (o, p = '') => Object.entries(o || {}).flatMap(([k, v]) => {
      const key = p ? p + '.' + k : k;
      return v && typeof v === 'object' ? flatten(v, key) : [key];
    });
    const base = flatten(I.DICT.en).sort();
    for (const lang of I.SUPPORTED_LANGUAGES) {
      const cur = flatten(I.DICT[lang]).sort();
      const missing = base.filter((k) => !cur.includes(k));
      check(`${lang} has all ${base.length} keys`, missing.length === 0, missing.slice(0, 5).join(', '));
    }

    section('11) Inga utvecklingsartefakter');
    for (const f of ['test-sida.html', 'test-sida.js', 'license.js', 'vault.js', 'keygen.js', 'options.css.orig']) {
      check(`${f} is not shipped`, !fs.existsSync(path.join(OUT, f)));
    }
    const stray = fs.readdirSync(OUT).filter((f) => /\.csv$|\.log$|free-.*\.png$|^settings-|^popup-|^options-(ar|de)/.test(f));
    check('no screenshots or exports are shipped', stray.length === 0, stray.join(', '));
  } finally {
    await ctx.close();
    server.close();
  }

  console.log(`\n================ ${pass} passed, ${fail} failed ================`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
