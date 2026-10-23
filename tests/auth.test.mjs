// node --test tests/  (Node 22). No real Entra credentials: uses a locally generated RSA key + JWKS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, b64url, SESSION_COOKIE, OIDC_COOKIE, safeReturn } from '../netlify/lib/session.mjs';
import { validateIdToken, _resetJwksCache, issuerFor } from '../netlify/lib/oidc.mjs';
import gate from '../netlify/edge-functions/signature-request-gate.js';
import submit from '../netlify/functions/signature-request.mjs';
import login from '../netlify/functions/auth-login.mjs';
import callback from '../netlify/functions/auth-callback.mjs';

const SECRET = 'x'.repeat(48), TID = '11111111-2222-3333-4444-555555555555', CID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
Object.assign(process.env, { SESSION_SECRET: SECRET, AZURE_TENANT_ID: TID, AZURE_CLIENT_ID: CID, AZURE_CLIENT_SECRET: 'test-only' });
const now = () => Math.floor(Date.now() / 1000);
const enc = new TextEncoder();
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
const jwks = { keys: [{ kty: 'RSA', kid: 'k1', use: 'sig', n: pub.n, e: pub.e }] };
const fetchJwks = async () => new Response(JSON.stringify(jwks));
async function jwt(claims, key = kp.privateKey, kid = 'k1') {
  const h = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })));
  const p = b64url(enc.encode(JSON.stringify(claims)));
  return `${h}.${p}.${b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${h}.${p}`)))}`;
}
const good = (o = {}) => ({ iss: issuerFor(TID), aud: CID, tid: TID, nonce: 'n1', exp: now() + 3600, nbf: now() - 10, oid: 'oid-1', name: 'Test User', preferred_username: 'Test.User@BaileysGroup.com', ...o });
const opts = (o = {}) => ({ tenantId: TID, clientId: CID, nonce: 'n1', fetchImpl: fetchJwks, ...o });

test('cookie sign/verify round trip, tamper, expiry, short secret', async () => {
  const t = await sign({ email: 'a@b.com', oid: 'o', exp: now() + 60 }, SECRET);
  assert.equal((await verify(t, SECRET)).email, 'a@b.com');
  assert.equal(await verify(t, 'y'.repeat(48)), null);
  const [b, m] = t.split('.'); assert.equal(await verify(`${b}x.${m}`, SECRET), null);
  assert.equal(await verify(await sign({ exp: now() - 1 }, SECRET), SECRET), null);
  await assert.rejects(sign({ exp: 1 }, 'short'));
  assert.equal(await verify('garbage', SECRET), null);
});

test('safeReturn blocks open redirects', () => {
  assert.equal(safeReturn('/signature-request'), '/signature-request');
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '']) assert.equal(safeReturn(bad), '/signature-request');
});

test('id_token: valid token accepted, email lowercased', async () => {
  _resetJwksCache();
  const c = await validateIdToken(await jwt(good()), opts());
  assert.equal(c.email, 'test.user@baileysgroup.com');
});
for (const [name, claims, o, key] of [
  ['wrong tenant tid', { tid: '99999999-0000-0000-0000-000000000000' }],
  ['wrong issuer', { iss: 'https://login.microsoftonline.com/common/v2.0' }],
  ['wrong audience', { aud: 'someone-else' }],
  ['wrong nonce', { nonce: 'n2' }],
  ['expired', { exp: now() - 3600 }],
  ['missing oid', { oid: undefined }],
  ['domain not allowed', {}, { allowedDomains: ['baileyslogistics.com'] }],
  ['bad signature (other key)', {}, {}, 'other'],
]) {
  test(`id_token rejected: ${name}`, async () => {
    _resetJwksCache();
    await assert.rejects(validateIdToken(await jwt(good(claims), key === 'other' ? other.privateKey : kp.privateKey), opts(o)));
  });
}
test('id_token: allowed domain passes; unknown kid rejected', async () => {
  _resetJwksCache();
  await validateIdToken(await jwt(good()), opts({ allowedDomains: ['baileysgroup.com'] }));
  await assert.rejects(validateIdToken(await jwt(good(), kp.privateKey, 'nope'), opts()));
});

const sessionCookie = async () => `${SESSION_COOKIE}=${encodeURIComponent(await sign({ name: 'Test User', email: 'test.user@baileysgroup.com', oid: 'o', exp: now() + 60 }, SECRET))}`;
test('edge gate: redirects without cookie, passes with valid cookie', async () => {
  const ctx = { next: async () => new Response('page') };
  const r = await gate(new Request('https://www.baileysgroup.com/signature-request'), ctx);
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), 'https://www.baileysgroup.com/api/auth/login?return=/signature-request');
  const bad = await gate(new Request('https://www.baileysgroup.com/signature-request', { headers: { cookie: `${SESSION_COOKIE}=forged.sig` } }), ctx);
  assert.equal(bad.status, 302);
  const ok = await gate(new Request('https://www.baileysgroup.com/signature-request', { headers: { cookie: await sessionCookie() } }), ctx);
  assert.equal(ok.status, 200); assert.equal(await ok.text(), 'page');
});

test('submit API: 401 without session, reaches validation with session', async () => {
  const r = await submit(new Request('https://www.baileysgroup.com/api/signature-request', { method: 'POST', body: new FormData() }), {});
  assert.equal(r.status, 401);
  const r2 = await submit(new Request('https://www.baileysgroup.com/api/signature-request', { method: 'POST', body: new FormData(), headers: { cookie: await sessionCookie() } }), {});
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).error, /confirm you are an employee/);
});

test('submit API (dry run): typed email (alias) used, signed-in identity kept on its own line', async () => {
  process.env.SIGNATURE_DRY_RUN = '1';
  const logs = []; const orig = console.log; console.log = (...a) => logs.push(a.join(' '));
  const fd = new FormData();
  Object.entries({ company: 'baileys-group', name: 'Test User', title: 'Tester', email: 'jake.alias@baileysgroup.com', phone: '801-555-0100', certify: 'yes' }).forEach(([k, v]) => fd.set(k, v));
  fd.set('headshot', new File([new Uint8Array(100)], 'h.jpg', { type: 'image/jpeg' }));
  const r = await submit(new Request('https://www.baileysgroup.com/api/signature-request', { method: 'POST', body: fd, headers: { cookie: await sessionCookie() } }), {});
  console.log = orig; delete process.env.SIGNATURE_DRY_RUN;
  assert.equal(r.status, 200);
  const out = logs.join('\n');
  assert.match(out, /Submitted by \(signed in\): Test User <test.user@baileysgroup.com>/);
  assert.match(out, /Email: jake.alias@baileysgroup.com/);
  assert.match(out, /Website: https:\/\/www.baileysgroup.com/);
});

test('login → callback full flow with mocked Entra token endpoint', async () => {
  const lr = await login(new Request('https://www.baileysgroup.com/api/auth/login?return=/signature-request'));
  assert.equal(lr.status, 302);
  const loc = new URL(lr.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, `https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize`);
  assert.equal(loc.searchParams.get('scope'), 'openid profile email');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://www.baileysgroup.com/api/auth/callback');
  const setc = lr.headers.get('set-cookie'); assert.match(setc, /HttpOnly; Secure; SameSite=Lax/);
  const txCookie = setc.split(';')[0];
  const state = loc.searchParams.get('state'), nonce = loc.searchParams.get('nonce');
  let tokenBody;
  const fetchImpl = async (u, init) => {
    if (String(u).endsWith('/oauth2/v2.0/token')) { tokenBody = init.body; return new Response(JSON.stringify({ id_token: await jwt(good({ nonce })) })); }
    return fetchJwks();
  };
  _resetJwksCache();
  const bad = await callback(new Request(`https://www.baileysgroup.com/api/auth/callback?code=c&state=wrong`, { headers: { cookie: txCookie } }), {}, { fetchImpl });
  assert.equal(bad.status, 401);
  const cr = await callback(new Request(`https://www.baileysgroup.com/api/auth/callback?code=c&state=${state}`, { headers: { cookie: txCookie } }), {}, { fetchImpl });
  assert.equal(cr.status, 302); assert.equal(cr.headers.get('location'), '/signature-request');
  assert.ok(tokenBody.get('code_verifier')); assert.equal(tokenBody.get('client_secret'), 'test-only');
  const sc = cr.headers.getSetCookie().find((c) => c.startsWith(SESSION_COOKIE + '='));
  assert.match(sc, /Max-Age=28800; HttpOnly; Secure; SameSite=Lax/);
  const p = await verify(decodeURIComponent(sc.split(';')[0].split('=').slice(1).join('=')), SECRET);
  assert.deepEqual([p.name, p.email, p.oid], ['Test User', 'test.user@baileysgroup.com', 'oid-1']);
  assert.ok(cr.headers.getSetCookie().some((c) => c.startsWith(OIDC_COOKIE + '=;')));
});
