/* Modal dialogs: confirm, prompt, image library picker, product picker, and the upload drop zone they share. */
import { api } from './api.js';
import { loadProducts, state } from './store.js';
import { add, clear, fill, fileSize, h, icon, thumbImg, toast } from './util.js';

/**
 * Opens a modal. Returns { el, body, close(result), result: Promise }.
 * opts: { title, subtitle, wide, actions: el|[els], onClose }
 */
export function openModal({ title, subtitle, wide = false, className = '' }) {
  let resolve;
  const result = new Promise((r) => (resolve = r));
  const body = h('div', { class: 'modal-body' });
  const foot = h('div', { class: 'modal-foot' });
  const closeBtn = h('button', { class: 'icon-btn modal-x', type: 'button', 'aria-label': 'Close', title: 'Close' }, icon('close'));
  const dlg = h(
    'dialog',
    { class: `modal ${wide ? 'modal-wide' : ''} ${className}`.trim() },
    h('div', { class: 'modal-head' }, h('div', null, h('h2', null, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null), closeBtn),
    body,
    foot,
  );
  let done = false;
  const close = (value = null) => {
    if (done) return;
    done = true;
    dlg.close();
    dlg.remove();
    resolve(value);
  };
  closeBtn.addEventListener('click', () => close(null));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close(null);
  });
  // Click on the dim backdrop closes.
  dlg.addEventListener('mousedown', (e) => {
    if (e.target === dlg) close(null);
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  return { el: dlg, body, foot, close, result };
}

export function confirmDialog(message, { title = 'Are you sure?', ok = 'Yes, continue', cancel = 'Cancel', danger = false, detail } = {}) {
  const m = openModal({ title });
  add(m.body, h('p', null, message), detail || null);
  const okBtn = h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => m.close(true) }, ok);
  add(m.foot, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close(false) }, cancel), okBtn);
  okBtn.focus();
  return m.result.then((r) => r === true);
}

export function promptDialog({ title, label, value = '', placeholder = '', help, ok = 'Save', validate }) {
  const m = openModal({ title });
  const input = h('input', { type: 'text', class: 'input', value, placeholder });
  const err = h('p', { class: 'field-error', hidden: true });
  const submit = (e) => {
    e?.preventDefault();
    const v = input.value.trim();
    const problem = validate?.(v);
    if (problem) {
      err.textContent = problem;
      err.hidden = false;
      return;
    }
    m.close(v);
  };
  add(m.body, 
    h('form', { onsubmit: submit }, h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, help ? h('span', { class: 'help' }, help) : null, err)),
  );
  add(m.foot, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close(null) }, 'Cancel'), h('button', { class: 'btn btn-primary', type: 'button', onclick: submit }, ok));
  setTimeout(() => input.focus(), 30);
  return m.result;
}

/* ───────── Upload drop zone (used by the library page and the picker) ───────── */

/**
 * A drag & drop / click-to-choose box that uploads images and calls onUploaded(images).
 */
export function uploadZone({ onUploaded, compact = false }) {
  const input = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const bar = h('div', { class: 'progress-bar' });
  const progress = h('div', { class: 'progress', hidden: true }, bar);
  const label = h('span', { class: 'drop-text' }, compact ? 'Drop images here or ' : 'Drag photos here, or ', h('u', null, 'choose from your computer'));
  const zone = h(
    'div',
    { class: `drop-zone ${compact ? 'drop-compact' : ''}`, tabindex: '0', role: 'button', 'aria-label': 'Upload images' },
    icon('cloud-upload-outline', 'drop-icon'),
    h('div', null, label, h('span', { class: 'drop-hint' }, 'JPG, PNG, WebP or GIF · up to 15 MB each · we optimise them for phones')),
    progress,
    input,
  );

  let busy = false;
  async function send(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?)$/i.test(f.name));
    if (!files.length) return toast('Please choose image files (JPG, PNG, WebP or GIF).', 'error');
    if (busy) return;
    busy = true;
    zone.classList.add('busy');
    progress.hidden = false;
    bar.style.width = '0%';
    label.textContent = `Uploading ${files.length} image${files.length > 1 ? 's' : ''}…`;
    try {
      const out = { images: [], errors: [] };
      // The server takes 20 files per request.
      for (let i = 0; i < files.length; i += 20) {
        const chunk = files.slice(i, i + 20);
        const r = await api.upload(chunk, (p) => (bar.style.width = `${Math.round(((i + p * chunk.length) / files.length) * 100)}%`));
        out.images.push(...(r.images || []));
        out.errors.push(...(r.errors || []));
      }
      bar.style.width = '100%';
      if (out.images.length) toast(`${out.images.length} image${out.images.length > 1 ? 's' : ''} uploaded`);
      for (const e of out.errors) toast(`Couldn't upload ${e}`, 'error');
      onUploaded?.(out.images);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      busy = false;
      zone.classList.remove('busy');
      setTimeout(() => (progress.hidden = true), 500);
      fill(label, compact ? 'Drop images here or ' : 'Drag photos here, or ', h('u', null, 'choose from your computer'));
      input.value = '';
    }
  }

  zone.addEventListener('click', (e) => {
    if (e.target !== input) input.click();
  });
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => input.files.length && send(input.files));
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    if (e.dataTransfer?.files?.length) send(e.dataTransfer.files);
  });
  return { el: zone, input, send };
}

