/**
 * content.js: scans pages and fills in registration and login forms.
 */

const HIGHLIGHT_CLASS = 'aam-highlight';

function injectStyles() {
  if (document.getElementById('aam-styles')) return;
  const style = document.createElement('style');
  style.id = 'aam-styles';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 2px solid #10b981 !important;
      background-color: #ecfdf5 !important;
      transition: outline 0.2s ease;
    }
  `;
  document.head.appendChild(style);
}

function setInputValue(input, value) {
// Use the prototype from the element OWN window: an <input> in a shadow root
  // belongs to the same document, but a future iframe context would have its own prototype.
  const view = input.ownerDocument?.defaultView || window;
  const proto = Object.getPrototypeOf(input);
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    || Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;
  // composed: true lets the event pass out of the shadow root, so that
  // the custom element above hears about the change.
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.classList.add(HIGHLIGHT_CLASS);
}

// Synonyms for gender, so "male" also matches "Man", "M", "Herr" and so on.
const GENDER_SYNONYMS = {
  male: ['male', 'man', 'm', 'manne', 'herr', 'hombre', 'erkek', 'adam', 'masculin', 'männlich', 'homme'],
  female: ['female', 'woman', 'w', 'f', 'kvinna', 'kvin', 'dam', 'fr', 'femme', 'mujer', 'kadın', 'weiblich', 'dame'],
  other: ['other', 'annan', 'annet', 'otro', 'otra', 'diger', 'digers', 'autre', 'anders', 'altro', 'başka'],
  company: ['company', 'foretag', 'företag', 'firma', 'empresa', 'societe', 'gesellschaft'],
};

/**
   * Countries with aliases in several languages. Many sites list countries in their
   * own language, so we match every common variant.
 */
const COUNTRIES = [
  { code: 'SE', names: ['sweden', 'sverige', 'suède', 'suède', 'schweden', 'isveç', 'suecia', 'szwecja'] },
  { code: 'NO', names: ['norway', 'norge', 'norvège', 'norwegen', 'norveç', 'noruega'] },
  { code: 'DK', names: ['denmark', 'danmark', 'danemark', 'dänemark', 'danimarka', 'dinamarca'] },
  { code: 'FI', names: ['finland', 'suomi', 'finlande', 'finnland', 'finlandia', 'suomi'] },
  { code: 'IS', names: ['iceland', 'island', 'islande', 'island', 'islandia', 'ísland'] },
  { code: 'DE', names: ['germany', 'tyskland', 'deutschland', 'allemagne', 'alemania', 'germania'] },
  { code: 'GB', names: ['united kingdom', 'england', 'great britain', 'storbritannien', 'grande-bretagne', 'reino unido', 'vereinigtes königreich'] },
  { code: 'US', names: ['united states', 'usa', 'u.s.', 'amerika', 'förenta staterna', 'états-unis', 'estados unidos', 'vereinigte staaten'] },
  { code: 'CA', names: ['canada', 'kanada', 'canadá'] },
  { code: 'AU', names: ['australia', 'australien', 'australie', 'australia'] },
  { code: 'NZ', names: ['new zealand', 'nya zeeland', 'nouvelle-zélande', 'neuseeland'] },
  { code: 'ES', names: ['spain', 'spanien', 'espagne', 'españa', 'spanien', 'spagna'] },
  { code: 'PT', names: ['portugal'] },
  { code: 'IT', names: ['italy', 'italien', 'italie', 'italia', 'italien'] },
  { code: 'FR', names: ['france', 'frankreich', 'france', 'francia', 'frankrike'] },
  { code: 'NL', names: ['netherlands', 'niederlande', 'niederlande', 'pays-bas', 'países bajos', 'nederland', 'paesi bassi'] },
  { code: 'BE', names: ['belgium', 'belgien', 'belgique', 'bélgica', 'belgië'] },
  { code: 'IE', names: ['ireland', 'irland', 'irlande', 'irlanda', 'íland'] },
  { code: 'PL', names: ['poland', 'polen', 'pologne', 'polonia', 'polska'] },
  { code: 'CZ', names: ['czechia', 'czech republic', 'tcheca', 'tjechien', 'czech'] },
  { code: 'AT', names: ['austria', 'österreich', 'autriche', 'austria', 'österreich'] },
  { code: 'CH', names: ['switzerland', 'schweiz', 'suisse', 'suiza', 'schweiz'] },
  { code: 'GR', names: ['greece', 'griechenland', 'grèce', 'grecia', 'yunnan'] },
  { code: 'RO', names: ['romania', 'rumänien', 'roumanie', 'romania', 'românia'] },
  { code: 'HU', names: ['hungary', 'ungern', 'hongrie', 'hungría', 'magyarország'] },
  { code: 'UA', names: ['ukraine', 'ukraina', 'ucraina', 'україна'] },
  { code: 'RU', names: ['russia', 'ryssland', 'russie', 'rusia', 'россия'] },
  { code: 'TR', names: ['turkey', 'türkiye', 'türkei', 'turquie', 'turquía', 'türkiye'] },
  { code: 'IL', names: ['israel', 'israel'] },
  { code: 'AE', names: ['united arab emirates', 'uae', 'emiraten', 'émirats arabes', 'birleşik arap emirlikleri'] },
  { code: 'SA', names: ['saudi arabia', 'saudi', 'saudi-arabien', 'arabie saoudite'] },
  { code: 'IN', names: ['india', 'indien', 'inde', 'índia'] },
  { code: 'CN', names: ['china', 'kina', 'chine', 'china', 'cina'] },
  { code: 'JP', names: ['japan', 'japan', 'japon', 'giappone', 'japón'] },
  { code: 'KR', names: ['south korea', 'korea', 'sydkorea', 'corée du sud', 'corea del sur'] },
  { code: 'SG', names: ['singapore', 'singapur'] },
  { code: 'BR', names: ['brazil', 'brasilien', 'brésil', 'brasil', 'brasilië'] },
  { code: 'MX', names: ['mexico', 'mexiko', 'mexique', 'méxico', 'mexico'] },
  { code: 'AR', names: ['argentina', 'argentinien', 'argentine', 'argentina'] },
  { code: 'ZA', names: ['south africa', 'südafrika', 'afrique du sud', 'sudamérica', 'zuid-afrika'] },
  { code: 'NG', names: ['nigeria'] },
  { code: 'EG', names: ['egypt', 'ägypten', 'égypte', 'egipto'] },
  { code: 'ID', names: ['indonesia'] },
  { code: 'TH', names: ['thailand', 'thailand'] },
  { code: 'VN', names: ['vietnam'] },
  { code: 'PH', names: ['philippines', 'filippinerna', 'philippines'] },
  { code: 'PK', names: ['pakistan'] },
  { code: 'BD', names: ['bangladesh'] },
];

/** Returns the country details for an ISO code, with the English name as fallback. */
function countryByCode(code) {
  const wanted = String(code || '').toUpperCase();
  const found = COUNTRIES.find((c) => c.code === wanted);
  return found || { code: wanted, names: [wanted.toLowerCase()] };
}

/** Ord som markerar en landkontroll. */
const COUNTRY_WORDS = /(country|countries|land|landet|landes|nation|landet|pays|país|paese|ülke|страна|دولة)/i;

function normalizeOptionText(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/**
   * Sets a <select> value. Returns true if something was selected.
 *
   * allowClosest is used for numeric lists (year/month/day). Then we pick the
   * closest option when the exact value is missing. Without it we silently lose
   * the field on sites that only offer a limited year range.
 */
function setSelectValue(select, value, options = {}) {
  const { allowClosest = false, synonyms = null, strict = false } = options;
  const opts = [...select.options];
  if (!opts.length) return false;

  const target = normalizeOptionText(value);
  if (!target) return false;

  let match = null;

  // 1) Exact hit on value or visible text.
  match = opts.find((o) => normalizeOptionText(o.value) === target || normalizeOptionText(o.text) === target);

  // 2) Synonymer (t.ex. "male" -> "Man").
  if (!match && synonyms) {
    const wanted = synonyms.map(normalizeOptionText);
    match = opts.find((o) => {
      const v = normalizeOptionText(o.value);
      const t = normalizeOptionText(o.text);
      return v && wanted.includes(v) || t && wanted.includes(t);
    });
  }

  // 3) Substring (for example "Mar" inside "March"). Skipped in strict mode, where
  //    substrings give false hits ("SE" in "Senegal", "NO" in "North Korea").
  if (!match && !strict) {
    match = opts.find((o) => {
      const t = normalizeOptionText(o.text);
      return t.length > 2 && (t.includes(target) || target.includes(t));
    });
  }

  // 4) Numeric hit, tolerant of "07" versus "7".
  if (!match && /^\d+$/.test(target)) {
    const n = Number(target);
    match = opts.find((o) => normalizeOptionText(o.value) !== '' && Number(normalizeOptionText(o.value)) === n);
  }

  // 5) Year outside the range of the list, so the closest one.
  if (!match && allowClosest && /^\d{4}$/.test(target)) {
    const year = Number(target);
    const candidates = opts
      .map((o) => ({ o, y: Number(normalizeOptionText(o.value)) }))
      .filter((x) => normalizeOptionText(x.o.value) !== '' && Number.isFinite(x.y));
    if (candidates.length) {
      candidates.sort((a, b) => Math.abs(a.y - year) - Math.abs(b.y - year));
      match = candidates[0].o;
    }
  }

  // 6) Month or day entirely missing, so the closest numeric option.
  if (!match && allowClosest && /^\d{1,2}$/.test(target)) {
    const n = Number(target);
    const candidates = opts
      .map((o) => Number(normalizeOptionText(o.value)))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (candidates.length) {
      candidates.sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
      const nearest = candidates[0];
      match = opts.find((o) => Number(normalizeOptionText(o.value)) === nearest);
    }
  }

  if (!match) return false;

  select.value = match.value;
  select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  select.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  select.classList.add(HIGHLIGHT_CLASS);
  return true;
}

function findInputs() {
  const inputs = deepQueryAll('input, textarea');
  const selects = deepQueryAll('select');
  const all = [...inputs, ...selects];

  const result = {
    email: null,
    password: null,
    confirmPassword: null,
    username: null,
    firstName: null,
    lastName: null,
    fullName: null,
    emailConfirm: null,
    country: null,
    birthDate: null,
    birthDay: null,
    birthMonth: null,
    birthYear: null,
    gender: null,
    submit: null,
  };

  const birthCandidates = [];

  // Only text like fields can be filled in. Without this guard a checkbox
  // or a button can hijack a field slot: for example the Swedish word for marketing
  // /ad/ pattern and becomes the first name field. That stopped real name fields
  const FILLABLE_INPUT_TYPES = new Set(['text', 'email', 'password', 'tel', 'number', 'date', 'search', 'url', '']);

  all.forEach((el) => {
    if (el.disabled || el.offsetParent === null) return;
    const tag = el.tagName.toLowerCase();
    const type = (el.type || 'text').toLowerCase();

    if (type === 'hidden') return;
    if (tag !== 'select' && !FILLABLE_INPUT_TYPES.has(type)) return;

    const name = (el.name || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.placeholder || '').toLowerCase();
    const label = findLabelText(el).toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const autoComplete = (el.autocomplete || '').toLowerCase();
    const combined = `${name} ${id} ${placeholder} ${label} ${ariaLabel} ${autoComplete}`.toLowerCase();
    // type=email is unambiguous and must be judged first. Earlier the e mail check
    // sat below the username and was additionally locked with !result.username,
    // which meant the e mail field never got filled on forms where the username
    // comes first (the test page, and many real sites).
    if (type === 'email') {
      // A second e mail address is almost always the confirmation field.
      const isConfirm = /confirm|bekräft|bekraft|repeat|again|verify|validation|repeat/.test(combined);
      if (isConfirm) {
        if (!result.emailConfirm) result.emailConfirm = el;
      } else if (!result.email) {
        result.email = el;
      } else if (!result.emailConfirm) {
        result.emailConfirm = el;
      }
    } else if (/user|username|användarnamn|kullanici|usuario|benutzer|utilisateur/.test(combined) && type === 'text') {
      if (!result.username) result.username = el;
    } else if (
      /(^|[\s_@.-])(mail|epost|e-post|correo|posta)([\s_.@-]|$)/.test(combined) &&
      (type === 'text' || type === 'tel')
    ) {
      if (!result.email) result.email = el;
    } else if (type === 'password' || /pass|lösen|losen|parola|sifre|şifre|contraseña/.test(combined)) {
      if (!result.password) result.password = el;
      else if (!result.confirmPassword && /confirm|repeat|again|bekräft|tekrar|igen|confirmar/.test(combined)) {
        result.confirmPassword = el;
      } else if (!result.confirmPassword) result.confirmPassword = el;
    // Obs: inga korta ord som "ad" — det matchar bland annat "marknad" och
    // "adress", which made checkboxes hijack the name fields.
    } else if (
      type === 'text' &&
      /(first|fornamn|förnamn|fname|given.?name|ime\s*nombre|prénom|vorname|ime[nr])/i.test(combined) &&
      !/(last|efter)/i.test(combined)
    ) {
      if (!result.firstName) result.firstName = el;
    } else if (
      type === 'text' &&
      /(last|efternamn|familyname|family.?name|surname|apellidos?|nachname|nom\s*de\s*famille|szurname)/i.test(combined)
    ) {
      if (!result.lastName) result.lastName = el;
    } else if (/full.?name|namn|name/.test(combined) && type === 'text') {
      if (!result.fullName) result.fullName = el;
    }

    // Day/month/year. The three checks are independent if statements, not else if,
    // so an element matching "month" does not stop another from matching
    // "day". The other fields are still an else if chain above.
    if (!result.birthYear && (tag === 'select' || type === 'number' || type === 'tel') &&
        (/year|år|ano|jahr|année|año/.test(combined) || autoComplete === 'bday-year')) {
      result.birthYear = el;
    }
    if (!result.birthMonth && (tag === 'select' || type === 'number' || type === 'tel') &&
        (/month|månad|monat|mes|\bay\b/.test(combined) || name === 'mm' || id === 'mm' || autoComplete === 'bday-month')) {
      result.birthMonth = el;
    }
    if (!result.birthDay && (tag === 'select' || type === 'number' || type === 'tel') &&
        (/day|dag|día|gun|gün/.test(combined) || name === 'dd' || id === 'dd' || autoComplete === 'bday-day')) {
      result.birthDay = el;
    }

    // Candidates for a single "whole date" field are decided after the loop, so we
    // do not set birthDate from one of the day/month/year fields.
    if ((type === 'date' || tag === 'select' || type === 'text') &&
        /(födelsedag|fodelsedag|födelsedatum|birthdate|birthday|birth|born|född|födelse|dob|nacimiento|geburtsdatum)/.test(combined)) {
      birthCandidates.push({ el, combined });
    }

    if (/(gender|sex|kön|köns|cinsiyet|geschlecht|genre)/.test(combined)) {
      if (!result.gender && (tag === 'select' || type === 'text' || type === 'radio')) result.gender = el;
    }

    // A <select> whose label or options contain countries is
    // landskontroll. Anpassade listboxar (knappar) hanteras i setCountry().
    if (!result.country && tag === 'select') {
      const optionsText = [...el.options].map((o) => o.textContent).join(' ').toLowerCase();
      const looksLikeCountry = COUNTRY_WORDS.test(combined) || COUNTRIES.some((c) =>
        c.names.some((n) => optionsText.includes(n))
      );
      if (looksLikeCountry) result.country = el;
    }
  });

    // Use a single date field only if we did NOT find separate day/month/year fields.
  if (!result.birthYear && !result.birthMonth && !result.birthDay && birthCandidates.length) {
    result.birthDate = birthCandidates[0].el;
  }

  return result;
}

function findLabelText(input) {
  if (input.id) {
    // Search inside the same shadow root first: an id is only unique within its tree
    const root = input.getRootNode?.() || document;
    let label = null;
    try { label = root.querySelector(`label[for="${input.id}"]`); } catch {}
    if (!label && root !== document) {
      label = deepQueryAll(`label[for="${input.id}"]`)[0] || null;
    }
    if (label) return label.textContent || '';
  }
  const parentLabel = input.closest?.('label');
  return parentLabel?.textContent || '';
}

/**
   * Searches the whole document, INCLUDING every shadow root.
 *
   * Many modern sites build their forms from custom elements
 * (<w-textfield>, <w-button> med en <input> inuti en shadow root). Vanlig
 * document.querySelectorAll sees nothing there. On login.vend.se we found no
 * fields even though the e mail field was clearly visible. That is why we walk
 * through the shadow roots as well.
 */
function deepQueryAll(selector, root = document) {
  const found = [];
  const seen = new Set();
  const visit = (r) => {
    let hits;
    try { hits = r.querySelectorAll(selector); } catch { return; }
    for (const el of hits) found.push(el);
    let all;
    try { all = r.querySelectorAll('*'); } catch { return; }
    for (const el of all) {
      if (el.shadowRoot && !seen.has(el)) {
        seen.add(el);
        visit(el.shadowRoot);
      }
    }
  };
  visit(root);
  return found;
}

function visibleControls(selector) {
  return deepQueryAll(selector).filter((el) => {
    // Skip hidden buttons. Many sites have both a visible and a hidden login or
    // registration form, and without this check we can click the hidden button and
    // nothing happens.
    if (el.disabled) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  });
}

/** Every clickable element we can think of, plain links included. */
const CONTROL_SELECTOR = 'button, a, [role="button"]';

/**
   * Clicks the button whose text matches one of the patterns. Returns the text or null.
 * `exclude` can contain already clicked texts so we do not get stuck in a
   * whose click did not give any result.
 *
   * Buttons in a dialog or modal come first: on sites with a hero button in the
   * header and a modal placed late in the DOM, the modal button is the next step.
 */
function clickButtonMatching(patterns, label, exclude) {
  const candidates = [];
  for (const btn of visibleControls(CONTROL_SELECTOR)) {
    const text = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
    if (!text) continue;
    if (exclude && exclude.has(text)) continue;
    if (!patterns.some((p) => text.includes(p))) continue;
    const inDialog = !!btn.closest('[role="dialog"], dialog, [aria-modal="true"]');
    candidates.push({ btn, text, inDialog });
  }
  if (!candidates.length) return null;

  const inDialogs = candidates.filter((c) => c.inDialog);
  const chosen = (inDialogs.length ? inDialogs : candidates)[0];
  chosen.btn.click();
  return { text: chosen.text.slice(0, 40), fullText: chosen.text, label, element: chosen.btn };
}

// Providers of social login. We NEVER click these: use an e mail account
// instead, and doing that would create an account the user did not intend.
const SOCIAL_PROVIDERS = [
  'google', 'apple', 'microsoft', 'facebook', 'twitter', 'x.com', 'linkedin',
  'github', 'gitlab', 'sso', 'single sign', 'saml', 'okta', 'auth0',
];

// Buttons that lead on towards an e mail form. The list is deliberately
// narrow so we never click generic marketing promises like "Try for free".
// they can lead to a completely different page than the registration.
const SIGNUP_ADVANCE = [
  'sign up', 'signup', 'register', 'create account',
  'continue with email', 'sign up with email', 'use email',
  'get started', 'börja', 'registrera', 'skapa konto',
  'fortsätt med e-post', 'anmelden',
];

/**
 * Cookie and consent banners often sit at the top of the page and cover the
 * buttons under them. We get rid of them first: "accept" if there is one, otherwise
 * "reject non essential", which closes most banners.
 */
function dismissConsentBanners() {
  const accept = [
    'accept all', 'accept all cookies', 'allow all', 'agree to all', 'got it',
    'acceptera alla', 'godkänn alla', 'tillåt alla', 'alla cookies',
    'alle akzeptieren', 'tout accepter', 'acceptar tot', 'aceptar todas',
    'tümünü kabul et', 'hepsini kabul et', 'قبول الكل',
  ];
  const reject = [
    'reject non-essential', 'reject all', 'only necessary', 'decline',
    'avvisa icke-väsentlig', 'avvisa alla', 'endast nödvändiga', 'nej tack',
    'nur notwendige', 'tout refuser', 'rechazar', 'yalnızca zorunlu', 'رفض',
  ];

  return clickButtonMatching(accept, 'consent') || clickButtonMatching(reject, 'consent');
}

/**
   * Ticks the checkboxes that must be checked for the form to be submittable
 * to submit: Terms, privacy, age confirmation, and whatever the site marks as
 * required. It is the same thing a human does with a mouse, and any extra
 * work afterwards (for example proof of work) the page does in its own code.
 */
function checkConsentCheckboxes() {
  const termsWords = /(terms|privacy|policy|agree|accept|consent|i.?m at least|age|18|villkor|godkänn|samtycker|accepter|zustimmung|accepter|şartlar|onay|شروط|موافقة|inte en robot)/i;
  const out = [];

  for (const box of deepQueryAll('input[type="checkbox"], input[type="radio"]')) {
    if (box.disabled || box.offsetParent === null || box.checked) continue;
    const label = (
      box.closest?.('label')?.innerText || box.getAttribute('aria-label') || box.id || ''
    ).trim();

    const needed = box.required === true || termsWords.test(label);
    if (!needed) continue;

    // Highlight the checkbox so the user easily sees what to accept, but DO NOT click it
    box.classList.add(HIGHLIGHT_CLASS);
    try {
      box.style.outline = '2px solid #f59e0b';
      box.style.boxShadow = '0 0 6px #f59e0b';
    } catch {}

    out.push({
      label: label.replace(/\s+/g, ' ').slice(0, 60) || box.id || 'checkbox',
      required: box.required === true,
    });
  }
  return out;
}

/**
 * Is there any country control on the page? Used to tell "we were asked for a
 * country but could not set it" (a real error) from "the page does not ask
 */
function pageHasCountryControl() {
  for (const sel of deepQueryAll('select')) {
    if (sel.offsetParent === null) continue;
    const meta = `${sel.id} ${sel.name} ${sel.getAttribute('aria-label') || ''} ${findLabelText(sel)}`.toLowerCase();
    if (COUNTRY_WORDS.test(meta)) return true;
  }
  return visibleControls('button, [role="combobox"], a, [role="button"]').some((el) => {
    const t = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    return t && /\b(välj land|select country|choose country|select your country|choose your country|country|land)\b/i.test(t);
  });
}

/** Is there a visible e mail or password field on the page right now? */
function hasSignupFields() {
  const f = findInputs();
  return !!(f.email || f.password);
}

/**
 * Normalizes country text: lowercase, diacritics removed, extra spaces gone.
   * "Sverige", "sverige" and " SVERIGE " compare as equal.
 */
function normalizeCountryText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches the country name or code against a text snippet, with a WORD BOUNDARY.
 *
 * This is decisive for correctness. A plain substring match goes wrong, because
 * the code "NO" hits "North Korea" and "SE" hits "Senegal", which would make us
   * the extension reports a country choice it never made. Two and three letter
   * forms must therefore match as whole words, never as substrings.
 */
function matchesCountryAlias(text, aliases) {
  const t = normalizeCountryText(text);
  if (!t) return false;
  return (aliases || []).some((raw) => {
    const a = normalizeCountryText(raw);
    if (!a) return false;
    if (t === a) return true;
    // Word boundary: "no" must not match "north", only "no" or "norge (no)".
    return new RegExp(`(^| )${escapeRegExp(a)}($| )`).test(t);
  });
}

/**
 * Clicks an element the way a user would. Many sites build their
 * listboxes on pointer events and do not react at all to a plain .click(), so
 * Radix and Headless UI need the full pointerdown, mouseup, click chain.
 */
function userClick(el) {
    // composed: true, otherwise the events stay inside the shadow root and
  // custom elementet (t.ex. <w-button>) reagerar inte alls.
  const opts = { bubbles: true, cancelable: true, composed: true, view: window, pointerId: 1, isPrimary: true };
  try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch {}
  try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch {}
  try { el.click(); } catch {}
}

/**
 * Sites often use their own listbox instead of a <select>: a button that
 * opens a <ul role="listbox"> with <li role="option"> inside. We open the
 * button and click the option we want.
 */
async function chooseFromCustomListbox(triggerPattern, optionAliases) {
  const triggers = visibleControls('button, [role="combobox"], a, [role="button"]');
  const trigger = triggers.find((el) => {
    const t = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    return t && triggerPattern.test(t);
  });
  if (!trigger) return false;

  const textOf = (el) => (el.innerText || el.textContent || '').trim();
  const before = normalizeCountryText(textOf(trigger));

  userClick(trigger);
  await new Promise((r) => setTimeout(r, 800));

  const options = deepQueryAll('[role="option"], [role="menuitem"]')
    .filter((el) => el.offsetParent !== null);
  if (!options.length) return false;

    // Word boundary matching, never a substring for short country codes.
  const target = options.find((o) => matchesCountryAlias(textOf(o), optionAliases));

  if (!target) return false;
  userClick(target);
  await new Promise((r) => setTimeout(r, 400));

  // Confirm that the choice actually stuck. We require two things: that the
  // button text changed from the placeholder ("select country") AND that it now
  // contains the chosen country by word boundary. Otherwise we pretend it worked.
  const after = visibleControls('button, [role="combobox"]');
  const changed = after.some((el) => {
    const now = normalizeCountryText(textOf(el));
    if (!now || now === before) return false;
    return matchesCountryAlias(now, optionAliases);
  });
  return changed;
}

/**
 * Chooses a country, either in a normal <select> or in a custom listbox.
 * Returns which path was used, so the popup can show it.
 */
async function setCountry(countryCode) {
  const country = countryByCode(countryCode);

  // 1) Vanlig <select>
  const selects = deepQueryAll('select').filter((el) => el.offsetParent !== null);
  for (const sel of selects) {
    const meta = `${sel.id} ${sel.name} ${sel.getAttribute('aria-label') || ''} ${findLabelText(sel)}`.toLowerCase();
    const optionsText = [...sel.options].map((o) => o.textContent).join(' ');
    const looksLikeCountry = COUNTRY_WORDS.test(meta) || matchesCountryAlias(optionsText, country.names);
    if (!looksLikeCountry) continue;
    // strict turns off substring matching so "SE" cannot hit "Senegal",
    if (setSelectValue(sel, country.code, { synonyms: country.names, strict: true })) {
      sel.classList.add(HIGHLIGHT_CLASS);
      return { via: 'select', country: country.names[0] };
    }
  }

  // 2) Custom listbox: a button whose text names a country. Word bounded keywords,
  // so a button with text like "North Korea" is not seen as a country picker.
  const viaButton = await chooseFromCustomListbox(
    /\b(välj land|select country|choose country|select your country|choose your country|country|land)\b/i,
    [country.code, ...country.names]
  );
  if (viaButton) return { via: 'listbox', country: country.names[0] };

  return null;
}

/**
   * Clicks its way to the registration form on sites that require an extra
   * step (for example "Sign up" then "Continue with Email"). The process is limited
   * to a few clicks and we never touch social login.
 *
   * Each button text is clicked at most once, otherwise we get stuck on "Sign up" in
 * the header that stays behind the modal instead of moving on to the next step.
 */
async function advanceToSignupForm(maxClicks = 4) {
  const actions = [];
  const tried = new Set();

  for (let i = 0; i < maxClicks; i++) {
    if (hasSignupFields()) break;
    const hit = clickButtonMatching(SIGNUP_ADVANCE, 'advance', tried);
    if (!hit) break;
    if (SOCIAL_PROVIDERS.some((s) => hit.text.includes(s))) break;
    tried.add(hit.fullText);
    actions.push(hit.text);
    // Let the page react before we look for the next button.
    await new Promise((r) => setTimeout(r, 1200));
  }
  return { actions, hasFields: hasSignupFields() };
}

function findSubmitButton(mode) {
  const buttons = visibleControls('button, input[type="submit"], a[role="button"]');
  const registerWords = /register|registrera|skapa|sign.?up|gå med|join|kaydol|kayit|üye|hesap|crear cuenta|registrar|compte|kayıt/i;
  const loginWords = /log.?in|sign.?in|anmelden|giriş|giris|logga|connexion|anmelden/i;

  for (const btn of buttons) {
    const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
    if (mode === 'register' && registerWords.test(text)) return btn;
    if (mode === 'login' && loginWords.test(text)) return btn;
  }

    // Visible submit buttons in priority order: type=submit, or the
  // the button in the visible form card.
  const submit = visibleControls('button[type="submit"], input[type="submit"]')[0];
  if (submit) return submit;

  return buttons[0] || null;
}

function findVerifyButton() {
  const buttons = visibleControls('button, input[type="submit"], a[role="button"]');
  const words = /next|nästa|fortsätt|verify|verifiera|confirm|bekräfta|submit|send|continue|done|ok|devam|onay|weiter/i;
  for (const btn of buttons) {
    const text = (btn.textContent || btn.value || btn.getAttribute('aria-label') || '').trim();
    if (words.test(text)) return btn;
  }
  return visibleControls('button[type="submit"]')[0] || null;
}

function findOtpInputs() {
  const all = deepQueryAll('input:not([type="hidden"]):not([type="search"])').filter(
    (el) => el.offsetParent !== null && !el.disabled
  );

  // The number of fields that explicitly accept a single character. It is the
  // strongest signal for a one digit per box layout, and it outweighs
    // than the width, because the width depends on CSS and in practice has
  // a width of about 40 px versus about 180 px for the same kind of box layout.
  const oneCharInputs = all.filter(
    (el) => parseInt(el.getAttribute('maxlength') || '99', 10) === 1
  );
  const manyOneCharBoxes = oneCharInputs.length >= 4;

    // 1) Several small boxes, where each input accepts one character
  let digitBoxes = all.filter((el) => {
    const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
    const type = (el.type || 'text').toLowerCase();
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const isTypable = type === 'tel' || type === 'text' || type === 'number' || el.inputMode === 'numeric';
    if (!isTypable) return false;
    if (ml === 1) return true;
    // Without maxlength we have to guess based on the width instead.
    return ml > 1 && rect.width < 100;
  });

  if (digitBoxes.length < 4) {
    const shortInputs = all.filter((el) => {
      const type = (el.type || '').toLowerCase();
      const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 && rect.width < 80 &&
        (type === 'tel' || type === 'number' || el.inputMode === 'numeric' || ml <= 2)
      );
    });
    if (shortInputs.length >= 4 && shortInputs.length <= 8) digitBoxes = shortInputs;
  }

  if (digitBoxes.length >= 4 && digitBoxes.length <= 8) {
    digitBoxes.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
    return { type: 'multi', inputs: digitBoxes };
  }

    // 2) A single field, either autocomplete one-time-code or named code/otp/pin
  const single = all.find((el) => {
    const combined = `${el.name} ${el.id} ${el.placeholder} ${el.autocomplete} ${el.className} ${findLabelText(el)}`.toLowerCase();
    const type = (el.type || '').toLowerCase();
    const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
    const hasOtpAttr = el.autocomplete === 'one-time-code' || el.getAttribute('data-otp') !== null || el.getAttribute('data-verify') !== null;
    // En ruta i en "en siffra per ruta"-layout ska ALDRig tolkas som ett
    // single field for the whole code, otherwise all the digits end up in box one
    // and the verification fails. (That happened on Vend like sites.)
    if (manyOneCharBoxes && ml === 1) return false;
    return (
      hasOtpAttr ||
      /code|otp|pin|verif|kod|token|tfa|2fa|mfa|auth|security.?code/.test(combined) ||
      (type === 'tel' && ml >= 4 && ml <= 8) ||
      (type === 'text' && ml >= 4 && ml <= 8) ||
      (type === 'number' && ml >= 4 && ml <= 8) ||
      el.inputMode === 'numeric'
    );
  });

  if (single) return { type: 'single', inputs: [single] };

    // 3) Fallback: fields with inputmode=numeric or autocomplete one time code
  const fallback = all.find((el) => {
    const type = (el.type || '').toLowerCase();
    const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
    const combined = `${el.name} ${el.id} ${el.placeholder} ${el.autocomplete} ${el.className} ${findLabelText(el)}`.toLowerCase();
    const hasOtpContext = /code|otp|pin|verif|kod|token|tfa|2fa|mfa|auth|security/i.test(combined);
    return (
      (type === 'text' || type === 'tel') &&
      ml >= 4 && ml <= 8 &&
      el.offsetParent !== null &&
      (el.inputMode === 'numeric' || el.autocomplete === 'one-time-code' || hasOtpContext)
    );
  });

  if (fallback) return { type: 'single', inputs: [fallback] };

  return null;
}

function fillOtpCode(code, autoSubmit = true) {
  injectStyles();
  const otp = String(code).replace(/\D/g, '');
  if (!otp) return { success: false, error: 'Invalid code' };

  const found = findOtpInputs();
  if (!found) return { success: false, error: 'No code field found on the page' };

  if (found.type === 'multi') {
    const digits = otp.split('');
    found.inputs.forEach((input, i) => {
      if (digits[i]) {
        input.focus();
        setInputValue(input, digits[i]);
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: digits[i] }));
        input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: digits[i], inputType: 'insertText' }));
      }
    });
    // Focus the first empty box, or the last one when all are filled
    const firstEmpty = found.inputs.find((inp, idx) => !digits[idx]);
    if (firstEmpty) firstEmpty.focus();
    else found.inputs[found.inputs.length - 1].focus();
  } else {
    const el = found.inputs[0];
    el.focus();
    el.select();
    setInputValue(el, otp);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: otp, inputType: 'insertFromPaste' }));
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, composed: true, clipboardData: new DataTransfer() }));
  }

  let submitted = false;
  // User explicitly clicks Next / Create account themselves
  /* autoSubmit disabled */

  return { success: true, submitted, digits: otp.length, fieldType: found.type };
}

function getEmailOnPage() {
  const body = document.body?.innerText || '';
  const m = body.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

function isOtpPage() {
  const body = document.body?.innerText?.toLowerCase() || '';
  const html = document.body?.innerHTML?.toLowerCase() || '';
  const url = location.href.toLowerCase();
  const hasOtpUi = !!findOtpInputs();
  if (!hasOtpUi) return false;
  const hasOtpText = /(verification code|verifieringskod|enter.*code|ange.*kod|6.?digit|6.?siffr|one.?time.?code|engångskod|security code|check your email|vi har skickat|we sent|please verify|vänligen verifiera)/i.test(body);
  const hasOtpHtml = /(inputmode="numeric"|autocomplete="one-time-code"|data-otp|data-verify)/i.test(html);
  const hasOtpUrl = /(verify|challenge|otp|code|confirm|verif|activate|aktivera|two.?factor|2fa|mfa)/i.test(url);
  return hasOtpText || hasOtpUrl || hasOtpHtml;
}

async function fillForm(profile, mode = 'register', autoSubmit = true) {
  injectStyles();
  const fields = findInputs();
  const filled = { email: false, password: false, username: false, name: false, gender: false, birthDate: false, emailConfirm: false, country: false };

  // Fields we found but could not fill. The user needs to know this,
    // otherwise an incomplete filled form looks like everything went well.
  const missing = [];
  const report = {};

  if (fields.email) {
    setInputValue(fields.email, profile.email);
    filled.email = true;
  }
    // The e mail confirmation field must hold exactly the same address.
  if (fields.emailConfirm) {
    setInputValue(fields.emailConfirm, profile.email);
    filled.emailConfirm = true;
  }
  if (fields.password) {
    setInputValue(fields.password, profile.password);
    filled.password = true;
  }
  if (fields.confirmPassword && mode === 'register') {
    setInputValue(fields.confirmPassword, profile.password);
  }
  if (fields.username) {
    setInputValue(fields.username, profile.username || profile.email.split('@')[0]);
    filled.username = true;
  }
  if (fields.firstName && profile.firstName) {
    setInputValue(fields.firstName, profile.firstName);
    filled.name = true;
  }
  if (fields.lastName && profile.lastName) {
    setInputValue(fields.lastName, profile.lastName);
    filled.name = true;
  }
  if (fields.fullName && profile.fullName) {
    setInputValue(fields.fullName, profile.fullName);
    filled.name = true;
  }

  if (fields.gender && profile.gender) {
    let ok = false;
    if (fields.gender.tagName === 'SELECT') {
      ok = setSelectValue(fields.gender, profile.gender, { synonyms: GENDER_SYNONYMS[profile.gender] || [] });
    } else if (fields.gender.type === 'radio') {
      const wanted = (GENDER_SYNONYMS[profile.gender] || [profile.gender]).map((s) => s.toLowerCase());
      const radios = deepQueryAll(`input[name="${fields.gender.name}"]`);
      for (const r of radios) {
        const label = normalizeOptionText(r.value) + ' ' + normalizeOptionText(r.getAttribute('aria-label'));
        if (wanted.some((w) => label.includes(w))) {
          r.checked = true;
          r.dispatchEvent(new Event('change', { bubbles: true }));
          r.classList.add(HIGHLIGHT_CLASS);
          ok = true;
          break;
        }
      }
    } else {
      setInputValue(fields.gender, profile.gender);
      ok = true;
    }
    if (ok) filled.gender = true;
    else missing.push('gender');
  }

  if (profile.birthDate) {
    const [year, month, day] = profile.birthDate.split('-');
    if (fields.birthDate) {
      if (fields.birthDate.tagName === 'SELECT') {
    // A single date field that is a <select> rarely holds a full ISO date
        // Try the whole date, then the parts, then only the year before giving up.
        const ok =
          setSelectValue(fields.birthDate, profile.birthDate) ||
          setSelectValue(fields.birthDate, `${year}-${month}-${day}`) ||
          setSelectValue(fields.birthDate, year, { allowClosest: true });
        if (ok) filled.birthDate = true;
        else missing.push('birthDate');
      } else {
        setInputValue(fields.birthDate, profile.birthDate);
        filled.birthDate = true;
      }
    }
    if (fields.birthYear) {
      const ok = fields.birthYear.tagName === 'SELECT'
        ? setSelectValue(fields.birthYear, year, { allowClosest: true })
        : (setInputValue(fields.birthYear, year), true);
      if (ok) filled.birthDate = true;
      else missing.push('birthYear');
    }
    if (fields.birthMonth) {
      const m = String(Number(month));
      const ok = fields.birthMonth.tagName === 'SELECT'
        ? setSelectValue(fields.birthMonth, m, { allowClosest: true })
        : (setInputValue(fields.birthMonth, m), true);
      if (ok) filled.birthDate = true;
      else missing.push('birthMonth');
    }
    if (fields.birthDay) {
      const d = String(Number(day));
      const ok = fields.birthDay.tagName === 'SELECT'
        ? setSelectValue(fields.birthDay, d, { allowClosest: true })
        : (setInputValue(fields.birthDay, d), true);
      if (ok) filled.birthDate = true;
      else missing.push('birthDay');
    }
  }

  // Visible fields we do not recognize at all. We only count text like
    // controls: checkboxes, search fields and submit buttons do not count,
    // otherwise the popup would warn about those on every site.
  const known = new Set([
    fields.email, fields.emailConfirm, fields.password, fields.confirmPassword, fields.username,
    fields.firstName, fields.lastName, fields.fullName, fields.country,
    fields.gender, fields.birthDate, fields.birthYear, fields.birthMonth, fields.birthDay,
  ].filter(Boolean));
  const FILLABLE_TYPES = new Set(['text', 'email', 'password', 'tel', 'number', 'date', 'search', 'url', '']);
  const unknownCount = deepQueryAll('input, select, textarea')
    .filter((el) => {
      if (el.disabled || el.offsetParent === null) return false;
      if (known.has(el)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'select' && tag !== 'textarea' && !FILLABLE_TYPES.has((el.type || '').toLowerCase())) return false;
      // Empty or already filled fields need nothing.
      return !el.value;
    }).length;
  if (unknownCount > 0) missing.push(`otherFields(${unknownCount})`);

  // Is there anything at all to fill? Without an e mail or password field we have
  // not filled anything, and we must not claim that we did. It happens on sites
  // where the form only appears after clicking through several pages.
  const noForm = !fields.email && !fields.password && !fields.username;
  if (noForm) {
    return {
      filled, submitted: false, mode, missing, noForm: true,
      checkboxes: checkConsentCheckboxes(),
    };
  }

  // Checkboxes that must be ticked before the form can be submitted
  const checkboxes = checkConsentCheckboxes();

  // Land: vanlig <select> eller anpassad listbox.
  if (profile.country) {
    if (fields.country) {
      const c = countryByCode(profile.country);
      const ok = setSelectValue(fields.country, c.code, { synonyms: c.names });
      if (ok) {
        fields.country.classList.add(HIGHLIGHT_CLASS);
        filled.country = true;
        report.country = { via: 'select', name: c.names[0] };
      } else {
        missing.push('country');
      }
    } else {
      const picked = await setCountry(profile.country);
      if (picked) {
        filled.country = true;
        report.country = picked;
      } else if (pageHasCountryControl()) {
        // Here there IS a country control but we could not set it. That is a
        // verkligt fel. Om sidan saknar landkontroll helt (t.ex. Vend, som bara
    // asks for an e mail) we say nothing, because "country missing" would be a
    // lie.
        missing.push('country');
      }
    }
  }

  // Auto-submit removed: user must click Next / Create account themselves.
  const submitted = false;

  return { filled, submitted, mode, missing, noForm: false, report, checkboxes };
}

/**
   * Prepares the page for a registration: closes cookie banners, clicks its way
   * to the form and then ticks Terms. The Terms checkbox is checked
 * last, because it usually sits in a modal that opens during the
 */
async function prepareForRegistration() {
  const consent = dismissConsentBanners();
  const funnel = await advanceToSignupForm();
  const terms = checkConsentCheckboxes();
  return {
    success: true,
    consentDismissed: !!consent,
    termsChecked: terms,
    funnelClicks: funnel.actions,
    hasFields: funnel.hasFields || hasSignupFields(),
  };
}

/**
 * Reads a code that is already visible on the page. Used by the local test
 * page that shows the code on screen instead of mailing it. We read the code
   * the same way a human does: from the OTP fields, or from the visible text.
 */
function readVisibleCode() {
  const found = findOtpInputs();
  if (found?.inputs?.length) {
    const digits = found.inputs
      .map((el) => String(el.value || '').replace(/\D/g, ''))
      .join('');
    if (digits.length >= 4) return { code: digits, from: 'inputs' };
  }

    // Fallback: a standalone four to eight digit number in the visible text,
    // preferably near the words "kod" or "code".
  const text = document.body?.innerText || '';
  const labelled = text.match(
    /(?:code|kod|pin|otp|verification|verifiering|bekräftelse)[:\s#-]{0,4}(\d{4,8})/i
  );
  if (labelled) return { code: labelled[1], from: 'text' };

  return { code: null };
}

/**
   * Reads what a verification page actually says. Used after the
 * the extension opened a verification link, so we only mark the account as
 * verified when the page actually confirms it, and not for example when
 * "expired"/"invalid").
 */
function verificationOutcome() {
  const body = (document.body?.innerText || '').toLowerCase();
  const url = location.href.toLowerCase();

  const failed = /(expired|invalid|has expired|no longer valid|already (been )?used|not found|error|failed|unable to|ogiltig|utgången|felaktig)/i;
  const succeeded =
    /(email (address )?(has been )?verified|successfully verified|your account (is|has been) (activated|verified|confirmed)|account activated|you'?re (all set|verified|confirmed)|thanks? for (verifying|confirming|activating|signing up)|bekräftad|verifierad|aktiverad|klart!)/i;

  if (failed.test(body) && !succeeded.test(body)) {
    const m = body.match(/(expired|invalid|already (been )?used|not found|ogiltig|utgången)/i);
    return {
      verified: false,
      failed: true,
      reason: 'The verification page says: "' + (m ? m[0] : 'invalid') + '".',
    };
  }

  // The page can also confirm through the URL (for example /email-verification?status=success)
  if (/(verified|activated|confirmed|success)/.test(url) && !/(pending|expired|invalid)/.test(url)) {
    return { verified: true, failed: false, via: 'url' };
  }

  if (succeeded.test(body)) {
    return { verified: true, failed: false, via: 'text' };
  }

  return { verified: false, failed: false };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'ping') {
    // We also answer with how many fillable fields are visible right now, so that
    // the caller can wait for the form to actually be rendered. During a
    // reload the content script answers a moment before the page is ready.
    const visibleFillable = deepQueryAll('input, select, textarea')
      .filter((el) => el.offsetParent !== null && !el.disabled).length;
    sendResponse({ pong: true, hasForm: hasSignupFields(), fields: visibleFillable });
    return;
  }
  if (request.action === 'fillRegistration') {
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
  }
  if (request.action === 'fillOtp') {
    sendResponse({
      success: true,
      result: fillOtpCode(request.code, request.autoSubmit !== false),
    });
  }
  if (request.action === 'detectOtpPage') {
    sendResponse({ success: true, isOtpPage: isOtpPage(), emailOnPage: getEmailOnPage() });
  }
  if (request.action === 'verificationOutcome') {
    sendResponse({ success: true, ...verificationOutcome() });
  }
  if (request.action === 'readVisibleCode') {
    sendResponse({ success: true, ...readVisibleCode() });
  }
  if (request.action === 'prepareForRegistration') {
  // Asynchronous: the click loop waits between the steps. Without "return true"
  // Chrome closes the channel before the response is sent and the popup gets nothing.
    prepareForRegistration()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
});
