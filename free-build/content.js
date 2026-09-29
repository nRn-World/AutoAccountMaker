/**
 * content.js — Skannar sidor och fyller i registrerings-/inloggningsformulär.
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
  // Använd prototypen från elementets EGEN window — en <input> i en shadow root
  // tillhör samma dokument, men en framtida iframe-kontext hade egen prototyp.
  const view = input.ownerDocument?.defaultView || window;
  const proto = Object.getPrototypeOf(input);
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    || Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;
  // composed: true låter händelsen passera ut ur shadow rooten, så att
  // custom elementet ovanför hör om ändringen.
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  input.classList.add(HIGHLIGHT_CLASS);
}

// Synonymer för kön, så att "male" även träffar "Man", "M", "Herr" etc.
const GENDER_SYNONYMS = {
  male: ['male', 'man', 'm', 'manne', 'herr', 'hombre', 'erkek', 'adam', 'masculin', 'männlich', 'homme'],
  female: ['female', 'woman', 'w', 'f', 'kvinna', 'kvin', 'dam', 'fr', 'femme', 'mujer', 'kadın', 'weiblich', 'dame'],
  other: ['other', 'annan', 'annet', 'otro', 'otra', 'diger', 'digers', 'autre', 'anders', 'altro', 'başka'],
  company: ['company', 'foretag', 'företag', 'firma', 'empresa', 'societe', 'gesellschaft'],
};

/**
 * Länder med alias på flera språk. Många sajter listar länder på sitt eget
 * språk, så vi matchar mot alla vanliga varianter.
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

/** Returnerar landsuppgifterna för en ISO-kod, med engelskt namn som reserv. */
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
 * Sätter ett <select>-värde. Returnerar true om något valdes.
 *
 * allowClosest används för numeriska listor (år/månad/dag). Då väljer vi det
 * närmast liggande alternativet om det exakta värdet saknas. Utan det förlorar
 * vi tyst fältet på sajter som bara erbjuder ett begränsat årtalsintervall.
 */
function setSelectValue(select, value, options = {}) {
  const { allowClosest = false, synonyms = null, strict = false } = options;
  const opts = [...select.options];
  if (!opts.length) return false;

  const target = normalizeOptionText(value);
  if (!target) return false;

  let match = null;

  // 1) Exakt träff på value eller synlig text.
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

  // 3) Delsträng (t.ex. "Mar" in i "March"). Hoppas över i strict-läge, där
  //    delsträngar ger falska träffar ("SE" i "Senegal", "NO" i "Korea North").
  if (!match && !strict) {
    match = opts.find((o) => {
      const t = normalizeOptionText(o.text);
      return t.length > 2 && (t.includes(target) || target.includes(t));
    });
  }

  // 4) Numerisk träff, tolerant mot "07" vs "7".
  if (!match && /^\d+$/.test(target)) {
    const n = Number(target);
    match = opts.find((o) => normalizeOptionText(o.value) !== '' && Number(normalizeOptionText(o.value)) === n);
  }

  // 5) Årtal utanför listans intervall -> närmast liggande.
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

  // 6) Månad/dag som saknas helt -> närmaste numeriska alternativ.
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

  // Endast textliknande fält kan fyllas i. Utan det här skyddet kan en kryssruta
  // eller knapp kapsa en fält-slot: t.ex. matchar "Marknadsföring" mönstret /ad/
  // och blir då "förnamn". Det gjorde att riktiga namn-fält aldrig fylldes.
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
    // type=email är entydigt och måste bedömas först. Tidigare låg e-postkontrollen
    // under användarnamnet och var dessutom låst med !result.username, vilket
    // gjorde att e-postfältet aldrig fylldes på formulär där användarnamn
    // står först (t.ex. testsidan, och många riktiga sajter).
    if (type === 'email') {
      // En andra e-postadress är nästan alltid bekräftelsefältet.
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
    // "adress", vilket ledde till att kryssrutor kapsade namn-fälten.
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

    // Dag/månad/år. De tre kontrollerna är oberoende `if` (inte else-if) så att
    // ett element som matchar "månad" inte hindrar ett annat från att matcha
    // "dag". Övriga fält är fortfarande en else-if-kedja ovanför.
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

    // Kandidater till ett enda "hela datumet"-fält avgörs efter loopen, så att
    // vi inte sätter birthDate till ett av dag/månad/år-fälten.
    if ((type === 'date' || tag === 'select' || type === 'text') &&
        /(födelsedag|fodelsedag|födelsedatum|birthdate|birthday|birth|born|född|födelse|dob|nacimiento|geburtsdatum)/.test(combined)) {
      birthCandidates.push({ el, combined });
    }

    if (/(gender|sex|kön|köns|cinsiyet|geschlecht|genre)/.test(combined)) {
      if (!result.gender && (tag === 'select' || type === 'text' || type === 'radio')) result.gender = el;
    }

    // En <select> vars etikett eller vars alternativ innehåller länder är en
    // landskontroll. Anpassade listboxar (knappar) hanteras i setCountry().
    if (!result.country && tag === 'select') {
      const optionsText = [...el.options].map((o) => o.textContent).join(' ').toLowerCase();
      const looksLikeCountry = COUNTRY_WORDS.test(combined) || COUNTRIES.some((c) =>
        c.names.some((n) => optionsText.includes(n))
      );
      if (looksLikeCountry) result.country = el;
    }
  });

  // Använd ett enda datum-fält bara om vi INTE hittade separata dag/månad/år-fält.
  if (!result.birthYear && !result.birthMonth && !result.birthDay && birthCandidates.length) {
    result.birthDate = birthCandidates[0].el;
  }

  return result;
}

