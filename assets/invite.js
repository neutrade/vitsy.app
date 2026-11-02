/*
 * Vitsy invite landing (factory job 20261020-website, D1937; FR-Q5).
 *
 * GitHub Pages has no rewrites, so a shared link https://vitsy.app/i/<token> is served by 404.html, and
 * /i/?t=<token> by i/index.html. Both run this script. It reads the token from the last path segment (or the
 * `t` query value on /i/ itself) and checks it against the app's pattern, the same as INVITE_TOKEN in
 * web/src/lib/invite.ts. Only a token that passes is ever used, and only as the button's href attribute. Nothing
 * from the address is written into the page as text or HTML. No requests, no cookies, no storage.
 *
 * Outside /i/ (a real 404) the script does nothing.
 */
(function () {
  'use strict';

  const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
  const APP_LINK = 'vitsy://i/';

  const path = String(location.pathname || '');
  if (!/^\/i(\/|$)/.test(path)) return;

  function fromPath() {
    const segments = path.replace(/\/+$/, '').split('/');
    const last = segments.length > 2 ? segments[segments.length - 1] : '';
    if (last === '' || last === 'index.html') return null;
    try {
      return decodeURIComponent(last);
    } catch {
      return '';
    }
  }

  function fromQuery() {
    try {
      return new URLSearchParams(String(location.search || '')).get('t') || '';
    } catch {
      return '';
    }
  }

  const fromAddress = fromPath();
  const raw = fromAddress === null ? fromQuery() : fromAddress;
  const token = INVITE_TOKEN.test(raw) ? raw : null;

  const title = document.getElementById('page-title');
  const fallback = document.getElementById('page-default');
  const valid = document.getElementById('invite-valid');
  const invalid = document.getElementById('invite-invalid');
  const open = document.getElementById('invite-open');
  if (!title || !valid || !invalid || !open) return;

  if (fallback) fallback.hidden = true;
  if (token) {
    open.setAttribute('href', APP_LINK + token);
    title.textContent = 'You have an invite to Vitsy';
    document.title = 'You have an invite to Vitsy';
    valid.hidden = false;
  } else {
    title.textContent = "This isn't a Vitsy invite link.";
    document.title = 'Not a Vitsy invite link';
    invalid.hidden = false;
  }
})();
