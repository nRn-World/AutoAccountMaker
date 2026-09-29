# AutoAccountMaker Form Filler

Fills in web forms from the details you saved in Settings. You tick the boxes
the site asks for, and you press submit.

## What it does

- Types your saved name, e mail, password, username, address, country, date of
  birth and gender into whatever form fields it finds on the page
- Handles modern sites that build their forms from custom elements and shadow
  DOM
- Handles both a normal country dropdown and the custom listbox that libraries
  like Radix build
- Fills one time code boxes, for a code you copied yourself
- Marks every field it filled in green, so you can see what it did before you
  submit
- Tells you which fields it could not fill, and which checkboxes still need
  your attention

## What it will not do

This is the short list, and it is deliberate:

- It **never presses a form's own submit button**
- It **never ticks** a terms, privacy or consent checkbox for you
- It **never clicks away** cookie or consent banners
- It **never creates e mail addresses**, and has no e mail provider
- It **never invents** a name, an address, a date of birth or a password
- It **sends nothing over the network**. There is no server, and the packaged
  code contains no `fetch` at all

Accepting a legal agreement, and pressing submit on a website, are things a
person does. So they are things this extension leaves to you.

## Install

**Chrome, Edge, Brave, Opera:** install from the Chrome Web Store, or unpack
`autoaccountmaker-form-filler-chrome-1.12.0.zip` in
`chrome://extensions` with developer mode on.

**Firefox:** install from addons.mozilla.org, or use
`about:debugging` → This Firefox → Load Temporary Add-on and pick
`manifest.json` from the unpacked zip.

## Getting started

1. Open the extension's Settings and fill in the details you want typed.
2. Open the page with the form.
3. Click the extension icon and press **Fill the form**.
4. Review what it filled, tick anything the site requires, press submit.

## Rate limit

Three automatic fills per hour, per browser. This is generous for a person
using it by hand, and it keeps the extension from hammering any single site.

## Known limits

- Every site is different. An unusual layout may be filled only partly, and the
  popup lists what it could not fill.
- CAPTCHAs and proof of work are not solved. Nothing here bypasses them.
- A site that sends a one time code by e mail needs you to paste the code in
  yourself.
- Your details are stored unencrypted in your browser profile, because they are
  only read back in order to type them into a page you are looking at. Anyone
  with access to your profile can read them.

## Permissions, and why

| Permission | Why |
|---|---|
| `activeTab` | To work on the tab you are looking at |
| `scripting` | To type into the form fields on that page |
| `storage` | To remember your details and your language |
| `tabs` | To know which tab you are on |
| `http://*/*`, `https://*/*` | To read and fill form fields on the site you are on |

The host permissions are broad because a form filler has to work on any site
you use it on. It only ever acts on the tab you are currently looking at, and
only when you press one of its two buttons.

## Privacy

Everything stays in your browser. Read the full policy in
[PRIVACY.md](store-manual/PRIVACY.md).

## Languages

English, Swedish, Turkish, Arabic, Spanish, German, French. Pick one in
Settings.

## Relationship to the account creation tool

The nRn World repository also contains a much more capable piece of software
that creates accounts using a temporary e mail address and an invented
identity. **That is a different program**, it is not part of these store
releases, and it is not what the store descriptions describe.

## Licence

See [LICENCE.md](store-manual/LICENCE.md).
