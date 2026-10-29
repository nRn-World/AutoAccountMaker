# AutoAccountMaker — butikstext (2026-10-24)

TVÅ VARIANTER, använd rätt text per butik:
- **Firefox (AMO, v1.13.1): FULL variant** (tempmail via mail.tm, fyller i, verifierar, loggar in). Texten nedan under "Firefox / full variant" ÄR redan uppladdad på AMO 2026-10-24.
- **Chrome Web Store:** kontrollera vilken build som ligger i butiken. store-manual/STORE-DESCRIPTION-EN.md beskriver en lugnare FORMULÄRFYLLARE (inga e-postadresser, trycker aldrig skicka). Beskriv bara det som bygget faktiskt gör. Chrome-text för formulärfyllaren finns längst ned.

Gratisgräns: AMO-texten säger 1 automatisk registrering per 3 timmar (README samma). store-manual säger 3 fyllningar/timme för formulärfyllaren.

---

# Firefox / full variant (UPPLADDAD PÅ AMO)

**Titel (max 50):** AutoAccountMaker – Auto Sign-Up & Verify
**Kategori:** Privacy & Security / Other
**Sökord att väva in naturligt:** temporary email, sign up, autofill, registration, verification code, test accounts, form filler, temp mail

## English
**Summary (≤250):**
```
Test sign-up flows in one click: temporary e-mail, auto-filled form, verification code entered, logged in. Free, 7 languages.
```
**Description:**
```
Test any sign-up flow in one click. AutoAccountMaker creates a temporary e-mail address, fills in the registration form, enters the verification code and logs you in, so you can try a site without using your real information.

Open a page with a sign-up form, open the AutoAccountMaker sidebar with the toolbar button and press "Register automatically". Everything else happens on its own:
1. Creates a temporary e-mail address and a password
2. Fills in the form with generated details
3. Ticks the checkboxes the form requires
4. Submits the form
5. Waits for the verification e-mail
6. Enters the code or opens the link
7. Logs you in

WHAT IT IS FOR
- Testing your own website or app and its sign-up flow
- Trying out a service without using your personal e-mail address
- Checking how a registration and verification flow behaves

FEATURES
- Temporary e-mail, form autofill, verification code and login in one click
- Works with ordinary fields, custom dropdowns, hand-built listboxes and code boxes
- Shadow DOM support, so it reaches fields built as web components
- Reads the verification code from the e-mail, in one field or in six small boxes
- Account vault stored locally in your browser
- Export to CSV, PDF or an encrypted backup
- Seven languages: English, Swedish, Turkish, Arabic, Spanish, German and French
- Built-in test page that walks through the whole flow
- Works on Firefox for desktop and Android

FREE AND PRO
The free version allows one automated sign-up every three hours. An optional Pro license removes the wait. The free version shows a clearly labelled sponsored link that you can hide. Pro removes it.

GOOD TO KNOW
- The temporary mailbox comes from the mail.tm service, so the extension contacts mail.tm to receive verification e-mails. Nothing is sent to the developer.
- Some websites block temporary e-mail addresses and will refuse them.
- Every website is different. Sites with unusual flows or strong bot protection may refuse the registration or fill only part of the form.
- CAPTCHAs are not solved, and sites that require an SMS code will not work.
- Only use the extension on websites you own or are allowed to test, and follow each site's terms.

Support: bynrnworld@gmail.com
```

