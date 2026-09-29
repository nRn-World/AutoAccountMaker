# Privacy Policy for AutoAccountMaker Form Filler

**Last updated: 2026-09-29**

## The short version

Nothing you type leaves your browser. There is no server, no account, no
analytics, and nothing is sold or shared.

## What the extension stores

Everything stays in your browser's local storage, on your own device.

| What | Why | Where |
|---|---|---|
| Your details (name, e mail, password, address, and so on) | So it can be typed into forms when you ask | `chrome.storage.local`, on your device |
| The interface language | So the extension can reopen in your language | `chrome.storage.local` |
| A timestamp per fill, three per hour | The rate limit | `chrome.storage.local` and `chrome.storage.sync` |

Your details are not encrypted at rest, because they are only read back by the
extension in order to type them into a page you are looking at. Anyone with
access to your browser profile, or to an unlocked operating system account, can
read them the same way they can read anything else in that profile.

## What the extension does not do

- It does not create e mail addresses, and it has no e mail provider.
- It does not generate a name, an address, a date of birth or a password.
- It does not send any of your details over the network. The extension contains
  no networking code at all, which you can verify by searching the packaged
  files for `fetch` and finding nothing.
- It does not submit forms, tick checkboxes, or click away consent banners on
  your behalf.
- It does not read the contents of pages except the fields it is asked to fill
  on the page you have open.

## Permissions, and why each one is needed

| Permission | Why |
|---|---|
| `activeTab` | To work on the tab you are looking at when you open the popup |
| `scripting` | To type into the form fields on that page |
| `storage` | To remember your details and your language locally |

## Permissions the package does not ask for

- No `tabs` permission is requested. The extension does not inspect your browsing history or other open tabs.
- No `host_permissions` are requested. The extension does not intercept web traffic and makes zero network requests.
- `unlimitedStorage` is not requested. All data fits well within normal browser storage limits.


## Children

The extension does not collect any personal data from anyone, including
children under 13.

## Changes

If this policy changes, the updated version will be published with the
extension, and the date at the top will change.

## Contact

Questions about this policy: **bynrnworld@gmail.com**
