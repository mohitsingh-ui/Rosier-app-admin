/* The four kinds of page: section editor, image library, versions, team. */
import { api } from './api.js';
import { renderFields } from './fields.js';
import { confirmDialog, uploadZone } from './pickers.js';
import { loadContent, onChange, sectionDef, setSection, state } from './store.js';
import { previewSection, previewTryEffect, previewUpdate } from './preview.js';
import { pageOpened } from './inspector.js';
import { add, clear, fill, clone, copyText, debounce, fileSize, fullDate, h, icon, randomId, relTime, toast } from './util.js';

/* ═════════ Section editor ═════════ */

let current = null; // the open editor, so main.js can flush it before publishing / leaving
export const currentEditor = () => current;

/** Give items in autoId lists an id before saving, so the id stays the same on every save. */
function ensureIds(fields, value) {
  if (!value || typeof value !== 'object') return;
  for (const f of fields) {
    const v = value[f.key];
    if (f.type === 'group') ensureIds(f.fields || [], v);
    if (f.type === 'list' && Array.isArray(v)) {
      for (const item of v) {
        if (f.autoId && item && typeof item === 'object' && !item.id) item.id = randomId();
        ensureIds(f.fields || [], item);
      }
    }
  }
}

export function sectionPage(root, key) {
  const def = sectionDef(key);
  if (!def) {
    add(root, h('div', { class: 'page' }, h('h1', null, 'Not found'), h('p', null, 'That section does not exist.')));
    return () => {};
  }

  let doc = clone(state.sections[key]?.draft ?? {});
  let dirty = false;
  let saving = null; // promise while a save is in flight
  let failed = null;
  let retryTimer = null;

  const status = h('div', { class: 'save-status', role: 'status', 'aria-live': 'polite' });
  const discardBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: discard }, icon('undo-variant'), 'Discard changes');
  const resetBtn = h('button', { type: 'button', class: 'btn btn-ghost', onclick: resetToDefault }, icon('restore'), 'Reset to app default');
  const formWrap = h('div', { class: 'form-card' });

  function paintStatus() {
    const row = state.sections[key];
    let cls;
    let ic;
    let text;
    if (failed) {
      cls = 'error';
      ic = 'alert-circle-outline';
      text = "Couldn't save — we'll keep trying";
    } else if (dirty || saving) {
      cls = 'saving';
      ic = 'loading';
      text = 'Saving…';
    } else if (row?.changed) {
      cls = 'draft';
      ic = 'content-save-check-outline';
      text = 'Saved as draft · Not published yet';
    } else {
      cls = 'live';
      ic = 'check-circle-outline';
      text = 'Live in the app';
    }
    status.className = `save-status ${cls}`;
    fill(status, icon(ic, ic === 'loading' ? 'spin' : ''), h('span', null, text));
    if (failed) status.title = failed.message;
    else status.removeAttribute('title');
    discardBtn.hidden = !(row?.changed || dirty);
  }

  async function save() {
    if (saving) {
      await saving;
      if (dirty) return save();
      return;
    }
    if (!dirty) return;
    clearTimeout(retryTimer);
    ensureIds(def.fields, doc);
    const payload = JSON.parse(JSON.stringify(doc));
    dirty = false;
    paintStatus();
    saving = (async () => {
      try {
        const { section } = await api.put(`/content/${key}`, { data: payload });
        failed = null;
        setSection(section);
      } catch (e) {
        dirty = true;
        if (!failed) toast(`Couldn't save your changes: ${e.message}`, 'error');
        failed = e;
        if (e.status !== 401) retryTimer = setTimeout(() => save().catch(() => {}), 6000);
      }
    })();
    await saving;
    saving = null;
    paintStatus();
    if (dirty && !failed) return save();
  }

  const saveSoon = debounce(() => save(), 800);
  const changed = () => {
    dirty = true;
    paintStatus();
    previewUpdate(doc);
    saveSoon();
  };

  function renderForm() {
    fill(formWrap, renderFields(def.fields, doc, changed));
  }

  async function discard() {
    if (!(await confirmDialog('Your unpublished changes to this section will be thrown away, and it will go back to what the app shows right now.', { title: 'Discard changes?', ok: 'Discard changes', danger: true })))
      return;
    saveSoon.cancel();
    clearTimeout(retryTimer);
    if (saving) await saving;
    try {
      const { section } = await api.post(`/content/${key}/discard`);
      dirty = false;
      failed = null;
      setSection(section);
      doc = clone(section.draft);
      renderForm();
      paintStatus();
      previewSection(key, doc);
      toast('Changes discarded');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function resetToDefault() {
    if (!(await confirmDialog(`Everything in "${def.title}" goes back to how it was when the app was built. This is saved as a draft — nothing changes in the app until you publish.`, { title: 'Reset to app default?', ok: 'Reset' })))
      return;
    try {
      const { data } = await api.get(`/defaults/${key}`);
      doc = clone(data);
      renderForm();
      changed();
      toast('Reset to the app default. Publish when you are happy.', 'info');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // Section-specific helpers next to Discard / Reset.
  const extras = [];
  if (key === 'effects') {
    extras.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost',
          title: 'Plays the first switched-on effect in the phone for 12 seconds, even if the main switch is off',
          onclick: () => {
            const e = (doc.items || []).find((x) => x && x.enabled) || (doc.items || [])[0];
            if (!e) return toast('Add an effect first', 'info');
            previewTryEffect(e);
            toast(`Playing “${e.name || e.type}” in the phone`, 'info');
          },
        },
        icon('play-circle-outline'),
        'Play in live preview',
      ),
    );
  }
  if (key === 'push') {
    extras.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost',
          title: 'Plays the chosen notification sound',
          onclick: () => {
            const snd = doc.sound || 'chime';
            if (snd === 'default') return toast('“Phone’s default” uses each phone’s own sound.', 'info');
            new Audio(`sounds/rosier_${snd}.wav`).play().catch(() => toast('Your browser blocked the sound — click again.', 'info'));
          },
        },
        icon('play-circle-outline'),
        'Play sound',
      ),
      h('a', { class: 'btn btn-ghost', href: '#/push' }, icon('send-outline'), 'Send a notification'),
    );
  }
  if (key === 'coupons') {
    extras.push(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost',
          title: 'Adds your active Shopify discount codes to the list below',
          onclick: async (ev) => {
            const b = ev.currentTarget;
            b.disabled = true;
            try {
              const { codes } = await api.get('/shopify/discounts');
              doc.items = Array.isArray(doc.items) ? doc.items : [];
              const have = new Set(doc.items.map((c) => String(c.code || '').toLowerCase()));
              let n = 0;
              for (const c of codes) {
                if (have.has(c.code.toLowerCase())) continue;
                doc.items.push({ id: randomId(), enabled: true, description: '', maxDiscount: 0, ...c });
                n++;
              }
              renderForm();
              changed();
              toast(n ? `Added ${n} coupon${n > 1 ? 's' : ''} from Shopify. Check the headlines, then publish.` : codes.length ? 'All your Shopify codes are already in the list.' : 'No active discount codes found in Shopify.', n ? 'ok' : 'info');
            } catch (e) {
              toast(e.message, 'error');
            } finally {
              b.disabled = false;
            }
          },
        },
        icon('cloud-download-outline'),
        'Import from Shopify',
      ),
    );
  }

  const row = state.sections[key];
  add(root, 
    h(
      'div',
      { class: 'page page-editor' },
      h(
        'header',
        { class: 'page-head' },
        h('div', { class: 'page-title' }, h('span', { class: 'page-icon' }, icon(def.icon || 'file-document-outline')), h('div', null, h('h1', null, def.title), def.description ? h('p', { class: 'page-desc' }, def.description) : null)),
      ),
      h('div', { class: 'editor-bar' }, status, h('div', { class: 'editor-actions' }, ...extras, discardBtn, resetBtn)),
      row?.updated_by && row?.changed ? h('p', { class: 'meta-line' }, `Last edited by ${row.updated_by} · ${relTime(row.updated_at)}`) : null,
      formWrap,
    ),
  );
  pageOpened(key);
  renderForm();
  paintStatus();
  previewSection(key, doc);
  const off = onChange(paintStatus);

  current = {
    key,
    get doc() {
      return doc;
    },
    changed,
    rerender: renderForm,
    get dirty() {
      return dirty || !!saving;
    },
    async flush() {
      saveSoon.cancel();
      if (dirty || saving) await save();
      return !failed;
    },
    retry() {
      if (dirty) save();
    },
  };

  return () => {
    off();
    saveSoon.cancel();
    clearTimeout(retryTimer);
    current = null;
  };
}

