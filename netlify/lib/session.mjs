/**
 * Signed-cookie helpers shared by the Netlify functions (Node 22) and the edge gate (Deno).
 * Web Crypto only, no dependencies. Cookie value = base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 */
export const SESSION_COOKIE = 'bg_sr_session';
export const OIDC_COOKIE = 'bg_sr_oidc';
export const SESSION_TTL = 8 * 60 * 60; // seconds
const enc = new TextEncoder();

export function b64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ''; for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function sign(payload, secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET missing or shorter than 32 chars');
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(mac)}`;
}
/** Returns the payload if the MAC is valid and exp (seconds) is in the future, else null. */
export async function verify(token, secret, now = Math.floor(Date.now() / 1000)) {
  try {
    if (!token || !secret || secret.length < 32) return null;
    const [body, mac, extra] = String(token).split('.');
    if (!body || !mac || extra !== undefined) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlDecode(mac), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof p.exp !== 'number' || p.exp <= now) return null;
    return p;
  } catch { return null; }
}
export function getCookie(req, name) {
  const h = req.headers.get('cookie') || '';
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
export function cookieHeader(name, value, maxAge, path = '/') {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
/** Verified session ({name,email,oid,exp}) from the request cookie, or null. */
export async function sessionFrom(req, secret) {
  const p = await verify(getCookie(req, SESSION_COOKIE), secret);
  return p && p.email && p.oid ? p : null;
}
/** Only same-site relative paths are allowed as post-login destinations. */
export function safeReturn(v) {
  const s = String(v || '');
  return /^\/(?![\/\\])[A-Za-z0-9\-._~\/?=&%]*$/.test(s) ? s : '/signature-request';
}