function findLabelText(input) {
  if (input.id) {
    // Sök i samma shadow root först — ett id är bara unikt inom sitt träd.
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
 * Söker igenom hela dokumentet INKLUDERAT alla shadow roots.
 *
 * Många moderna sajter bygger formulären som custom elements
 * (<w-textfield>, <w-button> med en <input> inuti en shadow root). Vanlig
 * document.querySelectorAll ser ingenting där — på login.vend.se hittade vi 0
 * fält trots att e-postfältet var tydligt synligt. Därför går vi igenom
 * shadow roots också.
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
    // Hoppa över dolda knappar. Många sajter har både ett synligt och ett
    // gomt inloggnings-/registreringsformulär, och utan den här kontrollen
    // kan vi klicka på den gömda knappen och ingenting händer.
    if (el.disabled) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    return true;
  });
}

/** Alla tänkbara klickbara element, även vanliga länkar. */
const CONTROL_SELECTOR = 'button, a, [role="button"]';

/**
 * Klickar knappen vars text matchar något av mönstren. Returnerar texten eller null.
 * `exclude` kan innehålla redan klickade texter, så vi inte fastnar i en knapp
 * vars klick inte gav något resultat.
 *
 * Knappar i en dialog/modell prioriteras: på sajter med en hero-knapp i sidhuvudet
 * och en modal på lagt steg i DOM:en är det modalens knapp som är nästa steg.
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

// Leverantörer av social inloggning. Vi klickar ALDRIG dessa — användaren har
// inga sådana konton, och att göra det skulle skapa ett konto hen inte kan öppna.
const SOCIAL_PROVIDERS = [
  'google', 'apple', 'microsoft', 'facebook', 'twitter', 'x.com', 'linkedin',
  'github', 'gitlab', 'sso', 'single sign', 'saml', 'okta', 'auth0',
];

// Knappar som leder vidare mot ett e-postformulär. Listan är medvetigt snäv —
// vi ska aldrig klicka generiska marknadsförlåtanden som "Try for free", eftersom
// de kan leda till en helt annan sida än registreringen.
const SIGNUP_ADVANCE = [
  'sign up', 'signup', 'register', 'create account',
  'continue with email', 'sign up with email', 'use email',
  'get started', 'börja', 'registrera', 'skapa konto',
  'fortsätt med e-post', 'anmelden',
];

/**
 * Cookie-/samtyckesbanners ligger ofta överst i sidan och blockerar knapparna
 * under sig. Vi gör oss av med dem först: "acceptera" om det finns, annars
 * "avvisa icke-väsentliga", vilket stänger de flesta banners.
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
 * Kryssar i kryssrutor som måste vara ikryssade för att formuläret ska gå att
 * skicka: Terms, sekretess, åldersbekräftelse — och sådant som sajten själv
 * markerar som required. Det är samma sak en människa gör med musen; allt
 * arbete efteråt (t.ex. proof-of-work) gör sidan själv i sin egen kod.
 */
