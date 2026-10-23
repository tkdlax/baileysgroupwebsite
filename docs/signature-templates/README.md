# Signature templates (in-browser generator)

Bailey's Moving & Storage and Legacy Transportation Systems signatures need no headshot, so `/signature-request`
builds them in the browser (`public/signature-generator.js`) — nothing is sent to the function or an inbox.
Bailey's Group and Bailey's Logistics still submit to AgentMail as before.

These HTML files are the reference copies. **If you change one, change `BRANDS`/`build()` in `public/signature-generator.js` to match.**

| Placeholder | Fill with |
|---|---|
| `{{name}}`, `{{title}}` | As typed (HTML-escaped) |
| `{{email}}` | Signed-in Microsoft account (SSO) |
| `{{phone1_label}}`, `{{phone2_label}}` | Lowercase type: office, direct, mobile, cell, fax |
| `{{phone1}}`, `{{phone2}}` | Display form, e.g. `(801) 555-0100` |
| `{{phone1_tel}}`, `{{phone2_tel}}` | Digits only, no country code: `8015550100` (template adds `+1`). A leading `1` on an 11-digit number is dropped |

Phone 2 is optional; leave its whole line out when empty.

Assets: Moving images live on `media.baileysallied.com/signatures/` (R2 `bms-media`); Legacy images on
`media.baileysgroup.com/signatures/legacy/` (R2 `baileysgroup-media`).

Note: "Legacy" here is Legacy Transportation Systems (legacytrans.com), not the old Legacy Logistics (now Bailey's Logistics).

## Workplace (headshot, built by the Admin Assistant)

`workplace.html` is the Bailey's Moving & Storage: Workplace signature. It needs a headshot, so the form emails the request to
`baileys-signature-requests@agentmail.to` (subject contains "Workplace") instead of generating it in the browser.

| Placeholder | Fill with |
|---|---|
| `{{first_name}}`, `{{last_name}}`, `{{title}}`, `{{email}}` | From the request |
| `{{phone1_label}}`/`{{phone1}}`/`{{phone1_tel}}`, `{{phone2_*}}` | As above; drop the whole phone 2 row if empty |
| `{{website}}` | `https://www.baileysallied.com/workplace` (baileysworkplace.com does not resolve as of 2026-10-23) |
| `{{linkedin}}` | Their profile URL; drop the LinkedIn icon cell if none |
| `{{headshot_url}}` | `https://media.baileysallied.com/workplace-headshots/FirstName_LastName.png` (R2 `bms-media`, key `workplace-headshots/FirstName_LastName.png`, `image/png`, 230x230 round-crop source shown at 115x115) |

Header, globe and LinkedIn images: `https://media.baileysallied.com/signatures/workplace/{header,globe,linkedin}.png`.
