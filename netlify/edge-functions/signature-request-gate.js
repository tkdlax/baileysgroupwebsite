// Edge gate: /signature-request requires a valid Entra ID session cookie, else redirect to sign-in.
import { sessionFrom } from '../lib/session.mjs';
export default async (request, context) => {
  const secret = globalThis.Netlify?.env?.get('SESSION_SECRET') ?? globalThis.process?.env?.SESSION_SECRET;
  if (await sessionFrom(request, secret)) {
    const res = await context.next();
    res.headers.set('cache-control', 'private, no-store');
    return res;
  }
  const to = new URL('/api/auth/login?return=/signature-request', request.url);
  return new Response(null, { status: 302, headers: { location: to.toString(), 'cache-control': 'no-store' } });
};
export const config = { path: ['/signature-request', '/signature-request/', '/signature-request.html'] };
