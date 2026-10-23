(function () {
  var form = document.getElementById('sr-form'), status = document.getElementById('sr-status');
  if (!form) return;
  var company = form.company, MAX = 10 * 1024 * 1024, SEND_MAX = 3.8 * 1024 * 1024;
  function show(kind, html) { status.innerHTML = '<div class="sr-msg sr-' + kind + '">' + html + '</div>'; status.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function sync() {
    document.querySelectorAll('[data-only]').forEach(function (el) {
      var off = el.getAttribute('data-only').split(' ').indexOf(company.value) < 0;
      el.hidden = off;
      // Hidden sections are disabled so their required fields don't block validation or get submitted.
      el.querySelectorAll('input,select,textarea,button').forEach(function (c) { c.disabled = off; });
    });
    if (window.SRGen) SRGen.render();
  }
  company.addEventListener('change', sync); sync();
  // Inline errors: show each field's message right under it.
  function errEl(el) { return document.getElementById(el.id + '-e'); }
  function setErr(el, msg) { var e = errEl(el); if (!e) return; e.textContent = msg || ''; if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); }
  function msgFor(el) {
    if (el.validity.valueMissing) return el.id === 'certify' ? 'Please check this box to continue.' : el.id === 'headshot' ? 'Please choose a headshot photo.' : el.tagName === 'SELECT' ? 'Please select your company.' : 'This field is required.';
    if (el.validity.typeMismatch) return el.type === 'email' ? 'Enter a valid email address.' : 'Enter a full URL starting with https://';
    return el.validationMessage;
  }
  function checkAll() {
    var first = null;
    form.querySelectorAll('input[id],select[id],textarea[id]').forEach(function (el) {
      if (!errEl(el)) return;
      var bad = !el.checkValidity(); setErr(el, bad ? msgFor(el) : ''); if (bad && !first) first = el;
    });
    if (first) first.focus();
    return !first;
  }
  form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid') && e.target.checkValidity()) setErr(e.target, ''); });
  form.addEventListener('change', function (e) { if (e.target.getAttribute('aria-invalid') && e.target.checkValidity()) setErr(e.target, ''); });
  // Products running count.
  var count = document.getElementById('sr-count');
  function recount() { var n = form.querySelectorAll('input[name=products]:checked').length; if (count) count.textContent = n + ' selected'; }
  form.addEventListener('change', function (e) { if (e.target.name === 'products') recount(); }); recount();
  // Headshot drop area + preview.
  var hs = form.headshot, drop = document.getElementById('sr-drop'), thumb = document.getElementById('sr-thumb'), fname = document.getElementById('sr-fname'), dropT = document.getElementById('sr-drop-t'), prevUrl;
  function preview() {
    var f = hs.files[0];
    if (prevUrl) { URL.revokeObjectURL(prevUrl); prevUrl = null; }
    if (f && /^image\//.test(f.type)) { prevUrl = URL.createObjectURL(f); thumb.style.backgroundImage = 'url(' + prevUrl + ')'; thumb.textContent = ''; }
    else { thumb.style.backgroundImage = ''; thumb.innerHTML = '&#128247;'; }
    fname.textContent = f ? f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)' : 'No file selected';
    dropT.textContent = f ? 'Change photo' : 'Choose a photo or drag it here';
  }
  hs.addEventListener('change', preview);
  if (drop) {
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('is-over'); }); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) { try { hs.files = e.dataTransfer.files; } catch (_) {} hs.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }
  // AgentMail and Netlify Functions cap a request at ~6 MB, so large photos are scaled down in the browser first.
  function shrink(file) {
    if (file.size <= SEND_MAX) return Promise.resolve(file);
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        (function tryQ(q) {
          c.toBlob(function (b) {
            if (!b) return rej(new Error('resize'));
            if (b.size > SEND_MAX && q > 0.5) return tryQ(q - 0.1);
            res(new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', q);
        })(0.9);
      };
      img.onerror = function () { rej(new Error('read')); }; img.src = url;
    });
  }
  fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
    if (!me) return;
    if (form.email) form.email.value = me.email || '';
    if (form.name && !form.name.value) form.name.value = me.name || '';
    var who = document.getElementById('sr-who');
    if (who) { who.textContent = 'Signed in as ' + (me.name ? me.name + ' (' + me.email + ')' : me.email) + '. '; var a = document.createElement('a'); a.href = '/api/auth/logout'; a.textContent = 'Sign out'; who.appendChild(a); who.hidden = false; }
  }).catch(function () {});
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!checkAll()) return;
    var f = form.headshot.files[0];
    if (!f || !/^image\/(jpeg|png)$/.test(f.type)) { setErr(form.headshot, 'Please choose a JPG or PNG headshot.'); form.headshot.focus(); return; }
    if (f.size > MAX) { setErr(form.headshot, 'That photo is over 10 MB. Please choose a smaller file.'); form.headshot.focus(); return; }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
    shrink(f).then(function (file) {
      var fd = new FormData(form); fd.set('headshot', file, file.name);
      return fetch(form.action, { method: 'POST', body: fd });
    }).then(function (r) { if (r.status === 401) { location.href = '/api/auth/login?return=/signature-request'; throw new Error('auth'); } return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok) { form.hidden = true; show('ok', '<strong>Thanks, your request is in.</strong> We\'ll email your new signature to you, usually within 7 to 10 business days.'); }
        else { show('err', (x.j && x.j.error) || 'Something went wrong sending your request. Please try again in a few minutes.'); if (window.turnstile) turnstile.reset(); }
      })
      .catch(function () { show('err', 'We couldn\'t send your request. Check your connection and try again.'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Submit request'; });
  });
})();