/* ═════════ Image library ═════════ */

function usage(id) {
  const needle = `/img/${id}`;
  return state.schema.filter((s) => {
    const row = state.sections[s.key];
    return row && (JSON.stringify(row.draft).includes(needle) || JSON.stringify(row.published).includes(needle));
  });
}

export function imagesPage(root) {
  const grid = h('div', { class: 'lib-grid' });
  const countEl = h('span', { class: 'count-pill' });
  const zone = uploadZone({ onUploaded: () => load() });

  async function del(img) {
    const used = usage(img.id);
    const detail = used.length
      ? h('div', { class: 'warn-box' }, icon('alert-outline'), h('span', null, `This image is used in: ${used.map((s) => s.title).join(', ')}. It will disappear from those places in the app.`))
      : h('p', { class: 'muted' }, "We couldn't find it in any section, but double-check before deleting.");
    if (!(await confirmDialog(`"${img.name || 'This image'}" will be deleted for good.`, { title: 'Delete this image?', ok: 'Delete image', danger: true, detail }))) return;
    try {
      await api.del(`/images/${encodeURIComponent(img.id)}`);
      toast('Image deleted');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function load() {
    try {
      const { images } = await api.get('/images');
      countEl.textContent = `${images.length} image${images.length === 1 ? '' : 's'}`;
      clear(grid);
      if (!images.length) add(grid, h('div', { class: 'empty-state' }, icon('image-multiple-outline'), h('p', null, 'No images yet. Drop your first photos above.')));
      for (const img of images) {
        const used = usage(img.id);
        add(grid, 
          h(
            'figure',
            { class: 'lib-card' },
            h(
              'a',
              { class: 'lib-thumb', href: img.url, target: '_blank', rel: 'noopener', title: 'Open full size' },
              String(img.mime).startsWith('video/')
                ? h('video', { src: img.url, muted: true, loop: true, playsinline: true, preload: 'metadata', onmouseenter: (e) => e.target.play(), onmouseleave: (e) => e.target.pause() })
                : h('img', { src: `${img.url}?w=400`, alt: img.name || '', loading: 'lazy' }),
            ),
            h(
              'figcaption',
              null,
              h('strong', { class: 'lib-name', title: img.name || '' }, img.name || 'Untitled'),
              h('span', { class: 'lib-meta' }, String(img.mime).startsWith('video/') ? `Video · ${fileSize(img.size)}` : `${img.width} × ${img.height} · ${fileSize(img.size)}`),
              h('span', { class: 'lib-meta', title: fullDate(img.created_at) }, `Added ${relTime(img.created_at)}`),
              used.length ? h('span', { class: 'badge badge-live', title: used.map((s) => s.title).join(', ') }, `In use · ${used.length} section${used.length > 1 ? 's' : ''}`) : null,
              h(
                'div',
                { class: 'lib-actions' },
                h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => copyText(location.origin + img.url) }, icon('link-variant'), 'Copy link'),
                h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Delete', 'aria-label': `Delete ${img.name || 'image'}`, onclick: () => del(img) }, icon('trash-can-outline')),
              ),
            ),
          ),
        );
      }
    } catch (e) {
      fill(grid, h('p', { class: 'field-error' }, e.message));
    }
  }

  add(root, 
    h(
      'div',
      { class: 'page page-wide' },
      h(
        'header',
        { class: 'page-head' },
        h('div', { class: 'page-title' }, h('span', { class: 'page-icon' }, icon('image-multiple-outline')), h('div', null, h('h1', null, 'Image library'), h('p', { class: 'page-desc' }, 'Every photo you upload lives here. Use them anywhere in the app with "Choose from library".'))),
        countEl,
      ),
      zone.el,
      grid,
    ),
  );
  load();
  return () => {};
}

