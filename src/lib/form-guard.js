// MOCKUP ONLY — stops Webflow forms from submitting. webflow.js would post them to the live site's
// Webflow form inbox (data-wf-site). Remove when forms get their real phase-2 backend. See THIRD-PARTY.md.
document.addEventListener('submit', function (e) { e.preventDefault(); e.stopImmediatePropagation(); }, true);
