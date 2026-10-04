/* Entry point: login, the app shell (sidebar + top bar), routing, publish and phone preview. */
import { api } from './api.js';
import { currentEditor, imagesPage, sectionPage, teamPage, versionsPage } from './pages.js';
import { consolePage, customersPage, ordersPage, shopifyPage } from './shopify.js';
import { mountPreview, previewHide, previewRefresh } from './preview.js';
import { openModal } from './pickers.js';
import { changedKeys, loadContent, loadProducts, onChange, sectionDef, state } from './store.js';
import { add, clear, fill, copyText, h, icon, relTime, toast } from './util.js';

const appRoot = document.getElementById('app');
let shell = null; // { main, sidebar, publishBtn, ... } once logged in
let teardown = () => {};

/* ═════════ Login ═════════ */

function showLogin({ expired = false } = {}) {
  document.querySelector('.login-screen')?.remove();
  const err = h('p', { class: 'login-error', role: 'alert', hidden: !expired }, expired ? 'You were logged out. Log in again — your edits are kept.' : '');
  const email = h('input', { class: 'input', type: 'email', name: 'email', required: true, autocomplete: 'username', placeholder: 'you@rosierfoods.com' });
  const password = h('input', { class: 'input', type: 'password', name: 'password', required: true, autocomplete: 'current-password' });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Log in');
  const form = h(
    'form',
    { class: 'login-card' },
    h('div', { class: 'login-brand' }, h('span', { class: 'wordmark' }, 'Rosier'), h('span', { class: 'brand-tag' }, 'App editor')),
    h('h1', null, 'Welcome back'),
    h('p', { class: 'muted' }, 'Log in to update what people see in the Rosier app.'),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Email'), email),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Password'), password),
    err,
    btn,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    err.hidden = true;
    try {
      const { user } = await api.post('/login', { email: email.value, password: password.value });
      state.user = user;
      screen.remove();
      if (shell) {
        currentEditor()?.retry();
        paintUser();
      } else await startApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Log in';
      password.select();
    }
  });
  const screen = h(
    'div',
    { class: 'login-screen' },
    h('div', { class: 'login-art', 'aria-hidden': 'true' }, h('div', { class: 'login-quote' }, h('span', { class: 'wordmark big' }, 'Rosier'), h('p', null, 'Reviving the tradition of Bharat'))),
    h('div', { class: 'login-side' }, form),
  );
  document.body.appendChild(screen);
  setTimeout(() => email.focus(), 50);
}

window.addEventListener('rosier:logged-out', () => {
  if (!document.querySelector('.login-screen')) showLogin({ expired: !!shell });
});

/* ═════════ Shell ═════════ */

function buildShell() {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Sections' });
  const navBottom = h('nav', { class: 'nav nav-bottom', 'aria-label': 'Tools' });
  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'sidebar-brand' }, h('span', { class: 'wordmark' }, 'Rosier'), h('span', { class: 'brand-tag' }, 'App editor')),
    h('p', { class: 'nav-title' }, 'What people see in the app'),
    nav,
    navBottom,
  );
  const scrim = h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') });
  const publishBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: openPublish });
  const userEl = h('span', { class: 'user-name' });
  const topbar = h(
    'header',
    { class: 'topbar' },
    h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'Menu', 'aria-controls': 'sidebar', onclick: () => document.body.classList.toggle('nav-open') }, icon('menu')),
    h('span', { class: 'topbar-brand wordmark' }, 'Rosier'),
    h('div', { class: 'topbar-spacer' }),
    h('button', { type: 'button', class: 'btn btn-soft preview-btn', onclick: openPreview }, icon('cellphone-text'), h('span', { class: 'hide-sm' }, 'Preview on phone')),
    publishBtn,
    h('div', { class: 'user-box' }, userEl, h('button', { type: 'button', class: 'icon-btn', title: 'Log out', 'aria-label': 'Log out', onclick: logout }, icon('logout'))),
  );
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  fill(appRoot, sidebar, scrim, h('div', { class: 'content' }, topbar, main));
  mountPreview(appRoot);
  shell = { nav, navBottom, main, publishBtn, userEl };
  paintUser();
  paintNav();
  onChange(paintNav);
}