/* ═════════ Versions ═════════ */

export function versionsPage(root, { onRestored }) {
  const list = h('div', { class: 'versions' }, h('p', { class: 'muted' }, 'Loading…'));
  const title = (k) => sectionDef(k)?.title || k;

  async function restore(rel) {
    const ok = await confirmDialog(`The app goes back to exactly how it was in version ${rel.id}. Any unpublished draft changes are replaced too. We save this as a new version, so you can undo it later.`, {
      title: `Restore version ${rel.id}?`,
      ok: 'Restore this version',
      danger: true,
    });
    if (!ok) return;
    try {
      const { release } = await api.post(`/releases/${rel.id}/rollback`);
      await loadContent();
      toast(`Restored. The app is now on version ${release.id}.`);
      onRestored?.();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function load() {
    try {
      const { releases } = await api.get('/releases');
      clear(list);
      if (!releases.length) add(list, h('p', { class: 'empty-note' }, 'Nothing published yet.'));
      releases.forEach((rel, i) => {
        const secs = rel.sections || [];
        const all = secs.length >= state.schema.length;
        add(list, 
          h(
            'article',
            { class: `version ${i === 0 ? 'is-live' : ''}` },
            h('div', { class: 'version-num' }, h('small', null, 'Version'), h('strong', null, String(rel.id))),
            h(
              'div',
              { class: 'version-main' },
              h('div', { class: 'version-top' }, h('strong', { class: 'version-note' }, rel.note || 'No note'), i === 0 ? h('span', { class: 'badge badge-live' }, 'Live now') : null),
              h(
                'div',
                { class: 'chips' },
                all ? h('span', { class: 'chip' }, 'All sections') : secs.map((k) => h('span', { class: 'chip' }, title(k))),
              ),
              h('p', { class: 'version-meta', title: fullDate(rel.created_at) }, `${rel.created_by === 'system' ? 'Set up automatically' : rel.created_by || 'Someone'} · ${relTime(rel.created_at)}`),
            ),
            i === 0 ? null : h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => restore(rel) }, icon('history'), 'Restore this version'),
          ),
        );
      });
    } catch (e) {
      fill(list, h('p', { class: 'field-error' }, e.message));
    }
  }

  add(root, 
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'page-head' },
        h('div', { class: 'page-title' }, h('span', { class: 'page-icon' }, icon('history')), h('div', null, h('h1', null, 'Versions'), h('p', { class: 'page-desc' }, 'Every time someone publishes, we keep a copy. If something goes wrong, restore an earlier version in one click.'))),
      ),
      list,
    ),
  );
  load();
  return () => {};
}

