/**
 * POST /api/signature-request — email-signature request form (src/pages/signature-request.astro).
 * Validates input, rejects honeypot hits, verifies Turnstile (fails closed if the secret is missing),
 * then emails the routed AgentMail inbox with the headshot attached and a fixed plain-text field block.
 *
 * Requires a verified Entra ID session cookie (401 otherwise); the signed-in email is the requester identity.
 * Env: SESSION_SECRET (required), AGENTMAIL_API_KEY (required), TURNSTILE_SECRET_KEY (required),
 *      AGENTMAIL_SENDER_INBOX (optional; inbox id/address to send from — defaults to the destination inbox),
 *      SIGNATURE_DRY_RUN=1 (optional; validate and log the payload shape, send nothing).
 */
import { sessionFrom } from '../lib/session.mjs';
export const config = { path: '/api/signature-request' };

export const ROUTES = {
  'baileys-group': { label: "Bailey's Group", to: 'baileys-signature-requests@agentmail.to' },
  'baileys-logistics': { label: "Bailey's Logistics", to: 'logistics-signature-requests@agentmail.to' },
};
export const PRODUCTS = ['FTL','LTL','Ocean','Air','International','Transportation','Crating','3PL','Warehousing','Storage','Distribution','Fulfillment','E-Commerce','Parcel','Delivery','Final Mile','Cross Docking','Installation','White Glove','Consultations'];
const PHONE_TYPES = ['Mobile', 'Office', 'Direct'];
const MAX_PHOTO = 4 * 1024 * 1024; // base64 + body must stay under AgentMail's/Netlify's 6 MB request cap
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clean = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);

export function validate(fd) {
  const company = clean(fd.get('company'), 40);
  const route = ROUTES[company];
  const f = {
    name: clean(fd.get('name'), 100), title: clean(fd.get('title'), 120), email: clean(fd.get('email'), 160).toLowerCase(),
    phone: clean(fd.get('phone'), 40), linkedin: clean(fd.get('linkedin'), 200),
    phone_type: clean(fd.get('phone_type'), 20), phone2: clean(fd.get('phone2'), 60),
    products: fd.getAll('products').map((p) => clean(p, 40)).filter((p) => PRODUCTS.includes(p)),
    card_address: String(fd.get('card_address') ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, 400),
  };
  const errs = [];
  if (fd.get('certify') !== 'yes') errs.push('Please confirm you are an employee and this request is for you.');
  if (!route) errs.push('Please choose your company.');
  if (!f.name) errs.push('Please enter your name.');
  if (!f.title) errs.push('Please enter your title.');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email)) errs.push('Please enter a valid email address.');
  if ((f.phone.match(/\d/g) || []).length < 7) errs.push('Please enter a valid phone number.');
  if (f.linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/\S+$/i.test(f.linkedin)) errs.push('LinkedIn URL should look like https://www.linkedin.com/in/your-name');
  if (f.phone_type && !PHONE_TYPES.includes(f.phone_type)) f.phone_type = '';
  if (company !== 'baileys-logistics') { f.phone_type = ''; f.phone2 = ''; f.products = []; f.card_address = ''; }
  const photo = fd.get('headshot');
  if (!photo || typeof photo === 'string' || !photo.size) errs.push('Please attach a headshot photo.');
  else if (!['image/jpeg', 'image/png'].includes(photo.type)) errs.push('Headshot must be a JPG or PNG.');
  else if (photo.size > MAX_PHOTO) errs.push('That photo is too large. Please choose one under 4 MB.');
  return { errs, company, route, f, photo };
}

export function body(route, f, photoName, who) {
  const L = [
    'SIGNATURE REQUEST',
    `Submitted by (verified): ${clean(who?.name, 100)} <${clean(who?.email, 160)}>`,
    `Company: ${route.label}`,
    `Name: ${f.name}`,
    `Title: ${f.title}`,
    `Email: ${f.email}`,
    `Phone: ${f.phone}`,
    `Phone type: ${f.phone_type || '-'}`,
    `Second phone: ${f.phone2 || '-'}`,
    `LinkedIn: ${f.linkedin || '-'}`,
    `Products: ${f.products.length ? f.products.join(', ') : '-'}`,
    `Card shipping address: ${f.card_address ? f.card_address.replace(/\n+/g, ' / ') : '-'}`,
    `Headshot: ${photoName}`,
    `Submitted: ${new Date().toISOString()}`,
  ];
  return L.join('\n') + '\n';
}

async function turnstileOk(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) { console.error('signature-request: TURNSTILE_SECRET_KEY missing, rejecting'); return false; }
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret, response: String(token), ...(ip ? { remoteip: ip } : {}) }),
  });
  return r.ok && (await r.json()).success === true;
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const who = await sessionFrom(req, process.env.SESSION_SECRET);
  if (!who) return json(401, { error: 'Please sign in with your company Microsoft account.', login: '/api/auth/login?return=/signature-request' });
  let fd;
  try { fd = await req.formData(); } catch { return json(400, { error: 'We couldn\'t read that submission. Please try again.' }); }
  if (clean(fd.get('website'), 200)) return json(200, { ok: true }); // honeypot: pretend success
  fd.set('email', who.email); // signed-in identity wins over whatever was typed
  const { errs, route, f, photo } = validate(fd);
  if (errs.length) return json(400, { error: errs.join(' ') });
  const dry = process.env.SIGNATURE_DRY_RUN === '1';
  if (!dry && !(await turnstileOk(fd.get('cf-turnstile-response'), context?.ip))) return json(403, { error: 'Please complete the "I am human" check and try again.' });
  const key = process.env.AGENTMAIL_API_KEY;
  if (!dry && !key) { console.error('signature-request: AGENTMAIL_API_KEY missing'); return json(500, { error: 'Something went wrong on our end. Please try again later.' }); }
  const ext = photo.type === 'image/png' ? 'png' : 'jpg';
  const photoName = `${f.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'headshot'}-headshot.${ext}`;
  const payload = {
    to: route.to, reply_to: f.email, labels: ['signature-request'],
    subject: `Signature request: ${f.name} (${route.label})`,
    text: body(route, f, photoName, who),
    attachments: [{ filename: photoName, content_type: photo.type, content_disposition: 'attachment', content: Buffer.from(await photo.arrayBuffer()).toString('base64') }],
  };
  if (dry) { console.log('signature-request DRY RUN', JSON.stringify({ ...payload, attachments: [{ ...payload.attachments[0], content: `<${payload.attachments[0].content.length} b64 chars>` }] })); return json(200, { ok: true, dryRun: true }); }
  const sender = process.env.AGENTMAIL_SENDER_INBOX || route.to;
  try {
    const r = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(sender)}/messages/send`, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!r.ok) { console.error('signature-request: AgentMail', r.status, (await r.text()).slice(0, 300)); return json(502, { error: 'We couldn\'t send your request right now. Please try again in a few minutes.' }); }
  } catch (e) { console.error('signature-request: AgentMail fetch failed', e?.message); return json(502, { error: 'We couldn\'t send your request right now. Please try again in a few minutes.' }); }
  return json(200, { ok: true });
};