/** Opens the OS file chooser and uploads one file. Resolves with "/img/<id>" or null. */
export function uploadOne({ accept = 'image/*' } = {}) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, hidden: true });
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files[0];
      input.remove();
      if (!f) return resolve(null);
      const label = h('span', null, ` Uploading ${f.name}…`);
      const t = h('div', { class: 'upload-pill' }, icon('loading', 'spin'), label);
      document.body.appendChild(t);
      try {
        const r = await api.upload([f], (p) => (label.textContent = ` Uploading ${f.name}… ${Math.round(p * 100)}%`));
        if (r.errors?.length) toast(`Couldn't upload ${r.errors[0]}`, 'error');
        resolve(r.images?.[0]?.url || null);
      } catch (e) {
        toast(e.message, 'error');
        resolve(null);
      } finally {
        t.remove();
      }
    });
    input.click();
  });
}

/* ───────── Image library picker ───────── */

export function pickFromLibrary() {
  const m = openModal({ title: 'Choose from your image library', subtitle: 'Click a photo to use it. You can upload new ones here too.', wide: true });
  const grid = h('div', { class: 'pick-grid' }, h('p', { class: 'muted' }, 'Loading images…'));
  const zone = uploadZone({
    compact: true,
    onUploaded: (imgs) => {
      if (imgs.length === 1) m.close(imgs[0].url);
      else load();
    },
  });
  add(m.body, zone.el, grid);
  add(m.foot, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close(null) }, 'Cancel'));

  async function load() {
    try {
      const images = (await api.get('/images')).images.filter((i) => !String(i.mime).startsWith('video/'));
      clear(grid);
      if (!images.length) add(grid, h('p', { class: 'empty-note' }, 'No images yet. Upload your first one above.'));
      for (const img of images) {
        add(grid, 
          h(
            'button',
            { class: 'pick-tile', type: 'button', title: img.name || '', onclick: () => m.close(img.url) },
            h('img', { src: `${img.url}?w=300`, alt: img.name || '', loading: 'lazy' }),
            h('span', { class: 'pick-name' }, img.name || 'Untitled'),
            h('span', { class: 'pick-meta' }, `${img.width}×${img.height} · ${fileSize(img.size)}`),
          ),
        );
      }
    } catch (e) {
      fill(grid, h('p', { class: 'field-error' }, e.message));
    }
  }
  load();
  return m.result;
}

/* ───────── Product picker ───────── */

/**
 * pickProducts({multiple:false}) → handle | null
 * pickProducts({multiple:true, exclude}) → [handles] | null
 */
export function pickProducts({ multiple = false, exclude = [], title } = {}) {
  const m = openModal({
    title: title || (multiple ? 'Add products' : 'Choose a product'),
    subtitle: multiple ? 'Tick the products to add, then press Add.' : 'Search by name, then click a product.',
    wide: true,
  });
  const search = h('input', { type: 'search', class: 'input search-input', placeholder: 'Search products… e.g. ghee, atta, honey', 'aria-label': 'Search products' });
  const list = h('div', { class: 'product-list' }, h('p', { class: 'muted' }, 'Loading products…'));
  const picked = new Set();
  const addBtn = h('button', { class: 'btn btn-primary', type: 'button', disabled: true, onclick: () => m.close([...picked]) }, 'Add');
  add(m.body, h('div', { class: 'search-wrap' }, icon('magnify'), search), list);
  add(m.foot, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close(null) }, 'Cancel'), multiple ? addBtn : null);

  const excluded = new Set(exclude);
  function render() {
    const q = search.value.trim().toLowerCase();
    const items = (state.products || []).filter((p) => !q || `${p.title} ${p.handle} ${p.type || ''} ${p.category || ''}`.toLowerCase().includes(q));
    clear(list);
    if (!items.length) add(list, h('p', { class: 'empty-note' }, 'No products match. Try a shorter word.'));
    for (const p of items.slice(0, 200)) {
      const already = excluded.has(p.handle);
      const row = h(
        'button',
        {
          type: 'button',
          class: `product-row ${picked.has(p.handle) ? 'picked' : ''}`,
          disabled: already,
          onclick: () => {
            if (!multiple) return m.close(p.handle);
            picked.has(p.handle) ? picked.delete(p.handle) : picked.add(p.handle);
            row.classList.toggle('picked', picked.has(p.handle));
            addBtn.disabled = !picked.size;
            addBtn.textContent = picked.size ? `Add ${picked.size} product${picked.size > 1 ? 's' : ''}` : 'Add';
          },
        },
        multiple ? h('span', { class: 'tick' }, icon('check')) : null,
        thumbImg(p.image),
        h('span', { class: 'product-text' }, h('strong', null, p.title), h('small', null, already ? 'Already added' : [p.type, p.handle].filter(Boolean).join(' · '))),
      );
      add(list, row);
    }
  }
  search.addEventListener('input', render);
  loadProducts().then(render, (e) => fill(list, h('p', { class: 'field-error' }, `Couldn't load products: ${e.message}`)));
  setTimeout(() => search.focus(), 30);
  return m.result;
}
