/**
 * Microsoft Entra ID (single tenant) OIDC helpers: PKCE, authorize URL, id_token validation (RS256 via JWKS).
 * Env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, optional ALLOWED_EMAIL_DOMAINS (comma-separated).
 */
import { b64url, b64urlDecode } from './session.mjs';
const enc = new TextEncoder();

export const authority = (tid) => `https://login.microsoftonline.com/${tid}`;
export const issuerFor = (tid) => `${authority(tid)}/v2.0`;
export const jwksUrlFor = (tid) => `${authority(tid)}/discovery/v2.0/keys`;

export function randomToken(n = 32) { return b64url(crypto.getRandomValues(new Uint8Array(n))); }
export async function pkceChallenge(verifier) { return b64url(await crypto.subtle.digest('SHA-256', enc.encode(verifier))); }

export function authorizeUrl({ tenantId, clientId, redirectUri, state, nonce, challenge }) {
  const u = new URL(`${authority(tenantId)}/oauth2/v2.0/authorize`);
  u.search = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query',
    scope: 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  return u.toString();
}

let jwksCache = { url: '', at: 0, keys: [] };
async function getJwks(url, fetchImpl, force = false) {
  if (!force && jwksCache.url === url && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetchImpl(url);
  if (!r.ok) throw new Error(`JWKS fetch ${r.status}`);
  const { keys } = await r.json();
  jwksCache = { url, at: Date.now(), keys: keys || [] };
  return jwksCache.keys;
}
export function _resetJwksCache() { jwksCache = { url: '', at: 0, keys: [] }; }

/**
 * Validates an Entra id_token. Throws on any failure; returns the claims on success.
 * Checks: RS256 signature against the tenant JWKS, iss, aud, tid === tenantId, nonce, exp/nbf (5 min skew),
 * and (optional) the email's domain against allowedDomains.
 */
export async function validateIdToken(idToken, { tenantId, clientId, nonce, allowedDomains = [], fetchImpl = fetch, jwksUrl, now = Math.floor(Date.now() / 1000) }) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  if (header.alg !== 'RS256') throw new Error('unexpected alg');
  const url = jwksUrl || jwksUrlFor(tenantId);
  let jwk = (await getJwks(url, fetchImpl)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await getJwks(url, fetchImpl, true)).find((k) => k.kid === header.kid); // key rollover
  if (!jwk) throw new Error('unknown signing key');
  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('bad signature');
  if (claims.iss !== issuerFor(tenantId)) throw new Error('bad issuer');
  if (claims.aud !== clientId) throw new Error('bad audience');
  if (claims.tid !== tenantId) throw new Error('wrong tenant');
  if (!nonce || claims.nonce !== nonce) throw new Error('bad nonce');
  const skew = 300;
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new Error('expired');
  if (typeof claims.nbf === 'number' && claims.nbf - skew > now) throw new Error('not yet valid');
  if (!claims.oid) throw new Error('missing oid');
  const email = String(claims.email || claims.preferred_username || '').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('missing email');
  if (allowedDomains.length && !allowedDomains.includes(email.split('@')[1])) throw new Error('email domain not allowed');
  return { ...claims, email };
}
export const parseDomains = (v) => String(v || '').split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
