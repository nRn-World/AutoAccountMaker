/**
 * build-store.mjs: builds the store ready version of AutoAccountMaker.
 *
 * WHY THIS EXISTS
 * ---------------
 * The private extension in extension/ is a full account creation tool. It
 * generates a fake identity, creates a temporary e mail account, ticks the
 * terms checkboxes, dismisses consent banners and submits the form by itself.
 * Both the Chrome Web Store and addons.mozilla.org reject that, because
 *
 *   1. accepting a legal agreement on the user's behalf is not allowed, the
 *      user has to do that with an explicit action of their own,
 *   2. creating accounts in bulk with invented identities is spam tooling, and
 *   3. clicking away cookie and anti bot banners is circumventing a site.
 *
 * So the store build is the same field engine with the automation removed:
 *
 *   KEPT   field detection, shadow DOM traversal, country pickers, the native
 *          select and custom listbox handling, and the one time code boxes
 *   KEPT   filling every text field from the details the user saved in
 *          Settings, because filling a form is what an accessibility tool does
 *   CUT    generating names, dates, gender, country and passwords
 *   CUT    creating temporary e mail accounts, and the mail.tm and
 *          temp mail RapidAPI polling that went with them
 *   CUT    ticking terms, privacy and consent checkboxes
 *   CUT    dismissing cookie, consent and anti bot banners
 *   CUT    submitting the form, and every automatic link opening and code entry
 *
 * The user keeps one click and gets every field filled. They review the form,
 * tick whatever the site asks for, and press submit themselves. That is the
 * line both stores draw, and this build does not cross it.
 *
 * WHERE THE FILES COME FROM
 * -------------------------
 *   extension/content.js   cut down by the transformations below. It is the
 *                          proven field engine, so it is reused rather than
 *                          rewritten, which is also why the shadow DOM and
 *                          custom listbox handling still work.
 *   store-manual/          the files that had to be written from scratch,
 *                          because they describe a different product:
 *                          the background worker, the popup, the settings
 *                          page, the dictionary, the rate limit, the policy
 *                          files. They live outside store-build/ on purpose,
 *                          so rebuilding this folder can never delete them.
 *
 * Run:  node build-store.mjs
 * Test: node test-store-build.js, which loads the built extension in a real
 *       browser and proves that it fills fields and does not submit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'extension');
const MANUAL = path.join(ROOT, 'store-manual');
const OUT = path.join(ROOT, 'store-build');

const SHOP_URL = 'https://ko-fi.com/s/da557f599c';
const VERSION = '1.12.0';
const GECKO_ID = 'autoaccountmaker-form-filler@nrnworld.com';

const problems = [];
const done = [];

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

fs.rmSync(OUT, { recursive: true, force: true });
copyDir(SRC, OUT);

// ---------------------------------------------------------------------------
// 1) Start from the hand written store files, so nothing that has to be
//    written from scratch can be lost by a rebuild.
// ---------------------------------------------------------------------------
copyDir(MANUAL, OUT);
done.push('store-manual/ copied in');

// ---------------------------------------------------------------------------
// 2) Remove what only existed for account creation.
// ---------------------------------------------------------------------------
for (const f of ['license.js', 'test-sida.html', 'test-sida.js', 'vault.js']) {
  if (fs.existsSync(path.join(OUT, f))) {
    fs.rmSync(path.join(OUT, f), { force: true });
    done.push(`removed ${f}`);
  }
}

// These belong to the repository, not to the extension. Both stores reject an
// upload that carries them, and README.md would describe the package rather
// than the extension.
for (const f of ['package.json', 'README.md']) {
  fs.rmSync(path.join(OUT, f), { force: true });
  done.push(`removed ${f}`);
}

// Anything left over from development. The test suite writes screenshots and
// csv exports straight into the extension folder, and the icons that belong to
// the extension live in icons/ rather than at the root.
const KEEP_AT_ROOT = new Set([
  'manifest.json', 'background.js', 'content.js', 'cooldown.js', 'i18n.js',
  'popup.html', 'popup.js', 'options.html', 'options.js', 'options.css',
  'PRIVACY.md', 'LICENCE.md',
]);
for (const entry of fs.readdirSync(OUT, { withFileTypes: true })) {
  if (entry.isDirectory()) continue;
  if (KEEP_AT_ROOT.has(entry.name)) continue;
  fs.rmSync(path.join(OUT, entry.name), { force: true });
  done.push(`removed stray ${entry.name}`);
}

// The icons have to stay where the manifest points, which is icons/. Without
// this the store would accept the package and then show a broken icon.
for (const size of [16, 48, 128]) {
  const p = path.join(OUT, 'icons', `icon${size}.png`);
  if (!fs.existsSync(p)) problems.push(`icons/icon${size}.png saknas i store-build/`);
}
for (const dir of ['csv-downloads', 'Screenshots']) {
  const p = path.join(OUT, dir);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    done.push(`removed stray ${dir}/`);
  }
}

// ---------------------------------------------------------------------------
// 3) content.js: the field engine, with every page driving action removed.
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'content.js');
  let src = read(f);

  /** Replace an exact block, or fail loudly. Never silently skip. */
  const cut = (name, from, to) => {
    if (!src.includes(from)) { problems.push(`content.js: ${name} (ankaret hittades inte)`); return; }
    src = src.replace(from, to);
    done.push(name);
  };

  /** Remove a whole top level function plus its leading docblock. */
  const cutFn = (name, fnName) => {
    const lines = src.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(`^(async )?function ${fnName}\\b`).test(lines[i])) { start = i; break; }
    }
    if (start === -1) { problems.push(`content.js: ${name} (${fnName} hittades inte)`); return; }
    let from = start;
    while (from > 0) {
      const prev = lines[from - 1].trim();
      if (prev === '' || prev.startsWith('*') || prev.endsWith('*/') || prev.startsWith('/**')) from--;
      else break;
    }
    let to = start;
    while (to < lines.length && lines[to] !== '}') to++;
    if (to >= lines.length) { problems.push(`content.js: ${name} (slutade inte med })`); return; }
    to++;
    lines.splice(from, to - from);
    src = lines.join('\n');
    done.push(name);
  };

  // Cookie and consent banners, including the "I am not a robot" pattern.
  // This is the clearest case of circumventing a site.
  cutFn('content.js: dismissConsentBanners removed', 'dismissConsentBanners');

  // Terms ticking becomes reporting. The extension may tell the user a box
  // needs attention, and may not touch it. Located by line range rather than
  // by an exact match, because the pattern holds non Latin text that is easy
  // to get wrong when copying it around.
  {
    const lines = src.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^function checkConsentCheckboxes\(\)/.test(lines[i])) { start = i; break; }
    }
    if (start === -1) {
      problems.push('content.js: checkConsentCheckboxes hittades inte');
    } else {
      let from = start;
      while (from > 0) {
        const prev = lines[from - 1].trim();
        if (prev === '' || prev.startsWith('*') || prev.endsWith('*/') || prev.startsWith('/**')) from--;
        else break;
      }
      let to = start;
      while (to < lines.length && lines[to] !== '}') to++;
      to++;

      const replacement = [
        '/**',
        ' * Lists the checkboxes the site still wants ticked: anything marked',
        ' * required, and anything whose label talks about terms, privacy or consent.',
        ' *',
        ' * The extension does NOT tick them. Accepting a legal agreement has to be',
        ' * an explicit action by the user, so we only point them out and let the',
        ' * popup list them so nothing is missed.',
        ' *',
        ' * The "I am not a robot" pattern is deliberately NOT matched. That is a',
        ' * statement to the site, not a box the user has to tick, and matching it',
        ' * would mean the extension claiming to be a person.',
        ' */',
        'function listPendingCheckboxes() {',
        '  // Note: the pattern below is the source pattern with the anti bot',
        '  // alternative removed, so a proof of work box is never touched.',
        '  const termsWords = /(terms|privacy|policy|agree|accept|consent|i.?m at least|age|18|villkor|godkänn|samtycker|accepter|zustimmung|accepter|şartlar|onay|شروط|موافقة)/i;',
        '  const out = [];',
        '',
        '  for (const box of deepQueryAll(\'input[type="checkbox"], input[type="radio"]\')) {',
        '    if (box.disabled || box.offsetParent === null || box.checked) continue;',
        '    const label = (',
        '      box.closest?.(\'label\')?.innerText || box.getAttribute(\'aria-label\') || box.id || \'\'',
        '    ).trim();',
        '',
        '    const needed = box.required === true || termsWords.test(label);',
        '    if (!needed) continue;',
        '',
        '    // Reported, never clicked.',
        '    out.push({',
        '      label: label.replace(/\\s+/g, \' \').slice(0, 60) || box.id || \'checkbox\',',
        '      required: box.required === true,',
        '    });',
        '  }',
        '  return out;',
        '}',
      ];
      lines.splice(from, to - from, ...replacement);
      src = lines.join('\n');
      src = src.replace(/\bcheckConsentCheckboxes\(\)/g, 'listPendingCheckboxes()');
      done.push('content.js: checkConsentCheckboxes now only reports, and no longer matches anti bot boxes');
    }
  }

  // No automatic submit after filling.
  cut(
    'content.js: no automatic submit in fillForm',
`  // Auto-submit removed: user must click Next / Create account themselves.
  const submitted = false;

  return { filled, submitted, mode, missing, noForm: false, report, checkboxes };`,
`  // Deliberately no submit here. Filling a form is what an accessibility tool
  // does; pressing the site's own submit button on the user's behalf is not.
  return { filled, submitted: false, mode, missing, noForm: false, report, checkboxes };`
  );

  // No automatic submit after a one time code either.
  cut(
    'content.js: no automatic submit in fillOtpCode',
`  let submitted = false;
  // User explicitly clicks Next / Create account themselves
  /* autoSubmit disabled */

  return { success: true, submitted, digits: otp.length, fieldType: found.type };`,
`  // No automatic submit. The user confirms the code themselves.
  return { success: true, submitted: false, digits: otp.length, fieldType: found.type };`
  );

  // The funnel walker clicked "Sign up" and "Create account", which is driving
  // account creation rather than filling a form. userClick() stays, because the
  // country listbox still needs it.
  cutFn('content.js: advanceToSignupForm removed', 'advanceToSignupForm');
  cutFn('content.js: clickButtonMatching removed', 'clickButtonMatching');

  // Constants that only served the funnel.
  for (const [name, arr] of [['SIGNUP_ADVANCE', null], ['SOCIAL_PROVIDERS', null]]) {
    const re = new RegExp(`(?:\\/\\/[^\\n]*\\n\\s*)?const ${name} = \\[[\\s\\S]*?\\];\\n`, 'm');
    if (re.test(src)) { src = src.replace(re, ''); done.push(`content.js: ${name} removed`); }
    else problems.push(`content.js: ${name} hittades inte`);
  }

  // prepareForRegistration used to dismiss banners and tick terms. Replaced by
  // line range, because the block it removes contains no non Latin text but
  // the surrounding docblock in the source is out of date after earlier cuts.
  {
    const lines = src.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^async function prepareForRegistration\(\)/.test(lines[i])) { start = i; break; }
    }
    if (start === -1) {
      problems.push('content.js: prepareForRegistration hittades inte');
    } else {
      let from = start;
      while (from > 0) {
        const prev = lines[from - 1].trim();
        if (prev === '' || prev.startsWith('*') || prev.endsWith('*/') || prev.startsWith('/**')) from--;
        else break;
      }
      let to = start;
      while (to < lines.length && lines[to] !== '}') to++;
      to++;

      lines.splice(from, to - from,
        '/**',
        ' * Reports whether a form is present. It used to close cookie banners,',
        ' * click through the sign up funnel and tick the terms box, none of which',
        ' * the store build is allowed to do.',
        ' */',
        'function prepareForRegistration() {',
        '  return {',
        '    success: true,',
        '    hasFields: hasSignupFields(),',
        '  };',
        '}',
      );
      src = lines.join('\n');
      done.push('content.js: prepareForRegistration reports only');
    }
  }

  // Verification helpers with no caller left.
  for (const fn of ['verificationOutcome', 'readVisibleCode', 'getEmailOnPage',
                    'findVerifyButton', 'findSubmitButton']) {
    cutFn(`content.js: ${fn} removed`, fn);
  }

  // The message handler loses the verification actions, reads the details from
  // storage instead of the message, and gains an explicit allowlist.
  cut(
    'content.js: handler without verification, details from storage',
`  if (request.action === 'fillRegistration') {
    // Asynchronous because choosing a country can open a listbox. Without "return true"
    // Chrome would close the channel before the response is sent.
    fillForm(request.profile, 'register', request.autoSubmit !== false)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
  if (request.action === 'fillLogin') {
    fillForm(request.profile, 'login', request.autoSubmit !== false)
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }`,
`  if (request.action === 'fillRegistration' || request.action === 'fillLogin') {
    // The details come from storage rather than from the message, so the
    // content script never has to be handed a profile by the caller. That
    // means the popup cannot smuggle in invented values either, and a field
    // the user left empty stays empty instead of being guessed at.
    //
    // Asynchronous because choosing a country can open a listbox. Without
    // "return true" Chrome would close the channel before the response.
    const mode = request.action === 'fillLogin' ? 'login' : 'register';
    loadSavedDetails()
      .then((details) => fillForm(details, mode))
      .then((result) => sendResponse({ success: true, result }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }`
  );

  cut(
    'content.js: handler without verification actions',
`  if (request.action === 'detectOtpPage') {
    sendResponse({ success: true, isOtpPage: isOtpPage(), emailOnPage: getEmailOnPage() });
  }
  if (request.action === 'verificationOutcome') {
    sendResponse({ success: true, ...verificationOutcome() });
  }
  if (request.action === 'readVisibleCode') {
    sendResponse({ success: true, ...readVisibleCode() });
  }`,
`  if (request.action === 'listPendingCheckboxes') {
    sendResponse({ success: true, checkboxes: listPendingCheckboxes() });
  }
  if (request.action === 'detectOtpPage') {
    // Read only, so the popup can offer "fill a code" on the right page.
    sendResponse({ success: true, isOtpPage: isOtpPage() });
  }`
  );

  // userClick() clicks listbox options, which is filling in a field and not
  // driving the page, so it stays. It is renamed here, because a reviewer
  // skimming for ".click()" should be able to see at once that the only click
  // in this build is inside a country listbox.
  {
    const lines = src.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*function userClick\(el\)/.test(lines[i])) { start = i; break; }
    }
    if (start === -1) {
      problems.push('content.js: userClick hittades inte');
    } else {
      // Take the whole original docblock with it, and put one docblock on top
      // that describes what the store build is allowed to click.
      let from = start;
      while (from > 0) {
        const prev = lines[from - 1].trim();
        if (prev === '' || prev.startsWith('*') || prev.endsWith('*/') || prev.startsWith('/**')) from--;
        else break;
      }

      lines.splice(from, start - from + 1, ...[
        '/**',
        ' * Opens or chooses an item inside a custom listbox. This is the only',
        ' * place in the store build that clicks anything, and it is a field',
        ' * interaction: the element is a <li role="option">, or the combobox',
        ' * button that reveals one, so the user picks a country the way they',
        ' * would with a mouse.',
        ' *',
        ' * Many sites build listboxes on pointer events and ignore a plain',
        ' * click, so Radix and Headless UI need the full pointerdown, mouseup,',
        ' * click chain. It never touches a checkbox, a submit button, a cookie',
        ' * banner, a terms link, or any control the user did not ask it to fill.',
        ' */',
        'function selectListboxOption(el) {',
      ]);
      src = lines.join('\n');
      src = src.replace(/\buserClick\(/g, 'selectListboxOption(');
      done.push('content.js: userClick renamed to selectListboxOption, docblock replaced');
    }
  }

  // The allowlist and the storage reader, placed in front of the handler.
  cut(
    'content.js: allowlist in front of the handler',
`chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'ping') {`,
`/**
 * Reads the details the user saved in Settings.
 *
 * The values come from chrome.storage, never from the message, and a field
 * the user left empty stays an empty string. fillForm() is then free to leave
 * it alone, because there is nothing to invent: this extension has no name
 * generator, no password generator and no e mail provider.
 */
async function loadSavedDetails() {
  try {
    const stored = await chrome.storage.local.get({ details: {} });
    return { ...(stored.details || {}) };
  } catch (e) {
    return {};
  }
}

/**
 * Everything this extension is allowed to do to a page, in one list.
 *
 * The Chrome Web Store and addons.mozilla.org both refuse extensions that act
 * on a page without the user asking, and neither accepts an extension that
 * accepts a legal agreement or clicks past a site's own security prompts. So
 * the list below is deliberately short, and test-store-build.js proves with a
 * real browser that nothing outside it can be triggered:
 *
 *   ping                  count the fillable fields, change nothing
 *   fillRegistration      type into the fields of a sign up form
 *   fillLogin             type into the fields of a login form
 *   fillOtp               type a one time code the user pasted in
 *   listPendingCheckboxes report which boxes still need a human
 *   detectOtpPage         report whether this looks like a code page
 *   prepareForRegistration report whether a form is present
 *
 * Not on the list, and not implemented anywhere: submitting, ticking a
 * checkbox, opening a verification link, reading a code off the screen,
 * dismissing a banner, creating an e mail address, and inventing an identity.
 */
const ALLOWED_ACTIONS = new Set([
  'ping',
  'fillRegistration',
  'fillLogin',
  'fillOtp',
  'listPendingCheckboxes',
  'prepareForRegistration',
  'detectOtpPage',
]);

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!ALLOWED_ACTIONS.has(request?.action)) {
    sendResponse({ success: false, errorCode: 'actionNotAllowed', error: 'Unsupported action.' });
    return;
  }

  if (request.action === 'ping') {`
  );

  write(f, src);
}

