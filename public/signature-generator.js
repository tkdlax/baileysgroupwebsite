/* In-browser signature generator for brands that need no headshot (Bailey's Moving & Storage, Legacy Transportation Systems).
 * Nothing is sent to the server: fields fill a template, the user copies it (rich HTML) or downloads an .htm.
 * Templates mirror docs/signature-templates/*.html — keep them in sync. */
(function () {
  var form = document.getElementById('sr-form');
  if (!form) return;
  var M = 'https://media.baileysallied.com/signatures', G = 'https://media.baileysgroup.com/signatures/legacy';
  var BRANDS = {
    'baileys-moving': {
      label: "Bailey's Moving & Storage", file: 'baileys-moving',
      site: 'https://www.baileysallied.com', logo: M + '/baileys-moving-logo.jpg', lw: 127, lh: 45, alt: "Bailey's Moving and Storage",
      border: '#1C5B9B 1.0pt', accent: '#f07c22',
      socials: [['https://www.facebook.com/baileysmoving', M + '/social-icons/facebook.png', 'Facebook'],
        ['https://www.linkedin.com/company/baileys-moving-and-storage', M + '/social-icons/linkedin.png', 'LinkedIn'],
        ['https://x.com/baileysmoving', M + '/social-icons/x.png', 'X'],
        ['https://www.youtube.com/user/BaileysMoving', M + '/social-icons/youtube.png', 'YouTube'],
        ['https://www.instagram.com/baileysmoving', M + '/social-icons/instagram.png', 'Instagram']]
    },
    'legacy-transportation': {
      label: 'Legacy Transportation Systems', file: 'legacy-transportation',
      site: 'https://legacytrans.com', logo: G + '/legacy-transportation-logo.png', lw: 127, lh: 47, alt: 'Legacy Transportation Systems',
      border: '#8b8e90 1.5pt', accent: '#16447b', socials: []
    }
  };
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function tel(v) { var d = String(v || '').replace(/\D/g, ''); return d.length === 11 && d[0] === '1' ? d.slice(1) : d; }
  function val(n) { var el = form.elements[n]; return el ? el.value.trim() : ''; }
  var A = 'font-size:10.0pt;font-family:Arial,sans-serif;';
  function line(b, label, href, text) {
    return '<br><span style="' + A + 'color:' + b.accent + '">' + esc(label) + '</span> <span style="' + A + 'color:#8D8D8D"><a href="' + esc(href) + '" style="color:#8D8D8D;text-decoration:none">' + esc(text) + '</a></span>';
  }
  function build(b, d) {
    var h = '<table width="470" cellpadding="0" cellspacing="0" border="0" style="width:352.5pt;background-color:#ffffff;line-height:1.3"><tr>' +
      '<td width="' + (b.lw + 10) + '" valign="top" style="width:' + (b.lw + 10) + 'px;border-right:solid ' + b.border + ';padding:0in 7.5pt 0in 0in"><a href="' + b.site + '" target="_blank"><img width="' + b.lw + '" height="' + b.lh + '" src="' + b.logo + '" alt="' + esc(b.alt) + '" style="border:0;display:block;width:' + b.lw + 'px;height:' + b.lh + 'px;max-width:none"></a></td>' +
      '<td valign="top" style="padding:0in 0in 0in 7.5pt"><b><span style="font-size:10.5pt;font-family:Arial,sans-serif;color:#646464">' + esc(d.name) + '</span></b>' +
      '<span style="font-size:10.5pt;font-family:Arial,sans-serif;color:#646464"><br>' + esc(d.title) + '</span>';
    if (d.phone1) h += line(b, d.phone1_label + ':', 'tel:+1' + tel(d.phone1), d.phone1);
    if (d.phone2) h += line(b, d.phone2_label + ':', 'tel:+1' + tel(d.phone2), d.phone2);
    if (d.email) h += line(b, 'e:', 'mailto:' + d.email, d.email);
    h += line(b, 'w:', b.site, b.site);
    if (b.socials.length) h += '<p style="margin:6px 0 0 0">' + b.socials.map(function (s) { return '<a href="' + s[0] + '" target="_blank" style="text-decoration:none"><img width="25" height="25" src="' + s[1] + '" alt="' + s[2] + '" style="border:0"></a>'; }).join(' ') + '</p>';
    return h + '</td></tr></table>';
  }
  var prev = document.getElementById('sr-preview'), msg = document.getElementById('sr-gen-msg'), cur = '';
  function data() {
    return { name: val('name') || 'Your Name', title: val('title') || 'Your Title', email: form.email && form.email.checkValidity() ? val('email') : '',
      phone1_label: val('g_phone1_label') || 'office', phone1: val('g_phone1'), phone2_label: val('g_phone2_label') || 'mobile', phone2: val('g_phone2') };
  }
  function render() {
    var b = BRANDS[form.company.value]; if (!b || !prev) return;
    cur = build(b, data()); prev.innerHTML = cur; if (msg) msg.textContent = '';
  }
  function ready() {
    var bad = ['name', 'title', 'g_phone1'].filter(function (n) { return !val(n); });
    if (bad.length) { if (msg) msg.textContent = 'Fill in your name, title and phone 1 first.'; form.elements[bad[0]].focus(); return false; }
    if (!val('email') || !form.email.checkValidity()) { if (msg) msg.textContent = 'Enter a valid email address.'; form.email.focus(); return false; }
    return true;
  }
  form.addEventListener('input', render); form.addEventListener('change', render);
  form.addEventListener('submit', function (e) { if (BRANDS[form.company.value]) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  document.getElementById('sr-copy').addEventListener('click', function () {
    if (!ready()) return; render();
    var done = function () { msg.textContent = 'Copied. Paste it into your Outlook signature.'; };
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([cur], { type: 'text/html' }), 'text/plain': new Blob([prev.innerText], { type: 'text/plain' }) })]).then(done, fallback);
    } else fallback();
    function fallback() {
      var r = document.createRange(); r.selectNodeContents(prev); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false; try { ok = document.execCommand('copy'); } catch (_) {} s.removeAllRanges();
      msg.textContent = ok ? 'Copied. Paste it into your Outlook signature.' : 'Copy was blocked by your browser. Use Download .htm instead.';
    }
  });
  document.getElementById('sr-dl').addEventListener('click', function () {
    if (!ready()) return; render();
    var b = BRANDS[form.company.value], d = data();
    var doc = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + esc(b.label) + ' signature</title></head><body>\n' + cur + '\n</body></html>\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    a.download = (d.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'signature') + '_' + b.file + '_signature.htm';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    msg.textContent = 'Downloaded.';
  });
  window.SRGen = { render: render, build: build, tel: tel, esc: esc, BRANDS: BRANDS };
  render();
})();
