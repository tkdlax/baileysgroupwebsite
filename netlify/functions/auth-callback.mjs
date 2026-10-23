/** GET /api/auth/callback — exchanges the code (client secret + PKCE), validates the id_token, sets the session cookie. */
import { sign, verify, getCookie, cookieHeader, OIDC_COOKIE, SESSION_COOKIE, SESSION_TTL } from '../lib/session.mjs';
import { authority, validateIdToken, parseDomains } from '../lib/oidc.mjs';
export const config = { path: '/api/auth/callback' };

const fail = (msg, status = 401) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Sign-in failed</title><p style="font:16px system-ui;max-width:560px;margin:60px auto">${msg} <a href="/api/auth/login?return=/signature-request">Try again</a>.</p>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': cookieHeader(OIDC_COOKIE, '', 0, '/api/auth') } });

export default async (req, _ctx, { fetchImpl = fetch } = {}) => {
  const { AZURE_TENANT_ID: tenantId, AZURE_CLIENT_ID: clientId, AZURE_CLIENT_SECRET: clientSecret, SESSION_SECRET: secret } = process.env;
  if (!tenantId || !clientId || !clientSecret || !secret) { console.error('auth-callback: auth env vars missing'); return fail('Sign-in is not configured yet.', 500); }
  const url = new URL(req.url);
  if (url.searchParams.get('error')) { console.error('auth-callback: Entra error', url.searchParams.get('error')); return fail('Microsoft sign-in was cancelled or refused.'); }
  const tx = await verify(getCookie(req, OIDC_COOKIE), secret);
  const code = url.searchParams.get('code');
  if (!tx || !code || url.searchParams.get('state') !== tx.state) return fail('Your sign-in session expired.');
  let tokens;
  try {
    const r = await fetchImpl(`${authority(tenantId)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code,
      redirect_uri: `${url.origin}/api/auth/callback`, code_verifier: tx.verifier, scope: 'openid profile email',
    }) });
    tokens = await r.json();
    if (!r.ok || !tokens.id_token) { console.error('auth-callback: token endpoint', r.status, tokens?.error); return fail('Microsoft sign-in could not be completed.'); }
  } catch (e) { console.error('auth-callback: token fetch failed', e?.message); return fail('Microsoft sign-in could not be completed.', 502); }
  let c;
  try { c = await validateIdToken(tokens.id_token, { tenantId, clientId, nonce: tx.nonce, allowedDomains: parseDomains(process.env.ALLOWED_EMAIL_DOMAINS), fetchImpl }); }
  catch (e) { console.error('auth-callback: id_token rejected:', e.message); return fail('This form is only for Bailey\'s Group employees signed in with a company Microsoft account.', 403); }
  const session = await sign({ name: String(c.name || '').slice(0, 100), email: c.email, oid: c.oid, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }, secret);
  const h = new Headers({ location: tx.ret, 'cache-control': 'no-store' });
  h.append('set-cookie', cookieHeader(SESSION_COOKIE, session, SESSION_TTL));
  h.append('set-cookie', cookieHeader(OIDC_COOKIE, '', 0, '/api/auth'));
  return new Response(null, { status: 302, headers: h });
};
