import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, body, ROUTES } from '../netlify/functions/signature-request.mjs';

const photo = () => new File([new Uint8Array(10)], 'me.png', { type: 'image/png' });
function fd(o) { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); f.append('headshot', photo()); return f; }

test('workplace routes to the Admin Assistant inbox with first/last name and two phones', () => {
  const r = validate(fd({ company: 'baileys-workplace', certify: 'yes', first_name: 'Jane', last_name: "O'Sample", title: 'AM',
    email: 'jane@baileysallied.com', g_phone1_label: 'mobile', g_phone1: '801-555-0100', g_phone2_label: 'office', g_phone2: '801-555-0199' }));
  assert.deepEqual(r.errs, []);
  assert.equal(r.route.to, 'baileys-signature-requests@agentmail.to');
  assert.equal(r.f.name, "Jane O'Sample");
  const t = body(r.route, r.f, 'me.png', { name: 'Jane', email: 'jane@baileysallied.com' });
  assert.match(t, /WORKPLACE/); assert.match(t, /Phone 2: office: 801-555-0199/);
  assert.match(t, /workplace-headshots\/Jane_OSample\.png/); assert.match(t, /baileysallied\.com\/workplace/);
});
test('workplace requires first and last name', () => {
  const r = validate(fd({ company: 'baileys-workplace', certify: 'yes', title: 'AM', email: 'j@x.com', g_phone1: '8015550100' }));
  assert.ok(r.errs.some((e) => /first and last/.test(e)));
});
test('browser-only brands are not server routes', () => {
  assert.equal(ROUTES['baileys-moving'], undefined); assert.equal(ROUTES['legacy-transportation'], undefined);
});
