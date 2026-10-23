/** GET /api/auth/login?return=/signature-request — starts the Entra ID auth-code + PKCE flow. */
import { sign, cookieHeader, safeReturn, OIDC_COOKIE } from '../lib/session.mjs';
import { authorizeUrl, randomToken, pkceChallenge } from '../lib/oidc.mjs';
export const config = { path: '/api/auth/login' };

export default async (req) => {
  const { AZURE_TENANT_ID: tenantId, AZURE_CLIENT_ID: clientId, SESSION_SECRET: secret } = process.env;
  if (!tenantId || !clientId || !secret) { console.error('auth-login: AZURE_TENANT_ID/AZURE_CLIENT_ID/SESSION_SECRET missing'); return new Response('Sign-in is not configured yet.', { status: 500 }); }
  const url = new URL(req.url);
  const state = randomToken(), nonce = randomToken(), verifier = randomToken(48);
  const redirectUri = `${url.origin}/api/auth/callback`;
  const tx = await sign({ state, nonce, verifier, ret: safeReturn(url.searchParams.get('return')), exp: Math.floor(Date.now() / 1000) + 600 }, secret);
  return new Response(null, { status: 302, headers: {
    location: authorizeUrl({ tenantId, clientId, redirectUri, state, nonce, challenge: await pkceChallenge(verifier) }),
    'set-cookie': cookieHeader(OIDC_COOKIE, tx, 600, '/api/auth'), 'cache-control': 'no-store',
  } });
};
