/**
 * i18n.js for the store build.
 *
 * This file contains only the strings the store build actually shows. The
 * private extension's dictionary has several hundred entries about creating
 * accounts, fetching verification mail, license keys and Pro, none of which
 * exist here. Leaving them in would be dead weight and would also describe a
 * product this extension is not, so the file starts clean.
 *
 * The helpers at the bottom are the same API the private build uses:
 *   t(key, a, b)        look up a string, substituting {0} and {1}
 *   applyTranslations() translate every data-i18n element in the page
 *   setLanguage(lang)   switch and apply
 *   initI18n()          read the saved language and apply
 */
const SUPPORTED_LANGUAGES = ['en', 'sv', 'tr', 'ar', 'es', 'de', 'fr'];
const DEFAULT_LANGUAGE = 'en';
const RTL_LANGUAGES = ['ar'];

const LANGUAGE_NAMES = {
  en: 'English',
  sv: 'Svenska',
  tr: 'Türkçe',
  ar: 'العربية',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
};

const DICT = {
  en: {
    app: { name: 'AutoAccountMaker Form Filler' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Settings',
      fillForm: 'Fill the form',
      fillLogin: 'Fill a login',
      ready: 'Open a page with a form, then press one of the buttons above.',
      nothingSaved: 'No details saved yet.',
      nothingSavedHint: 'Open Settings and fill in the details you want typed into forms, then come back here.',
      noTab: 'No page is open.',
      notAWebPage: 'This only works on a normal web page.',
      filling: 'Filling the form from your saved details',
      fillingLogin: 'Filling the login form',
      noForm: 'No form with fillable fields was found on this page.',
      noFormHint: 'Try a page that has a sign up or login form, then press the button again.',
      nothingFilled: 'None of the fields on this page matched your saved details.',
      filledCount: (n) => `Filled ${n} field(s).`,
      filledList: (f) => `Filled: ${f}`,
      missingList: (f) => `Not filled, no saved value: ${f}`,
      stillToTick: (b) => `Still to tick yourself: ${b}`,
      yourTurn: 'Review the form, then submit it yourself',
      submitYourself: 'Nothing was submitted and no checkbox was ticked. That part is yours.',
      cooldownBlocked: (t) => `Rate limit: wait ${t} before filling again.`,
      disclaimer: 'Fills in the details you saved in Settings. You tick any checkboxes and press submit yourself.',
      footerStore: 'Free and open source. Nothing you type leaves your browser.',
    },

    options: {
      title: 'Settings',
      subtitle: 'Your details, and the interface language.',
      sectionLanguage: 'Language',
      languageLabel: 'Interface language',
      languageHint: 'All texts in the extension change when you pick a language.',
      save: 'Save',
      saved: 'Saved',
    },

    details: {
      title: 'Your details',
      hint: 'These stay in this browser. Nothing is sent anywhere, and the extension never invents a value for a field you leave empty.',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'E mail',
      username: 'Username',
      password: 'Password',
      phone: 'Phone',
      address: 'Street address',
      city: 'City',
      zip: 'Postal code',
      country: 'Country',
      birthDate: 'Date of birth',
      gender: 'Gender',
      company: 'Company',
      jobTitle: 'Job title',
      problems: 'Known limits',
      problem1: 'Every site is different, so an unusual layout may be filled only partly. The popup lists the fields it could not fill.',
      problem2: 'CAPTCHAs and proof of work are not solved. Nothing here bypasses them.',
      problem3: 'Sites that require a one time code by e mail need you to paste the code in yourself.',
      problem4: 'Filled fields are marked in green so you can see what was typed before you submit.',
      filledCount: (n, total) => `${n} of ${total} fields filled.`,
    },

    limits: {
      title: 'What it will not do',
      noSubmit: "It never presses a form's own submit button.",
      noConsent: 'It never ticks a terms, privacy or consent checkbox for you.',
      noBanners: 'It never clicks away cookie or consent banners.',
      noAccounts: 'It never creates e mail addresses or invents a name, address or date of birth.',
      noNetwork: 'It sends nothing over the network. There is no server.',
    },
  },

  sv: {
    app: { name: 'AutoAccountMaker Formulärfyllare' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Inställningar',
      fillForm: 'Fyll i formuläret',
      fillLogin: 'Fyll i en inloggning',
      ready: 'Öppna en sida med ett formulär och tryck någon av knapparna ovan.',
      nothingSaved: 'Inga uppgifter sparade ännu.',
      nothingSavedHint: 'Öppna inställningarna och fyll i de uppgifter du vill ska skrivas in i formulär, och kom tillbaka hit.',
      noTab: 'Ingen sida är öppen.',
      notAWebPage: 'Det fungerar bara på vanliga webbsidor.',
      filling: 'Fyller i formuläret från dina sparade uppgifter',
      fillingLogin: 'Fyller i inloggningsformuläret',
      noForm: 'Hittade inget formulär med ifyllbara fält på den här sidan.',
      noFormHint: 'Prova en sida med ett registrerings- eller inloggningsformulär och tryck igen.',
      nothingFilled: 'Inget fält på sidan matchade dina sparade uppgifter.',
      filledCount: (n) => `Fyllde ${n} fält.`,
      filledList: (f) => `Fyllde: ${f}`,
      missingList: (f) => `Inte ifyllt, inget sparat värde: ${f}`,
      stillToTick: (b) => `Kvar att kryssa i själv: ${b}`,
      yourTurn: 'Granska formuläret och skicka det själv',
      submitYourself: 'Inget skickades och ingen kryssruta markerades. Det är din del.',
      cooldownBlocked: (t) => `Begränsning: vänta ${t} innan du fyller i igen.`,
      disclaimer: 'Fyller i de uppgifter du sparade i inställningarna. Du kryssar i rutorna och skickar själv.',
      footerStore: 'Gratis och öppen källkod. Inget du skriver lämnar webbläsaren.',
    },

    options: {
      title: 'Inställningar',
      subtitle: 'Dina uppgifter och språk för gränssnittet.',
      sectionLanguage: 'Språk',
      languageLabel: 'Språk för gränssnittet',
      languageHint: 'Alla texter i tillägget byter språk när du väljer ett språk.',
      save: 'Spara',
      saved: 'Sparat',
    },

    details: {
      title: 'Dina uppgifter',
      hint: 'Dessa stannar i den här webbläsaren. Ingenting skickas någonstans, och tillägget hittar aldrig på ett värde för ett fält du lämnar tomt.',
      firstName: 'Förnamn',
      lastName: 'Efternamn',
      email: 'E-post',
      username: 'Användarnamn',
      password: 'Lösenord',
      phone: 'Telefon',
      address: 'Gatuadress',
      city: 'Ort',
      zip: 'Postnummer',
      country: 'Land',
      birthDate: 'Födelsedatum',
      gender: 'Kön',
      company: 'Företag',
      jobTitle: 'Jobbtitel',
      problems: 'Kända begränsningar',
      problem1: 'Varje sajt är olika, så en ovanlig layout kan fyllas bara delvis. Popupen listar fälten som inte gick att fylla.',
      problem2: 'CAPTCHAs och proof of work löses inte. Ingenting här kringgår dem.',
      problem3: 'Sajter som kräver en engångskod per e-post kräver att du klistrar in koden själv.',
      problem4: 'Ifyllda fält markeras gröna så att du ser vad som skrevs innan du skickar.',
      filledCount: (n, total) => `${n} av ${total} fält ifyllda.`,
    },

    limits: {
      title: 'Det här gör det inte',
      noSubmit: 'Det trycker aldrig på formulärets egen skicka knapp.',
      noConsent: 'Det kryssar aldrig i villkors-, sekretess- eller samtyckesrutor åt dig.',
      noBanners: 'Det klickar aldrig bort cookie- eller samtyckesbannrar.',
      noAccounts: 'Det skapar aldrig e-postadresser och hittar aldrig på namn, adress eller födelsedatum.',
      noNetwork: 'Det skickar ingenting över nätet. Det finns ingen server.',
    },
  },

  tr: {
    app: { name: 'AutoAccountMaker Form Doldurucu' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Ayarlar',
      fillForm: 'Formu doldur',
      fillLogin: 'Oturum formunu doldur',
      ready: 'Form içeren bir sayfa açın, sonra yukarıdaki düğmelerden birine basın.',
      nothingSaved: 'Henüz hiçbir bilgi kaydedilmedi.',
      nothingSavedHint: 'Ayarları açın ve formlara yazılmasını istediğiniz bilgileri doldurun, sonra buraya dönün.',
      noTab: 'Açık sayfa yok.',
      notAWebPage: 'Bu yalnızca normal web sayfalarında çalışır.',
      filling: 'Kayıtlı bilgilerinizle formu dolduruluyor',
      fillingLogin: 'Oturum formu dolduruluyor',
      noForm: 'Bu sayfada doldurulabilir alan içeren bir form bulunamadı.',
      noFormHint: 'Kayıt ya da oturum formu olan bir sayfa deneyin ve tekrar basın.',
      nothingFilled: 'Sayfadaki hiçbir alan kayıtlı bilgilerinizle eşleşmedi.',
      filledCount: (n) => `${n} alan dolduruldu.`,
      filledList: (f) => `Doldurulan: ${f}`,
      missingList: (f) => `Doldurulmadı, kayıtlı değer yok: ${f}`,
      stillToTick: (b) => `Siz doldurmanız gerekenler: ${b}`,
      yourTurn: 'Formu kontrol edin, sonra kendiniz gönderin',
      submitYourself: 'Hiçbir şey gönderilmedi ve hiçbir kutu işaretlenmedi. Bu kısım size kaldı.',
      cooldownBlocked: (t) => `Sınır: tekrar doldurmadan önce ${t} bekleyin.`,
      disclaimer: 'Ayarlarda kaydettiğiniz bilgilerle formu doldurur. Kutuları siz işaretler ve siz gönderirsiniz.',
      footerStore: 'Ücretsiz ve açık kaynak. Yazdığınız hiçbir şey tarayıcınızdan çıkmaz.',
    },

    options: {
      title: 'Ayarlar',
      subtitle: 'Bilgileriniz ve arayüz dili.',
      sectionLanguage: 'Dil',
      languageLabel: 'Arayüz dili',
      languageHint: 'Dil seçtiğinizde eklentideki tüm metinler değişir.',
      save: 'Kaydet',
      saved: 'Kaydedildi',
    },

    details: {
      title: 'Bilgileriniz',
      hint: 'Bunlar bu tarayıcıda kalır. Hiçbir yere gönderilmez ve boş bıraktığınız alan için eklenti hiçbir değer uydurmaz.',
      firstName: 'Ad',
      lastName: 'Soyad',
      email: 'E-posta',
      username: 'Kullanıcı adı',
      password: 'Parola',
      phone: 'Telefon',
      address: 'Sokak adresi',
      city: 'Şehir',
      zip: 'Posta kodu',
      country: 'Ülke',
      birthDate: 'Doğum tarihi',
      gender: 'Cinsiyet',
      company: 'Şirket',
      jobTitle: 'Görev',
      problems: 'Bilinen sınırlar',
      problem1: 'Her site farklıdır, bu yüzden alışılmadık bir düzen yalnızca kısmen doldurulabilir. Açılır pencere doldurulamayan alanları listeler.',
      problem2: 'CAPTCHA ve proof of work çözülmez. Buradaki hiçbir şey bunları atlamaz.',
      problem3: 'E-posta ile tek kullanımlık kod isteyen sitelerde kodu kendiniz yapıştırmanız gerekir.',
      problem4: 'Doldurulan alanlar yeşil işaretlenir, böylece göndermeden önce ne yazıldığını görürsünüz.',
      filledCount: (n, total) => `${total} alandan ${n} tanesi dolduruldu.`,
    },

    limits: {
      title: 'Yapmadığı şeyler',
      noSubmit: 'Formun kendi gönder düğmesine asla basmaz.',
      noConsent: 'Sizin adınıza asla koşul, gizlilik veya onay kutusu işaretlemez.',
      noBanners: 'Çerez veya onay afişlerini asla kapatmaz.',
      noAccounts: 'E-posta adresi oluşturmaz, isim, adres veya doğum tarihi uydurmaz.',
      noNetwork: 'Ağ üzerinden hiçbir şey göndermez. Sunucu yoktur.',
    },
  },

  ar: {
    app: { name: 'AutoAccountMaker لملء النماذج' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'الإعدادات',
      fillForm: 'املأ النموذج',
      fillLogin: 'املأ تسجيل الدخول',
      ready: 'افتح صفحة بها نموذج، ثم اضغط أحد الأزرار أعلاه.',
      nothingSaved: 'لم تُحفظ أي بيانات بعد.',
      nothingSavedHint: 'افتح الإعدادات وأدخل البيانات التي تريد كتابتها في النماذج، ثم عد إلى هنا.',
      noTab: 'لا توجد صفحة مفتوحة.',
      notAWebPage: 'يعمل هذا على صفحات الويب العادية فقط.',
      filling: 'جارٍ ملء النموذج من بياناتك المحفوظة',
      fillingLogin: 'جارٍ ملء نموذج تسجيل الدخول',
      noForm: 'لم يُعثر على نموذج يحتوي حقولاً قابلة للملء في هذه الصفحة.',
      noFormHint: 'جرّب صفحة بها نموذج تسجيل أو دخول واضغط الزر مرة أخرى.',
      nothingFilled: 'لم يطابق أي حقل في الصفحة بياناتك المحفوظة.',
      filledCount: (n) => `تم ملء ${n} حقل.`,
      filledList: (f) => `تم الملء: ${f}`,
      missingList: (f) => `لم يُملأ، لا توجد قيمة محفوظة: ${f}`,
      stillToTick: (b) => `ما زال عليك تحديد: ${b}`,
      yourTurn: 'راجع النموذج ثم أرسله بنفسك',
      submitYourself: 'لم يتم إرسال أي شيء ولم يتم تحديد أي مربع. هذه مسؤوليتك.',
      cooldownBlocked: (t) => `حد الاستخدام: انتظر ${t} قبل التعبئة مرة أخرى.`,
      disclaimer: 'يملأ بالبيانات التي حفظتها في الإعدادات. أنت تحدد مربعات الاختيار وتضغط إرسال بنفسك.',
      footerStore: 'مجاني ومفتوح المصدر. لا شيء تكتبه يخرج من متصفحك.',
    },

    options: {
      title: 'الإعدادات',
      subtitle: 'بياناتك ولغة الواجهة.',
      sectionLanguage: 'اللغة',
      languageLabel: 'لغة الواجهة',
      languageHint: 'تتغير كل النصوص في الإضافة عند اختيار لغة.',
      save: 'حفظ',
      saved: 'تم الحفظ',
    },

    details: {
      title: 'بياناتك',
      hint: 'تبقى في هذا المتصفح. لا يُرسل شيء إلى أي مكان، والإضافة لا تخترع قيمة أبداً لحقل تتركه فارغاً.',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      email: 'البريد الإلكتروني',
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      phone: 'الهاتف',
      address: 'عنوان الشارع',
      city: 'المدينة',
      zip: 'الرمز البريدي',
      country: 'الدولة',
      birthDate: 'تاريخ الميلاد',
      gender: 'الجنس',
      company: 'الشركة',
      jobTitle: 'المسمى الوظيفي',
      problems: 'حدود معروفة',
      problem1: 'كل موقع مختلف، لذلك قد تُملأ تخطيطات غير معتادة جزئياً فقط. تسرد النافذة الحقول التي لم يمكن ملؤها.',
      problem2: 'لا يتم حل رموز CAPTCHA أو إثبات العمل. لا شيء هنا يتجاوزها.',
      problem3: 'المواقع التي تطلب رمزاً لمرة واحدة عبر البريد تحتاج منك لصق الرمز بنفسك.',
      problem4: 'الحقول المملوءة تُعلَّم بالأخضر لترى ما كُتب قبل الإرسال.',
      filledCount: (n, total) => `تم ملء ${n} من ${total} حقل.`,
    },

    limits: {
      title: 'ما لا تفعله',
      noSubmit: 'لا تضغط أبداً على زر الإرسال الخاص بالنموذج.',
      noConsent: 'لا تحدد أبداً مربع شروط أو خصوصية أو موافقة نيابة عنك.',
      noBanners: 'لا تزيح أبداً لافتات ملفات تعريف الارتباط أو الموافقة.',
      noAccounts: 'لا تنشئ عناوين بريد إلكتروني ولا تخترع اسماً أو عنواناً أو تاريخ ميلاد.',
      noNetwork: 'لا ترسل أي شيء عبر الشبكة. لا يوجد خادم.',
    },
  },

  es: {
    app: { name: 'AutoAccountMaker Rellenador de formularios' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Ajustes',
      fillForm: 'Rellenar el formulario',
      fillLogin: 'Rellenar el acceso',
      ready: 'Abre una página con un formulario y pulsa uno de los botones de arriba.',
      nothingSaved: 'Aún no hay datos guardados.',
      nothingSavedHint: 'Abre Ajustes y rellena los datos que quieres que se escriban en los formularios, y vuelve aquí.',
      noTab: 'No hay ninguna página abierta.',
      notAWebPage: 'Esto solo funciona en páginas web normales.',
      filling: 'Rellenando el formulario con tus datos guardados',
      fillingLogin: 'Rellenando el formulario de acceso',
      noForm: 'No se encontró ningún formulario con campos rellenables en esta página.',
      noFormHint: 'Prueba una página con un formulario de registro o acceso y pulsa otra vez.',
      nothingFilled: 'Ningún campo de la página coincidió con tus datos guardados.',
      filledCount: (n) => `Se rellenaron ${n} campo(s).`,
      filledList: (f) => `Rellenados: ${f}`,
      missingList: (f) => `Sin rellenar, no hay valor guardado: ${f}`,
      stillToTick: (b) => `Todavía tienes que marcar tú: ${b}`,
      yourTurn: 'Revisa el formulario y envíalo tú mismo',
      submitYourself: 'No se envió nada y no se marcó ninguna casilla. Esa parte es tuya.',
      cooldownBlocked: (t) => `Límite de uso: espera ${t} antes de rellenar de nuevo.`,
      disclaimer: 'Rellena con los datos que guardaste en Ajustes. Tú marcas las casillas y envías.',
      footerStore: 'Gratis y de código abierto. Nada de lo que escribes sale de tu navegador.',
    },

    options: {
      title: 'Ajustes',
      subtitle: 'Tus datos y el idioma de la interfaz.',
      sectionLanguage: 'Idioma',
      languageLabel: 'Idioma de la interfaz',
      languageHint: 'Todos los textos cambian cuando eliges un idioma.',
      save: 'Guardar',
      saved: 'Guardado',
    },

    details: {
      title: 'Tus datos',
      hint: 'Se quedan en este navegador. No se envía nada a ninguna parte, y la extensión nunca inventa un valor para un campo que dejes vacío.',
      firstName: 'Nombre',
      lastName: 'Apellidos',
      email: 'Correo electrónico',
      username: 'Nombre de usuario',
      password: 'Contraseña',
      phone: 'Teléfono',
      address: 'Dirección',
      city: 'Ciudad',
      zip: 'Código postal',
      country: 'País',
      birthDate: 'Fecha de nacimiento',
      gender: 'Género',
      company: 'Empresa',
      jobTitle: 'Puesto',
      problems: 'Límites conocidos',
      problem1: 'Cada sitio es distinto, así que un diseño inusual puede quedar relleno solo en parte. La ventana lista los campos que no pudo rellenar.',
      problem2: 'No se resuelven los CAPTCHA ni la prueba de trabajo. Nada de esto los evita.',
      problem3: 'Los sitios que piden un código de un solo uso por correo necesitan que lo pegues tú.',
      problem4: 'Los campos rellenos se marcan en verde para que veas qué se escribió antes de enviar.',
      filledCount: (n, total) => `${n} de ${total} campos rellenos.`,
    },

    limits: {
      title: 'Lo que no hace',
      noSubmit: 'Nunca pulsa el botón de enviar del propio formulario.',
      noConsent: 'Nunca marca por ti una casilla de términos, privacidad o consentimiento.',
      noBanners: 'Nunca cierra los avisos de cookies o consentimiento.',
      noAccounts: 'Nunca crea direcciones de correo ni inventa un nombre, dirección o fecha de nacimiento.',
      noNetwork: 'No envía nada por la red. No hay servidor.',
    },
  },

  de: {
    app: { name: 'AutoAccountMaker Formularfüller' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Einstellungen',
      fillForm: 'Formular ausfüllen',
      fillLogin: 'Anmeldung ausfüllen',
      ready: 'Öffne eine Seite mit einem Formular und drücke einen der Knöpfe oben.',
      nothingSaved: 'Noch keine Daten gespeichert.',
      nothingSavedHint: 'Öffne die Einstellungen und trage die Daten ein, die in Formulare geschrieben werden sollen, und komm hierher zurück.',
      noTab: 'Es ist keine Seite geöffnet.',
      notAWebPage: 'Das funktioniert nur auf normalen Webseiten.',
      filling: 'Formular wird mit deinen gespeicherten Daten ausgefüllt',
      fillingLogin: 'Anmeldeformular wird ausgefüllt',
      noForm: 'Auf dieser Seite wurde kein Formular mit ausfüllbaren Feldern gefunden.',
      noFormHint: 'Versuche eine Seite mit einem Registrierungs- oder Anmeldeformular.',
      nothingFilled: 'Kein Feld auf der Seite passte zu deinen gespeicherten Daten.',
      filledCount: (n) => `${n} Feld(er) ausgefüllt.`,
      filledList: (f) => `Ausgefüllt: ${f}`,
      missingList: (f) => `Nicht ausgefüllt, kein gespeicherter Wert: ${f}`,
      stillToTick: (b) => `Musst du selbst abhaken: ${b}`,
      yourTurn: 'Prüfe das Formular und sende es selbst ab',
      submitYourself: 'Es wurde nichts abgeschickt und kein Kästchen abgehakt. Das ist dein Teil.',
      cooldownBlocked: (t) => `Limit: warte ${t}, bevor du wieder ausfüllst.`,
      disclaimer: 'Füllt die Daten aus, die du in den Einstellungen gespeichert hast. Du hakt die Kästchen ab und sendest selbst.',
      footerStore: 'Kostenlos und quelloffen. Nichts, was du eingibst, verlässt deinen Browser.',
    },

    options: {
      title: 'Einstellungen',
      subtitle: 'Deine Daten und die Sprache der Oberfläche.',
      sectionLanguage: 'Sprache',
      languageLabel: 'Sprache der Oberfläche',
      languageHint: 'Alle Texte ändern sich, wenn du eine Sprache wählst.',
      save: 'Speichern',
      saved: 'Gespeichert',
    },

    details: {
      title: 'Deine Daten',
      hint: 'Diese bleiben in diesem Browser. Nichts wird irgendwohin gesendet, und die Erfindung erfindet nie einen Wert für ein leeres Feld.',
      firstName: 'Vorname',
      lastName: 'Nachname',
      email: 'E-Mail',
      username: 'Benutzername',
      password: 'Passwort',
      phone: 'Telefon',
      address: 'Straße und Hausnummer',
      city: 'Stadt',
      zip: 'Postleitzahl',
      country: 'Land',
      birthDate: 'Geburtsdatum',
      gender: 'Geschlecht',
      company: 'Firma',
      jobTitle: 'Position',
      problems: 'Bekannte Grenzen',
      problem1: 'Jede Seite ist anders, deshalb wird ein ungewöhnliches Layout vielleicht nur teilweise ausgefüllt. Das Fenster listet die nicht ausfüllbaren Felder auf.',
      problem2: 'CAPTCHAs und Proof of Work werden nicht gelöst. Nichts hier umgeht sie.',
      problem3: 'Bei Seiten, die einen Einmalcode per E-Mail verlangen, musst du den Code selbst einfügen.',
      problem4: 'Ausgefüllte Felder werden grün markiert, damit du siehst, was geschrieben wurde, bevor du absendest.',
      filledCount: (n, total) => `${n} von ${total} Feldern ausgefüllt.`,
    },

    limits: {
      title: 'Was es nicht tut',
      noSubmit: 'Es drückt niemals den Senden-Button des Formulars selbst.',
      noConsent: 'Es hakt niemals ein Feld für Bedingungen, Datenschutz oder Einwilligung für dich ab.',
      noBanners: 'Es blendet niemals Cookie- oder Einwilligungsbanner weg.',
      noAccounts: 'Es erstellt niemals E-Mail-Adressen und erfindet nie Name, Adresse oder Geburtsdatum.',
      noNetwork: 'Es sendet nichts über das Netz. Es gibt keinen Server.',
    },
  },

  fr: {
    app: { name: 'AutoAccountMaker Remplissage de formulaires' },

    popup: {
      title: 'AutoAccountMaker',
      settings: 'Paramètres',
      fillForm: 'Remplir le formulaire',
      fillLogin: 'Remplir la connexion',
      ready: 'Ouvrez une page avec un formulaire, puis cliquez un des boutons ci-dessus.',
      nothingSaved: "Aucune information enregistrée pour l'instant.",
      nothingSavedHint: "Ouvrez les paramètres et renseignez les informations à écrire dans les formulaires, puis revenez ici.",
      noTab: "Aucune page n'est ouverte.",
      notAWebPage: 'Cela ne fonctionne que sur les pages web normales.',
      filling: 'Remplissage du formulaire avec vos données enregistrées',
      fillingLogin: 'Remplissage du formulaire de connexion',
      noForm: "Aucun formulaire avec des champs à remplir n'a été trouvé sur cette page.",
      noFormHint: "Essayez une page avec un formulaire d'inscription ou de connexion.",
      nothingFilled: 'Aucun champ de la page ne correspond à vos données enregistrées.',
      filledCount: (n) => `${n} champ(s) rempli(s).`,
      filledList: (f) => `Remplis : ${f}`,
      missingList: (f) => `Non rempli, aucune valeur enregistrée : ${f}`,
      stillToTick: (b) => `À cocher vous-même : ${b}`,
      yourTurn: 'Vérifiez le formulaire et envoyez-le vous-même',
      submitYourself: "Rien n'a été envoyé et aucune case n'a été cochée. C'est votre part.",
      cooldownBlocked: (t) => `Limite : attendez ${t} avant de remplir à nouveau.`,
      disclaimer: "Remplit avec les informations enregistrées dans les paramètres. Vous cochez les cases et vous envoyez.",
      footerStore: 'Gratuit et open source. Rien de ce que vous tapez ne quitte votre navigateur.',
    },

    options: {
      title: 'Paramètres',
      subtitle: 'Vos informations et la langue de l’interface.',
      sectionLanguage: 'Langue',
      languageLabel: "Langue de l'interface",
      languageHint: 'Tous les textes changent lorsque vous choisissez une langue.',
      save: 'Enregistrer',
      saved: 'Enregistré',
    },

    details: {
      title: 'Vos informations',
      hint: "Elles restent dans ce navigateur. Rien n'est envoyé nulle part, et l'extension n'invente jamais de valeur pour un champ laissé vide.",
      firstName: 'Prénom',
      lastName: 'Nom',
      email: 'E-mail',
      username: "Nom d'utilisateur",
      password: 'Mot de passe',
      phone: 'Téléphone',
      address: 'Adresse',
      city: 'Ville',
      zip: 'Code postal',
      country: 'Pays',
      birthDate: 'Date de naissance',
      gender: 'Genre',
      company: 'Société',
      jobTitle: 'Fonction',
      problems: 'Limites connues',
      problem1: "Chaque site est différent, une mise en page inhabituelle ne sera donc remplie qu'en partie. La fenêtre liste les champs non remplis.",
      problem2: 'Les CAPTCHA et la preuve de travail ne sont pas résolus. Rien ici ne les contourne.',
      problem3: "Les sites qui demandent un code à usage unique par e-mail nécessitent que vous le colliez vous-même.",
      problem4: "Les champs remplis sont marqués en vert pour voir ce qui a été tapé avant d'envoyer.",
      filledCount: (n, total) => `${n} champ(s) sur ${total} remplis.`,
    },

    limits: {
      title: "Ce qu'il ne fait pas",
      noSubmit: "Il ne presse jamais le bouton d'envoi du formulaire lui-même.",
      noConsent: 'Il ne coche jamais à votre place une case de conditions, de confidentialité ou de consentement.',
      noBanners: 'Il ne ferme jamais les bannières de cookies ou de consentement.',
      noAccounts: "Il ne crée jamais d'adresses e-mail et n'invente ni nom, ni adresse, ni date de naissance.",
      noNetwork: "Il n'envoie rien sur le réseau. Il n'y a pas de serveur.",
    },
  },
};