function checkConsentCheckboxes() {
  const termsWords = /(terms|privacy|policy|agree|accept|consent|i.?m at least|age|18|villkor|godkänn|samtycker|accepter|zustimmung|accepter|şartlar|onay|شروط|موافقة|inte en robot)/i;
  const out = [];

  for (const box of deepQueryAll('input[type="checkbox"], input[type="radio"]')) {
    if (box.disabled || box.offsetParent === null || box.checked) continue;
    const label = (
      box.closest?.('label')?.innerText || box.getAttribute('aria-label') || box.id || ''
    ).trim();

    // Krävs fältet uttryckligen, eller handlar det om villkor/samtycke?
    const needed = box.required === true || termsWords.test(label);
    if (!needed) continue;

    box.click();
    out.push({
      label: label.replace(/\s+/g, ' ').slice(0, 60) || box.id || 'checkbox',
      required: box.required === true,
    });
  }
  return out;
}

/**
 * Finns det någon landkontroll på sidan? Används för att skilja på "landet gick
 * inte att sätta" (verkligt fel) och "sidan frågar inte efter land" (inget fel).
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

/** Finns ett synligt e-post- eller lösenordsfält på sidan just nu? */
function hasSignupFields() {
  const f = findInputs();
  return !!(f.email || f.password);
}

/**
 * Normaliserar landtext: gemener, bort diacriter och extra mellanslag. Så att
 * "Sverige", "sverige" och " SVERIGE " jämförs lika.
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
 * Matchar landets namn/kod mot en textsnutt — med ORDGRÄNS.
 *
 * Det här är avgörande för korrektheten. En ren delsträngsmatchning gör att
 * koden "NO" träffar "Korea North" och "SE" träffar "Senegal", varefter
 * tillägget rapporterar ett landval det aldrig gjorde. Två- och
 * trebokstavsformer måste därför matcha som hela ord, aldrig som delsträng.
 */
function matchesCountryAlias(text, aliases) {
  const t = normalizeCountryText(text);
  if (!t) return false;
  return (aliases || []).some((raw) => {
    const a = normalizeCountryText(raw);
    if (!a) return false;
    if (t === a) return true;
    // Ordgräns: "no" får inte matcha "north", bara "no" eller "norge (no)".
    return new RegExp(`(^| )${escapeRegExp(a)}($| )`).test(t);
  });
}

/**
 * Klickar på ett element som en användare skulle. Många sajter bygger sina
 * listboxer på pointer-events och reagerar inte alls på en enkel .click() —
 * Radix/Headless UI kräver hela kedjan pointerdown → mouseup → click.
 */
function userClick(el) {
  // composed: true — annars stannar händelserna inne i shadow rooten och
  // custom elementet (t.ex. <w-button>) reagerar inte alls.
  const opts = { bubbles: true, cancelable: true, composed: true, view: window, pointerId: 1, isPrimary: true };
  try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch {}
  try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch {}
  try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch {}
  try { el.click(); } catch {}
}

