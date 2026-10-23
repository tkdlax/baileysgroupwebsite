/** GET|POST /api/auth/logout — clears the session cookie. Also the Entra front-channel logout URL. */
import { cookieHeader, SESSION_COOKIE } from '../lib/session.mjs';
export const config = { path: '/api/auth/logout' };
export default async () => new Response('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signed out</title><p style="font:16px system-ui;max-width:560px;margin:60px auto">You\'re signed out of the signature request form. <a href="/signature-request">Sign in again</a>.</p>',
  { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'set-cookie': cookieHeader(SESSION_COOKIE, '', 0) } });