let currentLanguage = DEFAULT_LANGUAGE;

function normalizeLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

function lookup(lang, key) {
  const dict = DICT[lang] || DICT[DEFAULT_LANGUAGE];
  const parts = String(key).split('.');
  let node = dict;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = node[part];
  }
  return node == null ? null : node;
}

function interpolate(value, args) {
  let out = String(value);
  args.forEach((arg, i) => {
    out = out.split('{' + i + '}').join(arg);
  });
  return out;
}

function t(key, ...args) {
  const value = lookup(currentLanguage, key);
  if (value == null) {
    const fallback = lookup(DEFAULT_LANGUAGE, key);
    if (fallback == null) return key;
    return typeof fallback === 'function' ? fallback(...args) : interpolate(fallback, args);
  }
  return typeof value === 'function' ? value(...args) : interpolate(value, args);
}

function applyDocumentLanguage(lang, root) {
  const target = root || document;
  const el = target.documentElement || target;
  el.setAttribute('lang', lang);
  el.setAttribute('dir', RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr');
}

function applyTranslations(root, lang) {
  const target = root || document;
  const scope = target.querySelectorAll
    ? target.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]')
    : [];

  scope.forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
    const ph = el.getAttribute('data-i18n-placeholder');
    if (ph) el.setAttribute('placeholder', t(ph));
    const ti = el.getAttribute('data-i18n-title');
    if (ti) el.setAttribute('title', t(ti));
  });
}