/**
 * Sajter använder ofta en egen listbox i stället för <select>: en knapp som
 * öppnar en <ul role="listbox"> med <li role="option">. Vi öppnar knappen och
 * klickar önskat alternativ.
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

  // Ordgränsad matchning — aldrig delsträng på korta landkoder.
  const target = options.find((o) => matchesCountryAlias(textOf(o), optionAliases));

  if (!target) return false;
  userClick(target);
  await new Promise((r) => setTimeout(r, 400));

  // Bekräfta att valet faktiskt fastnade. Vi kräver två saker: att knappens
  // text har ändrats från platshållaren ("välj land") OCH att den nu innehåller
  // det valda landet med ordgräns. Annars låtsas vi att det gick bra.
  const after = visibleControls('button, [role="combobox"]');
  const changed = after.some((el) => {
    const now = normalizeCountryText(textOf(el));
    if (!now || now === before) return false;
    return matchesCountryAlias(now, optionAliases);
  });
  return changed;
}

/**
 * Väljer land — antingen i en vanlig <select> eller i en anpassad listbox.
 * Returnerar vilken väg som användes, så popupen kan visa det.
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
    // strict: slår av delsträngsmatchning så "SE" inte kan träffa "Senegal".
    if (setSelectValue(sel, country.code, { synonyms: country.names, strict: true })) {
      sel.classList.add(HIGHLIGHT_CLASS);
      return { via: 'select', country: country.names[0] };
    }
  }

  // 2) Anpassad listbox: knapp vars text nämner land. Ordgränsade nyckelord,
  // så att en knapp med t.ex. texten "Korea North" inte ses som landväljare.
  const viaButton = await chooseFromCustomListbox(
    /\b(välj land|select country|choose country|select your country|choose your country|country|land)\b/i,
    [country.code, ...country.names]
  );
  if (viaButton) return { via: 'listbox', country: country.names[0] };

  return null;
}

/**
 * Klickar sig fram till registreringsformuläret på sajter som kräver ett par
 * extra steg (t.ex. "Sign up" -> "Continue with Email"). Processen är begränsad
 * till några klick och vi rör aldrig social inloggning.
 *
 * Varje knapptext klickas högst en gång: annars fastnar vi på "Sign up" i sidhuvudet
 * som ligger kvar bakom modalen, i stället för att gå vidare till nästa steg.
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
    // Låt sidan reagera innan vi letar efter nästa knapp.
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

  // Synliga submit-knappar i prioritetsordning: type=submit, eller den första
  // knappen i den synliga formulärkortet.
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

  // Antalet fält som uttryckligen bara tar emot ett tecken. Det är det
  // starkaste signalen för en "en siffra per ruta"-layout, och den väger tyngre
  // än bredden — bredden är CSS-beroende och har i praktiken pendlat mellan
  // ~40 px och ~180 px för samma slags rutlayout.
  const oneCharInputs = all.filter(
    (el) => parseInt(el.getAttribute('maxlength') || '99', 10) === 1
  );
  const manyOneCharBoxes = oneCharInputs.length >= 4;

  // 1) Flera små rutor — varje input tar emot 1 tecken
  let digitBoxes = all.filter((el) => {
    const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
    const type = (el.type || 'text').toLowerCase();
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const isTypable = type === 'tel' || type === 'text' || type === 'number' || el.inputMode === 'numeric';
    if (!isTypable) return false;
    if (ml === 1) return true;
    // Utan maxlength får vi gissa på bredden i stället.
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

  // 2) Enskilt fält — autocomplete one-time-code, eller namngivet med code/otp/pin
  const single = all.find((el) => {
    const combined = `${el.name} ${el.id} ${el.placeholder} ${el.autocomplete} ${el.className} ${findLabelText(el)}`.toLowerCase();
    const type = (el.type || '').toLowerCase();
    const ml = parseInt(el.getAttribute('maxlength') || '99', 10);
    const hasOtpAttr = el.autocomplete === 'one-time-code' || el.getAttribute('data-otp') !== null || el.getAttribute('data-verify') !== null;
    // En ruta i en "en siffra per ruta"-layout ska ALDRig tolkas som ett
    // enda fält för hela koden — annars hamnar alla siffror i ruta ett och
    // verifieringen misslyckas. (Det hände på Vend-liknande sidor.)
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

  // 3) Fallback: fält med inputmode=numeric eller autocomplete=one-time-code
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
  if (!otp) return { success: false, error: 'Ogiltig kod' };

  const found = findOtpInputs();
  if (!found) return { success: false, error: 'Hittade inget kodfält på sidan' };

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
    // Fokusera första tomma rutan, eller sista om alla är ifyllda
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
  if (autoSubmit) {
    const btn = findVerifyButton();
    if (btn) {
      setTimeout(() => btn.click(), 800);
      submitted = true;
    }
  }

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

  // Fält vi hittade men inte kunde fylla. Användaren behöver veta detta,
  // annars ser en ofullständig ifylld form ut som om allt gick bra.
  const missing = [];
  const report = {};

  if (fields.email) {
    setInputValue(fields.email, profile.email);
    filled.email = true;
  }
  // Bekräftelsefält för e-post ska ha exakt samma adress.
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
        // Ett enda datum-fält som är en <select> innehåller sällan hela ISO-datumet.
        // Prova datumet, sedan delarna, sedan bara året innan vi ger upp.
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

  // Synliga fält som vi inte känner igen alls. Vi räknar bara text-liknande
  // kontroller — kryssrutor, sökfält och submitknappar räknas inte, annars
  // skulle popupen varna om sådant på varje sajt.
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
      // Tomma eller redan ifyllda fält behöver inget.
      return !el.value;
    }).length;
  if (unknownCount > 0) missing.push(`otherFields(${unknownCount})`);

  // Finns det något alls att fylla i? Utan e-post- eller lösenordsfält har vi
  // inte fyllt i något, och det ska vi inte påstå. Det händer på sajter där
  // formuläret först visas efter att man klickat igenom en triss.
  const noForm = !fields.email && !fields.password && !fields.username;
  if (noForm) {
    return {
      filled, submitted: false, mode, missing, noForm: true,
      checkboxes: checkConsentCheckboxes(),
    };
  }

  // Kryssrutor som måste vara ikryssade innan formuläret går att skicka.
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
        // Här FINNS en landkontroll men vi kunde inte sätta den. Det är ett
        // verkligt fel. Om sidan saknar landkontroll helt (t.ex. Vend, som bara
        // frågar efter e-post) säger vi ingenting — "country missing" vore då
        // en lögn.
        missing.push('country');
      }
    }
  }

  let submitted = false;
  if (autoSubmit) {
    const btn = findSubmitButton(mode);
    if (btn) {
      setTimeout(() => btn.click(), 800);
      submitted = true;
    }
  }

  return { filled, submitted, mode, missing, noForm: false, report, checkboxes };
}

/**
 * Förbereder sidan inför en registrering: stänger cookie-banners, klickar oss
 * fram till formuläret och kryssar sedan i Terms. Terms-kryssrutan kontrolleras
 * sist eftersom den vanligtvis ligger i en modal som öppnas under trichten.
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
 * Läser av en kod som redan syns på sidan. Används av den lokala testsidan,
 * som visar koden på skärmen i stället för att mejla den. Vi läser koden
 * på samma sätt en människa gör: från OTP-fälten, eller från den synliga texten.
 */
