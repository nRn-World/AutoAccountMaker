# AutoAccountMaker

Automatiserad registrering för Chrome. Fyller i formulär, verifierar e-post med
en temporär adress och loggar in — i ett klick.

**Gratisversion:** en automatisk registrering var tredje timme.
**Pro:** tar bort väntet.

> This project is licensed under the Business Source License 1.1. See [LICENSE](LICENSE).

---

## Innehåll

- [Vad det gör](#vad-det-gör)
- [Installation](#installation)
- [Användning](#användning)
- [Inställningar](#inställningar)
- [Språk](#språk)
- [E-postleverantörer](#e-postleverantörer)
- [Exportera konton](#exportera-konton)
- [Vad som inte fungerar](#vad-som-inte-fungerar)
- [Projektstruktur](#projektstruktur)
- [Utveckling](#utveckling)
- [Licens](#licens)

---

## Vad det gör

Besök en sida med registreringsformulär, öppna tillägget, klicka **Registrera
automatiskt**. Sedan händer allt själv:

| Steg | Vad som händer |
|------|-----------------|
| 1 | Skapar en temporär e-postadress och ett lösenord |
| 2 | Fyller i formuläret: namn, e-post, bekräftelseadress, lösenord, land, kön, födelsedatum |
| 3 | Kryssar i obligatoriska rutor, inklusive samtycke och villkor |
| 4 | Skickar formuläret |
| 5 | Väntar på verifieringsmejlet |
| 6 | Skriver in koden eller öppnar länken |
| 7 | Loggar in |

Efterått ligger kontot i valvet. Nästa gång du besöker samma sida räcker det
med **Logga in**.

### Funktioner

- **Formulärifyllning** — klarar vanliga fält, anpassade `<select>`, egenbyggda
  listboxar och kodsrutor
- **Shadow DOM** — ser fält även på sajter som bygger dem som webbkomponenter
  (till exempel `<w-textfield>`), där vanlig HTML inte når in
- **Verifiering** — läser koden ur mejlet och fyller i den, oavsett om sidan
  har ett fält eller sex små rutor
- **Sju språk** — svenska, engelska, turkiska, arabiska, spanska, tyska, franska.
  Arabiska visas höger-till-vänster
- **Kontovalv** — sparas lokalt i webbläsaren, med gränsen 10, 50 eller 199
- **Export** — CSV, PDF eller krypterad backup
- **Testsida** — en inbyggd sida som visar hela flödet utan externa tjänster

---

## Installation

Tillägget laddas direkt från mappen `free-build/`. Inget byggs, ingen npm.

1. Öppna `chrome://extensions`
2. Slå på **Utvecklarläge** (Developer mode) uppe till höger
3. Klicka **Ladda upp okomprimerat tillägg** (Load unpacked)
4. Välj mappen `free-build/`

Filen `free-build/` är en färdig Chrome MV3-tillägg. Öppna den mappen direkt.

### Firefox

Firefox stöder MV3 men `chrome.*`-namnrymden skiljer sig i vissa detaljer.
Testa alltid på den webbläsare du avser att distribuera till. Kontrollera särskilt
`manifest.json` om du paketerar om till `.xpi`.

---

## Användning

1. Öppna en sida med ett registreringsformulär
2. Klicka på tilläggets ikon
3. Klicka **Registrera automatiskt**
4. Följ förloppet i loggen

**Efter cooldownen** visas knappen som låst med tid kvar. Knappen låser upp
automatiskt när tiden gått ut, du behöver inte ladda om något.

**Har du redan ett konto?** Öppna samma sida igen och klicka **Logga in**.

**Testa först?** Klicka 🧪 i popupens ikonrad. Då öppnas en inbyggd testsida som
går igenom hela flödet med en riktig e-postadress.

---

## Inställningar

Klicka ⚙️ i popupens ikonrad. Sidan är mörk och innehåller tre delar.

**Language** — byt språk. Popupen uppdateras direkt, utan att stängas och
öppnas om.

**Account vault** — alla skapade konton, med export och radering.

- *Behåll nyaste* — 10, 50 eller 199. Det äldsta kontot raderas automatiskt när
  gränsen nås.
- **Visa sparade konton** har flyttat hit från popupen.

**Avancerat** — hopfällt. Innehåller e-postleverantör och RapidAPI-nyckel.
Lämnas den gömd behöver du inte bry dig om den.

---

## Språk

Sju språk, byt under ⚙️ → Language:

| | | | |
|---|---|---|---|
| 🇬🇧 English | 🇸🇪 Svenska | 🇹🇷 Türkçe | 🇸🇦 العربية |
| 🇪🇸 Español | 🇩🇪 Deutsch | 🇫🇷 Français | |

Ändras språket tillämpas direkt överallt, även i en popup som redan är öppen.

---

## E-postleverantörer

| Leverantör | Krav |
|---|---|
| **mail.tm** (standard) | Gratis, fungerar direkt utan API-nyckel |
| **temp-mail.org** | Kräver gratis [RapidAPI-nyckel](https://rapidapi.com/Privatix/api/temp-mail) |

Ställs in under ⚙️ → Avancerat. mail.tm används automatiskt om ingen nyckel
anges.

Observera att båda leverantörerna har egna gränser på hur snabbt konton kan
skapas. Det styrs av dem, inte av tillägget.

---

## Exportera konton

Allt ligger på samma ställe, ⚙️ → Account vault.

| Format | Innehåller | Krypterat |
|---|---|---|
| **CSV** | Webbplats, e-post, användarnamn, skapad, status | Nej |
| **PDF** | Samma uppgifter i ett snyggt dokument | Nej |
| **.enc** | Allt, inklusive lösenord och leverantörsuppgifter | Ja, med lösenord |

CSV laddas ner med ett klick. PDF öppnar Chrome's printdialog, där du väljer
**Spara som PDF**.

**Om lösenord:** CSV och PDF utelämnar lösenord som standard. Kryssa i
**Include passwords** om du vill ta med dem. Den krypterade backupen (.enc)
innehåller alltid allt, men kräver ett masterlösenord både vid export och
import.

CSV och PDF är **inte** krypterade. Filen hamnar i Dokument och kan öppnas av
någon annan. Använd `.enc` om du vill flytta konton säkert.

---

## Vad som inte fungerar

Det här är viktigt att veta innan du kör igång.

**Varje webbplats är unik.** Tillägget hittar fält med heuristiker, och en sajt
med ovanliga flöden, tungt bot-skydd eller egen inloggningslogik kan vägra
registreringen eller fylla i formuläret delvis. Det finns ingen teknik som
fungerar överallt, och ingen skillnad för det här.

**CAPTCHA:er löses inte.** Vissa sajter använder bevis-arbete (proof of work) som
en spärr mot robotar. Tillägget kryssar i rutan och låter sidan göra sitt
arbete, men bygger ingen egen lösning.

**Endast e-post.** Tillägget skapar e-postadresser, inte telefonnummer. Sajter
som kräver verifiering per sms fungerar inte.

**Beror på e-postleverantören.** Om mail.tm eller temp-mail.org rate-limitar
dig, eller ett mejl inte levereras, misslyckas körningen.

**Ingen garanti för "verifierad".** Statusen betyder att sidan accepterade
koden du fick. Om en sajt senare nekar kontot ligger det utanför tilläggets
kontroll.

Testa alltid på en sajt du faktiskt bryr dig om innan du kör flera.

---

## Projektstruktur

```
free-build/      Färdig tilläggsmapp — ladda denna i Chrome
build-free.mjs   Genererar free-build/ ur den privata källträden
free-src/        Delar som används i bygget
extension/       Privat källträd (licensering) — publiceras inte
```

`free-build/` genereras, är inte handskriven. Ändra i `extension/` och kör:

```bash
node build-free.mjs
```

Byggskriptet vägrar färdigställa om någon licenshemlighet, nyckel eller Pro-kod
finns kvar i utdata.

---

## Utveckling

Kräver Node 18 eller senare.

```bash
node build-free.mjs      # bygg gratisversionen
```

Inga beroenden behövs för själva tillägget — det är vanliga filer, inte ett
byggt bundlet paket.

### Projektstruktur i korthet

| Fil | Ansvar |
|---|---|
| `content.js` | Fältigenkänning, ifyllning, OTP. Kör i webbsidan |
| `background.js` | Profilgenerering, e-post, verifiering, inställningar |
| `popup.js` | Gränssnitt och flödessteg |
| `cooldown.js` | Gratisnivåns spärr |
| `i18n.js` | Alla sju språk |
| `options.html` / `.js` | Inställningar, språk och kontovalv |
| `vault.js` | Kontolista, export och import |

---

## Licens

Business Source License 1.1. Se [LICENSE](LICENSE).

- Får du använda, ändra och dela detta — till och med byte-datumet.
- Får du **inte** sälja det, ta betalt för det, eller köra det som en tjänst åt
  någon annan.
- Från och med **2028-09-29** övergår det till Apache License 2.0, och då får
  du göra vad du vill med det, kommersiellt inräknat.

Fungerar BUSL inte för ditt behov säg till, det går att byta till exempelvis
MIT eller Apache 2.0 direkt.