/* ═════════ Team & password ═════════ */

export function teamPage(root) {
  const list = h('div', { class: 'team-list' });

  async function load(admins) {
    try {
      if (!admins) admins = (await api.get('/admins')).admins;
      clear(list);
      for (const a of admins) {
        const me = Number(a.id) === Number(state.user?.id);
        const initials = (a.name || a.email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
        add(list, 
          h(
            'div',
            { class: 'team-row' },
            h('span', { class: 'avatar' }, initials),
            h('div', { class: 'team-text' }, h('strong', null, a.name || a.email, me ? h('span', { class: 'badge badge-live' }, 'You') : null), h('small', null, a.email)),
            h('small', { class: 'muted team-seen', title: a.last_login_at ? fullDate(a.last_login_at) : '' }, a.last_login_at ? `Last in ${relTime(a.last_login_at)}` : 'Never logged in'),
            me
              ? h('span', { class: 'team-spacer' })
              : h(
                  'button',
                  {
                    type: 'button',
                    class: 'icon-btn sm danger',
                    title: 'Remove',
                    'aria-label': `Remove ${a.email}`,
                    onclick: async () => {
                      if (!(await confirmDialog(`${a.email} won't be able to log in to the app editor any more.`, { title: 'Remove this person?', ok: 'Remove', danger: true }))) return;
                      try {
                        const r = await api.del(`/admins/${a.id}`);
                        toast('Removed');
                        load(r.admins);
                      } catch (e) {
                        toast(e.message, 'error');
                      }
                    },
                  },
                  icon('account-remove-outline'),
                ),
          ),
        );
      }
    } catch (e) {
      fill(list, h('p', { class: 'field-error' }, e.message));
    }
  }

  const input = (attrs) => h('input', { class: 'input', ...attrs });
  const addForm = h(
    'form',
    { class: 'stack' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Name'), input({ name: 'name', autocomplete: 'off', placeholder: 'e.g. Priya' })),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Email'), input({ name: 'email', type: 'email', required: true, autocomplete: 'off', placeholder: 'name@rosierfoods.com' })),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Password'), input({ name: 'password', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }), h('p', { class: 'help' }, 'At least 8 characters. Share it with them privately — they can change it after logging in.')),
    h('button', { class: 'btn btn-primary', type: 'submit' }, icon('account-plus-outline'), 'Add to team'),
  );
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    try {
      const r = await api.post('/admins', { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
      addForm.reset();
      toast('Added. They can log in now.');
      load(r.admins);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const pwForm = h(
    'form',
    { class: 'stack' },
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Current password'), input({ name: 'current', type: 'password', required: true, autocomplete: 'current-password' })),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'New password'), input({ name: 'next', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }), h('p', { class: 'help' }, 'At least 8 characters.')),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'New password again'), input({ name: 'again', type: 'password', required: true, autocomplete: 'new-password' })),
    h('button', { class: 'btn btn-primary', type: 'submit' }, icon('lock-reset'), 'Change password'),
  );
  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(pwForm);
    if (fd.get('next') !== fd.get('again')) return toast("The two new passwords don't match.", 'error');
    try {
      await api.post('/password', { current: fd.get('current'), next: fd.get('next') });
      pwForm.reset();
      toast('Password changed');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  add(root, 
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'page-head' },
        h('div', { class: 'page-title' }, h('span', { class: 'page-icon' }, icon('account-group-outline')), h('div', null, h('h1', null, 'Team & password'), h('p', { class: 'page-desc' }, 'Everyone here can edit and publish the app.'))),
      ),
      h('section', { class: 'card' }, h('h2', null, 'Team'), list),
      h('div', { class: 'two-col' }, h('section', { class: 'card' }, h('h2', null, 'Add someone'), addForm), h('section', { class: 'card' }, h('h2', null, 'Change my password'), pwForm)),
    ),
  );
  load();
  return () => {};
}