function paintUser() {
  if (shell) shell.userEl.textContent = state.user?.name && state.user.name !== 'Admin' ? state.user.name : state.user?.email || '';
}

function navLink(href, ic, label, extra) {
  const active = location.hash === href || (href === '#/section/' + state.schema[0]?.key && !location.hash);
  return h('a', { href, class: `nav-item ${active ? 'active' : ''}`, 'aria-current': active ? 'page' : null, onclick: () => document.body.classList.remove('nav-open') }, icon(ic), h('span', { class: 'nav-label' }, label), extra);
}

function paintNav() {
  if (!shell) return;
  fill(shell.nav, 
    state.schema.map((s) => navLink(`#/section/${s.key}`, s.icon || 'file-outline', s.title, state.sections[s.key]?.changed ? h('span', { class: 'dot', title: 'Unpublished changes' }) : null)),
  );
  fill(shell.navBottom, 
    h('p', { class: 'nav-title' }, 'Shopify'),
    navLink('#/shopify', 'shopping-outline', 'Shopify connection'),
    navLink('#/orders', 'package-variant-closed', 'Orders'),
    navLink('#/customers', 'account-multiple-outline', 'Customers'),
    navLink('#/api', 'code-braces', 'API console'),
    h('p', { class: 'nav-title' }, 'Tools'),
    navLink('#/images', 'image-multiple-outline', 'Image library'),
    navLink('#/versions', 'history', 'Versions'),
    navLink('#/team', 'account-group-outline', 'Team & password'),
  );
  const n = changedKeys().length;
  shell.publishBtn.disabled = n === 0;
  fill(shell.publishBtn, icon(n ? 'rocket-launch-outline' : 'check-all'), h('span', { class: 'hide-sm' }, n ? `Publish changes (${n})` : 'All changes live'), h('span', { class: 'show-sm' }, n ? `Publish (${n})` : 'All live'));
}

/* ═════════ Routing ═════════ */

async function route() {
  if (!shell) return;
  const ed = currentEditor();
  if (ed?.dirty) await ed.flush();
  teardown();
  const main = shell.main;
  clear(main);
  const [, kind, key] = (location.hash || '').split('/');
  if (kind !== 'section' && location.hash) previewHide();
  if (kind === 'images') teardown = imagesPage(main);
  else if (kind === 'versions') teardown = versionsPage(main, { onRestored: () => (paintNav(), previewRefresh()) });
  else if (kind === 'team') teardown = teamPage(main);
  else if (kind === 'shopify') teardown = shopifyPage(main);
  else if (kind === 'orders') teardown = ordersPage(main);
  else if (kind === 'customers') teardown = customersPage(main);
  else if (kind === 'api') teardown = consolePage(main);
  else teardown = sectionPage(main, sectionDef(key) ? key : state.schema[0].key);
  paintNav();
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);

window.addEventListener('beforeunload', (e) => {
  if (currentEditor()?.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ═════════ Publish ═════════ */

async function openPublish() {
  const ed = currentEditor();
  if (ed && !(await ed.flush())) return toast("Your latest edits aren't saved yet, so they can't be published. Check your connection and try again.", 'error');
  const keys = changedKeys();
  if (!keys.length) return toast('Everything is already live.', 'info');
  const m = openModal({ title: 'Publish changes', subtitle: 'People see these the next time they open the app.' });
  const picked = new Set(keys);
  const btn = h('button', { type: 'button', class: 'btn btn-primary' });
  const paintBtn = () => {
    btn.disabled = !picked.size;
    fill(btn, icon('rocket-launch-outline'), picked.size ? `Publish ${picked.size} section${picked.size > 1 ? 's' : ''}` : 'Pick a section');
  };
  const note = h('input', { class: 'input', type: 'text', maxlength: 200, placeholder: 'e.g. Diwali banner and new popup' });
  add(m.body, 
    h(
      'div',
      { class: 'publish-list' },
      keys.map((k) => {
        const def = sectionDef(k);
        const row = state.sections[k];
        const cb = h('input', { type: 'checkbox', checked: true });
        cb.addEventListener('change', () => {
          cb.checked ? picked.add(k) : picked.delete(k);
          paintBtn();
        });
        return h(
          'label',
          { class: 'publish-row' },
          cb,
          h('span', { class: 'check', 'aria-hidden': 'true' }, icon('check')),
          icon(def?.icon || 'file-outline', 'publish-icon'),
          h('span', { class: 'publish-text' }, h('strong', null, def?.title || k), h('small', null, row?.updated_by ? `Edited by ${row.updated_by} · ${relTime(row.updated_at)}` : 'Edited')),
        );
      }),
    ),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'What changed? (optional)'), note, h('p', { class: 'help' }, 'A short note helps your team find this version later.')),
  );
  paintBtn();
  add(m.foot, h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => m.close(null) }, 'Cancel'), btn);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    fill(btn, icon('loading', 'spin'), 'Publishing…');
    try {
      const { release } = await api.post('/publish', { keys: [...picked], note: note.value.trim() });
      m.close(true);
      await loadContent();
      toast(`Published! Version ${release.id} is live. People see it next time they open the app.`);
    } catch (e) {
      toast(e.message, 'error');
      paintBtn();
    }
  });
  note.addEventListener('keydown', (e) => e.key === 'Enter' && !btn.disabled && btn.click());
}