## Svenska
**Sammanfattning (≤250):**
```
Testa registreringsflöden med ett klick: tillfällig e-post, ifyllt formulär, verifieringskod inskriven, inloggad. Gratis, 7 språk.
```
**Beskrivning:**
```
Testa vilket registreringsflöde som helst med ett klick. AutoAccountMaker skapar en tillfällig e-postadress, fyller i registreringsformuläret, skriver in verifieringskoden och loggar in dig, så du kan prova en sajt utan att använda dina riktiga uppgifter.

Öppna en sida med ett registreringsformulär, öppna sidopanelen med verktygsfältsknappen och tryck "Register automatically". Resten sker av sig självt:
1. Skapar en tillfällig e-postadress och ett lösenord
2. Fyller i formuläret med genererade uppgifter
3. Bockar i de kryssrutor formuläret kräver
4. Skickar in formuläret
5. Väntar på verifieringsmejlet
6. Skriver in koden eller öppnar länken
7. Loggar in dig

DET ÄR BRA FÖR
- Att testa din egen webbplats eller app och dess registreringsflöde
- Att prova en tjänst utan att använda din personliga e-post
- Att kontrollera hur ett registrerings- och verifieringsflöde beter sig

FUNKTIONER
- Tillfällig e-post, ifyllt formulär, verifieringskod och inloggning med ett klick
- Fungerar med vanliga fält, egna rullgardiner, handbyggda listrutor och kodrutor
- Stöd för Shadow DOM, så fält byggda som webbkomponenter nås
- Läser verifieringskoden ur mejlet, i ett fält eller i sex små rutor
- Kontoválv som sparas lokalt i webbläsaren
- Export till CSV, PDF eller krypterad säkerhetskopia
- Sju språk: engelska, svenska, turkiska, arabiska, spanska, tyska och franska
- Inbyggd testsida som går igenom hela flödet
- Fungerar i Firefox på dator och Android

GRATIS OCH PRO
Gratisversionen tillåter en automatisk registrering var tredje timme. En valfri Pro-licens tar bort väntetiden. Gratisversionen visar en tydligt märkt sponsrad länk som du kan dölja. Pro tar bort den.

BRA ATT VETA
- Den tillfälliga brevlådan kommer från tjänsten mail.tm, så tillägget kontaktar mail.tm för att ta emot verifieringsmejl. Inget skickas till utvecklaren.
- Vissa webbplatser blockerar tillfälliga e-postadresser och nekar dem.
- Varje webbplats är olika. Sajter med ovanliga flöden eller starkt botskydd kan neka registreringen eller bara fyllas i delvis.
- CAPTCHA löses inte, och sajter som kräver SMS-kod fungerar inte.
- Använd bara tillägget på webbplatser du äger eller får testa, och följ varje sajts villkor.

Support: bynrnworld@gmail.com
```

---

# Chrome / formulärfyllar-variant (OM store-bygget är den)
Baserad på store-manual/STORE-DESCRIPTION-EN.md.

**Titel (max 75):** AutoAccountMaker – One-Click Form Filler

**Short description (≤132):**
```
Fill sign-up and login forms in one click from your saved details. Nothing leaves your browser. Free to use.
```
**Kort beskrivning (≤132):**
```
Fyll i registrerings- och inloggningsformulär med ett klick från dina sparade uppgifter. Inget lämnar webbläsaren.
```

**Detailed description (EN):**
```
Stop retyping the same details on every sign-up page. Save your info once, click once, and AutoAccountMaker fills the form.

HOW IT WORKS
1. Open Settings and save your details
2. Open the page with the form
3. Click the icon and press "Fill the form"
4. Review, tick what the site requires, and submit

WHAT IT FILLS
Name, e-mail, password, username, address, city, postal code, country, date of birth and gender. It also fills one-time code boxes from a code you copied yourself.
- Works on modern sites that use custom elements and shadow DOM
- Handles normal country dropdowns and custom listboxes
- Marks every filled field in green and lists what it could not fill
- Reminds you of any checkbox the site still wants ticked

YOU STAY IN CONTROL
- It never presses the site's submit button
- It never ticks terms, privacy or consent boxes for you
- It never clicks cookie banners
- It never invents names, addresses or passwords
- No server, no account, no tracking: nothing is sent over the network

Available in English, Svenska, Türkçe, العربية, Español, Deutsch and Français.

Support: bynrnworld@gmail.com
```

**Detaljerad beskrivning (SV):**
```
Sluta skriva samma uppgifter på varje registreringssida. Spara dina uppgifter en gång, klicka en gång, så fyller AutoAccountMaker i formuläret.

SÅ FUNGERAR DET
1. Öppna inställningar och spara dina uppgifter
2. Öppna sidan med formuläret
3. Klicka på ikonen och tryck "Fyll i formuläret"
4. Kontrollera, bocka i det sajten kräver och skicka in

DET HÄR FYLLS I
Namn, e-post, lösenord, användarnamn, adress, ort, postnummer, land, födelsedatum och kön. Fyller även i rutor för engångskod från en kod du kopierat själv.
- Fungerar på moderna sajter med egna element och shadow DOM
- Hanterar vanliga landlistor och egna listrutor
- Markerar varje ifyllt fält grönt och listar det som inte gick att fylla
- Påminner om kryssrutor som sajten ändå vill ha ibockade

DU HAR KONTROLLEN
- Trycker aldrig på sajtens skicka-knapp
- Bockar aldrig i villkor, integritet eller samtycke åt dig
- Klickar aldrig bort cookie-banners
- Hittar aldrig på namn, adresser eller lösenord
- Ingen server, inget konto, ingen spårning: inget skickas över nätverket

Finns på svenska, engelska, turkiska, arabiska, spanska, tyska och franska.

Support: bynrnworld@gmail.com
```