function readVisibleCode() {
  const found = findOtpInputs();
  if (found?.inputs?.length) {
    const digits = found.inputs
      .map((el) => String(el.value || '').replace(/\D/g, ''))
      .join('');
    if (digits.length >= 4) return { code: digits, from: 'inputs' };
  }

  // Fallback: ett fristående 4-8-siffrigt tal i den synliga texten, gärna
  // i närheten av orden "kod" / "code".
  const text = document.body?.innerText || '';
  const labelled = text.match(
    /(?:code|kod|pin|otp|verification|verifiering|bekräftelse)[:\s#-]{0,4}(\d{4,8})/i
  );
  if (labelled) return { code: labelled[1], from: 'text' };

  return { code: null };
}

/**
 * Läser ut vad en verifieringssida faktiskt svarar. Används efter att
 * tillägget öppnat en verifieringslänk, så att vi bara markerar kontot
 * som verifierat när sidan faktiskt bekräftar det (och inte vid t.ex.
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
      reason: 'Verifieringssidan säger: "' + (m ? m[0] : 'ogiltig') + '".',
    };
  }

  // Sidan kan också bekräfta via URL:en (t.ex. /email-verification?status=success)
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
    // Vi svarar även med hur många ifyllbara fält som syns just nu, så att
    // anroparen kan vänta in att formuläret faktiskt renderats. Under en
    // omladdning svarar content scriptet en stund innan sidan är klar.
    const visibleFillable = deepQueryAll('input, select, textarea')
      .filter((el) => el.offsetParent !== null && !el.disabled).length;
    sendResponse({ pong: true, hasForm: hasSignupFields(), fields: visibleFillable });
    return;
  }
  if (request.action === 'fillRegistration') {
    // Asynkront eftersom landvalet kan öppna en listbox. Utan "return true"
    // skulle Chrome stänga kanalen innan svaret skickas.
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
    // Asynkront: klicktrichten väntar mellan stegen. Utan "return true" skulle
    // Chrome stänga kanalen innan svaret skickas och popupen fick inget.
    prepareForRegistration()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true;
  }
});
