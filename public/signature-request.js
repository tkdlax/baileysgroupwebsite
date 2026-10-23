(function () {
  var form = document.getElementById('sr-form'), status = document.getElementById('sr-status');
  if (!form) return;
  var company = form.company, MAX = 10 * 1024 * 1024, SEND_MAX = 3.8 * 1024 * 1024;
  function show(kind, html) { status.innerHTML = '<div class="sr-msg sr-' + kind + '">' + html + '</div>'; status.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  function sync() {
    document.querySelectorAll('[data-only]').forEach(function (el) { el.hidden = el.getAttribute('data-only') !== company.value; });
  }
  company.addEventListener('change', sync); sync();
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
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var f = form.headshot.files[0];
    if (!f || !/^image\/(jpeg|png)$/.test(f.type)) return show('err', 'Please choose a JPG or PNG headshot.');
    if (f.size > MAX) return show('err', 'That photo is over 10 MB. Please choose a smaller file.');
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
    shrink(f).then(function (file) {
      var fd = new FormData(form); fd.set('headshot', file, file.name);
      return fetch(form.action, { method: 'POST', body: fd });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (x.ok) { form.hidden = true; show('ok', '<strong>Thanks, your request is in.</strong> We\'ll email your new signature to you, usually within 7 to 10 business days.'); }
        else { show('err', (x.j && x.j.error) || 'Something went wrong sending your request. Please try again in a few minutes.'); if (window.turnstile) turnstile.reset(); }
      })
      .catch(function () { show('err', 'We couldn\'t send your request. Check your connection and try again.'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Submit request'; });
  });
})();