// ---------------------------------------------------------------------------
// 4) manifest.json: narrow permissions, and the fields Firefox needs.
// ---------------------------------------------------------------------------
{
  const f = path.join(OUT, 'manifest.json');
  const m = JSON.parse(read(f));

  m.version = VERSION;
  m.name = 'AutoAccountMaker Form Filler';
  m.short_name = 'Form Filler';
  m.description =
    'Fills in web forms from the details you saved. You tick the boxes and ' +
    'press submit yourself. Nothing is sent anywhere.';
  delete m.homepage_url;
  m.minimum_chrome_version = '116';

  // No host permissions: content scripts handle page filling, and the extension
  // makes zero network calls. Complies strictly with least privilege.
  delete m.host_permissions;

  // Least privilege: tabs is not needed because activeTab grants access to
  // the current tab when the popup is opened.
  m.permissions = ['activeTab', 'scripting', 'storage'];

  // Firefox refuses to load a manifest without an id, and needs to know the
  // minimum version that supports the APIs used here.
  m.browser_specific_settings = {
    gecko: { id: GECKO_ID, strict_min_version: '109.0' },
  };

  delete m.default_locale;

  write(f, JSON.stringify(m, null, 2) + '\n');
  done.push('manifest.json rewritten for both stores');
}

// ---------------------------------------------------------------------------
// 5) Refuse to produce a build that is not actually compliant.
// ---------------------------------------------------------------------------
{
  const FORBIDDEN = [
    { name: 'hemlighet i klartext (64 hex)', re: /['"][0-9a-f]{64}['"]/ },
    { name: 'MASTER_SECRET med värde', re: /MASTER_SECRET\s*=\s*['"][0-9a-f]{32,}/i },
    { name: 'HMAC-nyckelgenerering', re: /hmacHex|createHmac|verifyHmacKey|checksumForSerial/ },
    { name: 'såld eller genererad nyckel', re: /AAM-PRO-\d{4}-[0-9a-f]{4}-[0-9a-f]{4}/i },
    { name: 'licensnyckel-fält', re: /inputLicenseKey|btnActivateLicense/ },
    { name: 'identitetsgenerator', re: /generateProfile|randomBirthDate|generateUsername/ },
    { name: 'e-postleverantör', re: /createMailTmAccount|createTempMailAccount|api\.mail\.tm|rapidapi/i },
    { name: 'bannarklickning', re: /dismissConsentBanners|accept all cookies|reject non-essential/i },
    { name: 'formulärinskickning', re: /findSubmitButton|findVerifyButton/ },
    { name: 'samtyckeskryssning', re: /box\.click\(\)/ },
    // The only click allowed in the whole build is inside the country listbox
    // helper, and the guard below enforces that by name.
    { name: 'klick utanför listrutan', re: /\.click\(\)/, except: 'selectListboxOption' },
    // The only place these words may appear is a comment explaining why they
    // are deliberately absent, so that is the one context allowed.
    { name: 'anti-robot', re: /not a robot|inte en robot/i, skipComments: true },
  ];

  /** Returns the body of a named top level function, by counting braces. */
  function functionBody(src, name) {
    const m = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`).exec(src);
    if (!m) return null;
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return src.slice(m.index + m[0].length, i);
      }
    }
    return null;
  }

  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { scan(p); continue; }
      if (!/\.(js|json|html|css|md)$/i.test(entry.name)) continue;
      const raw = read(p);
      // Comments are stripped before the scan, so a comment may name a
      // forbidden thing in order to explain why it is absent. Code may not.
      const code = raw
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^\s*\/\/.*$/gm, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ');

      for (const rule of FORBIDDEN) {
        if (!rule.re.test(code)) continue;
        if (rule.except) {
          // Count the allowed helper's own click, and require that every other
          // click is gone. The helper body is found by brace counting rather
          // than by a lazy regex, because a try/catch inside the body would
          // otherwise truncate the match. If the helper is ever renamed the
          // count drops to zero and the build fails loudly.
          const body = functionBody(code, rule.except);
          const allowedClicks = body ? (body.match(/\.click\(\)/g) || []).length : 0;
          const total = (code.match(/\.click\(\)/g) || []).length;
          if (!body) {
            problems.push(`${path.relative(OUT, p)}: ${rule.except}() finns inte, så klickguarden är trasig`);
          } else if (total !== allowedClicks) {
            problems.push(`${path.relative(OUT, p)}: ${rule.name} (${total - allowedClicks} klick utanför ${rule.except})`);
          }
          continue;
        }
        problems.push(`${path.relative(OUT, p)}: ${rule.name}`);
      }
      if (/\bfetch\s*\(|\bXMLHttpRequest\b|sendBeacon/.test(code)) {
        problems.push(`${path.relative(OUT, p)}: nätverkskod`);
      }
    }
  }
  scan(OUT);
}

console.log('Generated store-build/');
for (const line of done) console.log('  ' + line);

if (problems.length) {
  console.error('\nBUILDEN AVBRÖTS. Följande måste åtgärdas:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nKontrollerat: ingen konto skapelse, inget inskickande, ingen samtyckeskryssning, ingen nätverkskod.');
