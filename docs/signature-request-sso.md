# Signature request form: Microsoft Entra ID sign-in

`/signature-request` is gated by Office 365 (Entra ID) single sign-on, single tenant only.

Flow: edge gate (`netlify/edge-functions/signature-request-gate.js`) → no valid session cookie → `/api/auth/login`
(auth code + PKCE, scope `openid profile email`) → Microsoft → `/api/auth/callback` (code exchange with client secret,
id_token checked: RS256 via tenant JWKS, `iss`, `aud`, `tid == AZURE_TENANT_ID`, `nonce`, `exp`, optional email domain)
→ HttpOnly/Secure/SameSite=Lax cookie `bg_sr_session` (HMAC-SHA256 with SESSION_SECRET, 8 h, holds name/email/oid).
`/api/signature-request` re-verifies the cookie (401 without it), forces the email to the signed-in one and adds
`Submitted by (verified): <name> <email>` to the inbox email. `/api/auth/me` feeds the prefill; `/api/auth/logout` clears it.

## Env vars (Netlify site "baileysgroup", Functions + Edge Functions scope)
| Var | Notes |
|---|---|
| AZURE_TENANT_ID | Directory (tenant) ID GUID |
| AZURE_CLIENT_ID | Application (client) ID GUID |
| AZURE_CLIENT_SECRET | Client secret **Value** (mark secret) |
| SESSION_SECRET | Random, 32+ chars, e.g. `openssl rand -base64 48` (mark secret) |
| ALLOWED_EMAIL_DOMAINS | Optional, comma-separated, e.g. `baileysgroup.com,baileysallied.com,baileyslogistics.com` |

## Entra app registration
1. Entra admin center → Identity → Applications → App registrations → New registration.
2. Name: `Bailey's Group Signature Request Form`. Supported account types: **Accounts in this organizational directory only (Single tenant)**.
3. Redirect URI: platform **Web**, `https://www.baileysgroup.com/api/auth/callback`. Register.
4. Authentication: Front-channel logout URL `https://www.baileysgroup.com/api/auth/logout`. Leave implicit grant (access/ID tokens) **unchecked**.
5. Certificates & secrets → New client secret (e.g. 24 months) → copy the **Value** right away into AZURE_CLIENT_SECRET. Calendar the expiry.
6. API permissions: Microsoft Graph delegated `openid`, `profile`, `email` (User.Read is added by default and can stay). These don't need admin consent; if the tenant blocks user consent, click "Grant admin consent for <tenant>" once.
7. Overview: copy Directory (tenant) ID and Application (client) ID.

Redirect URIs are built from the request origin. Entra doesn't allow wildcards, so `deploy-preview-*` URLs can't all be
registered. To test a specific preview, add its exact URL, e.g. `https://deploy-preview-9--baileysgroup.netlify.app/api/auth/callback`,
and remove it afterwards. Add `https://baileysgroup.com/api/auth/callback` too only if the apex ever serves the page without redirecting to www.