function setLanguage(lang) {
  currentLanguage = normalizeLanguage(lang);
  applyDocumentLanguage(currentLanguage);
  applyTranslations(document, currentLanguage);
  return currentLanguage;
}

function populateLanguageSelect() {
  const sel = document.getElementById('language') || document.getElementById('languageSelect');
  if (!sel || sel.dataset.filled === '1') return;
  sel.innerHTML = '';
  for (const lang of SUPPORTED_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = LANGUAGE_NAMES[lang];
    sel.appendChild(opt);
  }
  sel.dataset.filled = '1';
  sel.value = currentLanguage;
}

async function initI18n() {
  const stored = await chrome.storage.local.get({ settings: { language: DEFAULT_LANGUAGE } });
  const lang = normalizeLanguage(stored?.settings?.language);
  currentLanguage = lang;
  applyDocumentLanguage(currentLanguage);
  populateLanguageSelect();
  applyTranslations(document, currentLanguage);
  return currentLanguage;
}

if (typeof window !== 'undefined') {
  window.DICT = DICT;
  window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
  window.RTL_LANGUAGES = RTL_LANGUAGES;
  window.LANGUAGE_NAMES = LANGUAGE_NAMES;
  window.t = t;
  window.applyTranslations = applyTranslations;
  window.applyDocumentLanguage = applyDocumentLanguage;
  window.setLanguage = setLanguage;
  window.populateLanguageSelect = populateLanguageSelect;
  window.initI18n = initI18n;
}