/* ═════════ Phone preview ═════════ */

async function openPreview() {
  await currentEditor()?.flush();
  const m = openModal({ title: 'Preview on your phone', subtitle: 'See your unpublished changes in the real app before anyone else does.', className: 'modal-preview' });
  const qr = h('div', { class: 'qr' }, icon('loading', 'spin'));
  const linkBox = h('div', { class: 'link-box' });
  add(m.body, 
    h(
      'div',
      { class: 'preview-wrap' },
      qr,
      h(
        'ol',
        { class: 'steps' },
        h('li', null, 'Take the phone that has the Rosier app installed.'),
        h('li', null, 'Open the camera and point it at this code. Tap the link that pops up.'),
        h('li', null, 'The Rosier app opens showing your unpublished changes.'),
        h('li', null, 'To go back to the live app, use the preview banner at the top of the app.'),
      ),
    ),
    linkBox,
  );
  add(m.foot, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => m.close(null) }, 'Done'));
  try {
    const { link } = await api.get('/preview-link');
    clear(qr);
    if (window.QRCode) {
      new window.QRCode(qr, { text: link, width: 208, height: 208, colorDark: '#3E2415', colorLight: '#FFFFFF', correctLevel: window.QRCode.CorrectLevel.M });
      qr.removeAttribute('title'); // qrcodejs sets the raw link as a tooltip
    } else add(qr, h('p', { class: 'muted' }, "The QR code couldn't load. Copy the link below and open it on your phone instead."));
    add(linkBox, 
      h('p', { class: 'help' }, 'Or send yourself this link. It works for 7 days.'),
      h('div', { class: 'copy-row' }, h('code', { class: 'link-text' }, link), h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => copyText(link) }, icon('content-copy'), 'Copy')),
    );
  } catch (e) {
    fill(qr, h('p', { class: 'field-error' }, e.message));
  }
}

/* ═════════ Logout & start ═════════ */

async function logout() {
  const ed = currentEditor();
  if (ed?.dirty) await ed.flush();
  try {
    await api.post('/logout');
  } catch {
    /* ignore */
  }
  location.hash = '';
  location.reload();
}

async function startApp() {
  appRoot.classList.add('loading');
  try {
    const [{ schema }] = await Promise.all([api.get('/schema'), loadContent()]);
    state.schema = schema;
    buildShell();
    loadProducts().catch(() => toast("Couldn't load the product list. Product pickers may be empty.", 'error'));
    await route();
  } catch (e) {
    if (e.status !== 401) {
      fill(appRoot, h('div', { class: 'fatal' }, h('h1', null, "Couldn't open the editor"), h('p', null, e.message), h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Try again')));
    }
  } finally {
    appRoot.classList.remove('loading');
  }
}

async function boot() {
  try {
    const { user } = await api.get('/me');
    state.user = user;
    await startApp();
  } catch (e) {
    appRoot.classList.remove('loading');
    if (e.status !== 401) showLogin();
  }
}

boot();
