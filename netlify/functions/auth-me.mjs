/** GET /api/auth/me — returns {name,email} of the signed-in user (for prefilling the form), 401 otherwise. */
import { sessionFrom } from '../lib/session.mjs';
export const config = { path: '/api/auth/me' };
export default async (req) => {
  const s = await sessionFrom(req, process.env.SESSION_SECRET);
  return new Response(JSON.stringify(s ? { name: s.name, email: s.email } : { error: 'Not signed in.' }), { status: s ? 200 : 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
};
