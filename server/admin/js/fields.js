/* Renders a form from schema fields. Every control writes straight into the object it was given and calls notify(). */
import { confirmDialog, pickFromLibrary, pickProducts, promptDialog, uploadOne } from './pickers.js';
import { LINK_PRESETS, categoryOptions, describeLink, imageSource, imageUrl, productByHandle, whenProducts } from './store.js';
import { add, clear, fill, clone, h, icon, isEmpty, isShown, move, thumbImg } from './util.js';

let uid = 0;
const nextId = (p = 'f') => `${p}-${++uid}`;

/** Remembers which list cards are open, keyed by the item object itself (survives reorders). */
const openItems = new WeakSet();

/**
 * Render a set of fields bound to `obj`. Returns the container element.
 * Fields with showIf are hidden/shown live whenever something inside this container changes.
 */
export function renderFields(fields, obj, notify) {
  const wrap = h('div', { class: 'fields' });
  const rows = [];
  const local = () => {
    updateVisibility();
    notify();
  };
  for (const f of fields) {
    const el = renderField(f, obj, local);
    rows.push({ f, el });
    wrap.appendChild(el);
  }
  function updateVisibility() {
    for (const { f, el } of rows) el.hidden = !isShown(f, obj);
  }
  updateVisibility();
  return wrap;
}

const RENDERERS = {
  text: textField,
  textarea: textField,
  number: numberField,
  boolean: booleanField,
  color: colorField,
  image: imageField,
  video: videoField,
  images: imagesField,
  link: linkField,
  icon: iconField,
  select: selectField,
  datetime: datetimeField,
  product: productField,
  products: productsField,
  category: selectField,
  colors: colorsField,
  strings: stringsField,
  group: groupField,
  list: listField,
};

export function renderField(f, obj, notify) {
  const r = RENDERERS[f.type] || textField;
  return r(f, obj, notify);
}

/* ───────── Wrapper ───────── */

function wrapField(f, control, { id, extraClass = '', labelFor = true } = {}) {
  return h(
    'div',
    { class: `field field-${f.type} ${extraClass}`.trim(), dataset: { key: f.key } },
    f.label ? h(labelFor ? 'label' : 'div', { class: 'field-label', for: labelFor ? id : null }, f.label) : null,
    control,
    f.help ? h('p', { class: 'help' }, f.help) : null,
  );
}

/* ───────── Simple inputs ───────── */

function textField(f, obj, notify) {
  const id = nextId();
  const isArea = f.type === 'textarea';
  const input = isArea
    ? h('textarea', { id, class: 'input', rows: f.rows || 3 })
    : h('input', { id, class: 'input', type: 'text', autocomplete: 'off' });
  input.value = obj[f.key] ?? '';
  input.addEventListener('input', () => {
    obj[f.key] = input.value;
    notify();
  });
  if (isArea && !f.rows) {
    const grow = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight + 2, 420)}px`;
    };
    input.addEventListener('input', grow);
    requestAnimationFrame(grow);
  }
  return wrapField(f, input, { id });
}

function numberField(f, obj, notify) {
  const id = nextId();
  const input = h('input', { id, class: 'input input-num', type: 'number', step: 'any', inputmode: 'decimal' });
  input.value = obj[f.key] ?? '';
  input.addEventListener('input', () => {
    if (input.value === '' || isNaN(Number(input.value))) return;
    obj[f.key] = Number(input.value);
    notify();
  });
  input.addEventListener('change', () => {
    if (input.value === '') {
      obj[f.key] = 0;
      input.value = '0';
      notify();
    }
  });
  return wrapField(f, input, { id });
}

function booleanField(f, obj, notify) {
  const id = nextId();
  const input = h('input', { id, type: 'checkbox', role: 'switch', checked: !!obj[f.key] });
  const state = h('span', { class: 'switch-state' }, obj[f.key] ? 'On' : 'Off');
  input.addEventListener('change', () => {
    obj[f.key] = input.checked;
    state.textContent = input.checked ? 'On' : 'Off';
    notify();
  });
  return h(
    'div',
    { class: 'field field-boolean', dataset: { key: f.key } },
    h('label', { class: 'switch-row', for: id }, input, h('span', { class: 'switch', 'aria-hidden': 'true' }), h('span', { class: 'switch-label' }, f.label), state),
    f.help ? h('p', { class: 'help' }, f.help) : null,
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
function toSix(hex) {
  if (!HEX.test(hex || '')) return '#000000';
  if (hex.length === 4) return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  return hex.slice(0, 7);
}

/** A swatch + hex box. Calls set(hex) with valid values only. */
function colorInput(value, set, { label } = {}) {
  const swatch = h('input', { type: 'color', class: 'swatch', value: toSix(value), 'aria-label': label ? `${label} picker` : 'Colour picker' });
  const text = h('input', { type: 'text', class: 'input input-hex', value: value || '', maxlength: 9, spellcheck: 'false', placeholder: '#A56312', 'aria-label': label || 'Colour code' });
  swatch.addEventListener('input', () => {
    text.value = swatch.value.toUpperCase();
    text.classList.remove('invalid');
    set(text.value);
  });
  const wrap = h('div', { class: `color-input ${value ? '' : 'is-empty'}`.trim() }, swatch, text);
  swatch.addEventListener('input', () => wrap.classList.remove('is-empty'));
  text.addEventListener('input', () => {
    let v = text.value.trim();
    if (!v) {
      // Empty = no colour (use the default).
      text.classList.remove('invalid');
      wrap.classList.add('is-empty');
      return set('');
    }
    if (!v.startsWith('#')) v = `#${v}`;
    const ok = HEX.test(v);
    text.classList.toggle('invalid', !ok);
    if (ok) {
      wrap.classList.remove('is-empty');
      swatch.value = toSix(v);
      set(v.toUpperCase());
    }
  });
  return wrap;
}

function colorField(f, obj, notify) {
  const ctl = colorInput(obj[f.key], (v) => {
    obj[f.key] = v;
    notify();
  }, { label: f.label });
  return wrapField(f, ctl, { labelFor: false });
}

function selectField(f, obj, notify) {
  const id = nextId();
  const options = f.type === 'category' ? [{ value: '', label: '— None —' }, ...categoryOptions()] : f.options || [];
  const current = obj[f.key] ?? '';
  const sel = h('select', { id, class: 'input' });
  const known = options.some((o) => o.value === current);
  if (!known && current !== '') add(sel, h('option', { value: current }, `${current} (not in the list)`));
  if (!known && current === '' && f.type !== 'category') add(sel, h('option', { value: '' }, 'Choose…'));
  for (const o of options) add(sel, h('option', { value: o.value }, o.label));
  sel.value = current;
  sel.addEventListener('change', () => {
    obj[f.key] = sel.value;
    notify();
  });
  return wrapField(f, h('div', { class: 'select-wrap' }, sel, icon('chevron-down', 'select-caret')), { id });
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function datetimeField(f, obj, notify) {
  const id = nextId();
  const input = h('input', { id, class: 'input input-date', type: 'datetime-local' });
  input.value = toLocalInput(obj[f.key]);
  const clearBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', hidden: !obj[f.key] }, 'Clear');
  const set = (v) => {
    obj[f.key] = v;
    clearBtn.hidden = !v;
    notify();
  };
  input.addEventListener('change', () => {
    const d = input.value ? new Date(input.value) : null;
    set(d && !isNaN(d) ? d.toISOString() : '');
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    set('');
  });
  return wrapField(f, h('div', { class: 'inline-row' }, input, clearBtn), { id });
}

function iconField(f, obj, notify) {
  const id = nextId();
  const preview = h('span', { class: 'icon-preview', 'aria-hidden': 'true' });
  const warn = h('span', { class: 'icon-warn', hidden: true }, 'Icon not found — check the name');
  const input = h('input', { id, class: 'input', type: 'text', value: obj[f.key] ?? '', placeholder: 'e.g. gift-outline', spellcheck: 'false', autocomplete: 'off' });
  const update = () => {
    const name = input.value.trim().replace(/^mdi-/, '');
    preview.className = `icon-preview mdi ${name ? `mdi-${name}` : 'mdi-help-circle-outline is-empty'}`;
    // Ask the icon font whether that name exists (it renders nothing when it doesn't).
    requestAnimationFrame(() => {
      const c = getComputedStyle(preview, '::before').content;
      warn.hidden = !name || (c && c !== 'none' && c !== 'normal' && c !== '""');
    });
  };
  input.addEventListener('input', () => {
    obj[f.key] = input.value.trim().replace(/^mdi-/, '');
    update();
    notify();
  });
  update();
  return wrapField(f, h('div', null, h('div', { class: 'icon-input' }, preview, input), warn), { id });
}

/* ───────── Images ───────── */

const SAME_ORIGIN_IMG = new RegExp(`^${location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/img/[\\w-]+)`);

/** Ask for an image in one of four ways. Resolves with the value to store, or null. */
export async function chooseImage(how) {
  if (how === 'upload') return uploadOne();
  if (how === 'library') return pickFromLibrary();
  if (how === 'product') {
    const handle = await pickProducts({ title: 'Use a product photo' });
    return handle ? `product:${handle}` : null;
  }
  if (how === 'link') {
    const v = await promptDialog({
      title: 'Paste an image link',
      label: 'Image link',
      placeholder: 'https://…',
      help: 'Right-click an image on a website → "Copy image address", then paste it here.',
      ok: 'Use this image',
      validate: (s) => (/^https:\/\/\S+$/i.test(s) || SAME_ORIGIN_IMG.test(s) ? '' : 'The link should start with https://'),
    });
    if (!v) return null;
    const m = v.match(SAME_ORIGIN_IMG);
    return m ? m[1] : v;
  }
  return null;
}

function thumb(value, cls = 'thumb') {
  const box = h('div', { class: `${cls} ${value ? '' : 'is-empty'}` });
  const paint = () => {
    clear(box);
    const url = imageUrl(value);
    if (url) {
      const img = h('img', { src: url, alt: '', loading: 'lazy' });
      img.addEventListener('error', () => fill(box, icon('image-broken-variant'), h('span', null, "Can't load")));
      add(box, img);
    } else add(box, icon(value ? 'image-outline' : 'image-plus-outline'));
  };
  paint();
  if (value?.startsWith('product:')) whenProducts(paint);
  return box;
}

const imageButtons = (onPick) => [
  h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => onPick('upload') }, icon('upload'), 'Upload'),
  h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => onPick('library') }, icon('image-multiple-outline'), 'Choose from library'),
  h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => onPick('product') }, icon('basket-outline'), 'Use a product photo'),
  h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => onPick('link') }, icon('link-variant'), 'Paste link'),
];

function imageField(f, obj, notify) {
  const box = h('div', { class: 'image-field' });
  const render = () => {
    const v = obj[f.key] || '';
    const src = h('p', { class: 'image-src' }, v ? imageSource(v) : 'No image yet');
    if (v.startsWith('product:')) whenProducts(() => (src.textContent = imageSource(v)));
    fill(box, 
      thumb(v, 'image-thumb'),
      h(
        'div',
        { class: 'image-side' },
        src,
        h(
          'div',
          { class: 'btn-row' },
          imageButtons(async (how) => {
            const nv = await chooseImage(how);
            if (nv) {
              obj[f.key] = nv;
              render();
              notify();
            }
          }),
          v
            ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-remove', onclick: () => ((obj[f.key] = ''), render(), notify()) }, icon('trash-can-outline'), 'Remove')
            : null,
        ),
      ),
    );
  };
  render();
  return wrapField(f, box, { labelFor: false });
}

/** A video: upload an MP4 or paste a link (e.g. from Shopify → Content → Files). */
function videoField(f, obj, notify) {
  const box = h('div', { class: 'image-field video-field' });
  const render = () => {
    const v = obj[f.key] || '';
    const preview = v
      ? h('video', { class: 'image-thumb video-thumb', src: v, muted: true, loop: true, autoplay: true, playsinline: true, controls: false })
      : h('div', { class: 'image-thumb is-empty' }, icon('video-plus-outline'));
    if (v) preview.muted = true;
    const src = h('p', { class: 'image-src' }, !v ? 'No video yet' : v.startsWith('/img/') ? 'Uploaded video' : 'Video from a web link');
    fill(
      box,
      preview,
      h(
        'div',
        { class: 'image-side' },
        src,
        h(
          'div',
          { class: 'btn-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-soft btn-sm',
              onclick: async () => {
                const nv = await uploadOne({ accept: 'video/mp4,video/quicktime,.mp4,.mov,.m4v' });
                if (nv) {
                  obj[f.key] = nv;
                  render();
                  notify();
                }
              },
            },
            icon('upload'),
            'Upload video',
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-soft btn-sm',
              onclick: async () => {
                const nv = await promptDialog({
                  title: 'Paste a video link',
                  label: 'Video link (.mp4)',
                  placeholder: 'https://cdn.shopify.com/videos/…mp4',
                  help: 'In Shopify admin go to Content → Files, upload your MP4, then copy its link and paste it here.',
                  ok: 'Use this video',
                  validate: (s) => (/^https:\/\/\S+$/i.test(s) ? '' : 'The link should start with https://'),
                });
                if (nv) {
                  obj[f.key] = nv.trim();
                  render();
                  notify();
                }
              },
            },
            icon('link-variant'),
            'Paste link',
          ),
          v ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm btn-remove', onclick: () => ((obj[f.key] = ''), render(), notify()) }, icon('trash-can-outline'), 'Remove') : null,
        ),
      ),
    );
  };
  render();
  return wrapField(f, box, { labelFor: false });
}

function imagesField(f, obj, notify) {
  const box = h('div', { class: 'images-field' });
  const max = f.max || Infinity;
  const list = () => (Array.isArray(obj[f.key]) ? obj[f.key] : (obj[f.key] = []));
  const render = () => {
    const arr = list();
    const tiles = arr.map((v, i) =>
      h(
        'div',
        { class: 'img-tile' },
        thumb(v, 'img-tile-thumb'),
        h(
          'div',
          { class: 'img-tile-actions' },
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move left', 'aria-label': 'Move left', disabled: i === 0, onclick: () => (move(arr, i, i - 1), render(), notify()) }, icon('chevron-left')),
          h('span', { class: 'img-num' }, String(i + 1)),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move right', 'aria-label': 'Move right', disabled: i === arr.length - 1, onclick: () => (move(arr, i, i + 1), render(), notify()) }, icon('chevron-right')),
          h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Remove', 'aria-label': 'Remove photo', onclick: () => (arr.splice(i, 1), render(), notify()) }, icon('close')),
        ),
      ),
    );
    const full = arr.length >= max;
    fill(box, 
      h('div', { class: 'img-tiles' }, tiles.length ? tiles : h('p', { class: 'empty-note' }, 'No photos yet.')),
      h(
        'div',
        { class: 'images-foot' },
        full
          ? h('span', { class: 'muted' }, `That's the maximum of ${max} photos. Remove one to add another.`)
          : h(
              'div',
              { class: 'btn-row' },
              h('span', { class: 'muted add-label' }, 'Add a photo:'),
              imageButtons(async (how) => {
                const nv = await chooseImage(how);
                if (nv) {
                  list().push(nv);
                  render();
                  notify();
                }
              }),
            ),
        Number.isFinite(max) ? h('span', { class: 'count-pill' }, `${arr.length} of ${max}`) : null,
      ),
    );
  };
  render();
  return wrapField(f, box, { labelFor: false });
}

/* ───────── Links ───────── */

function linkField(f, obj, notify) {
  const id = nextId();
  const input = h('input', { id, class: 'input', type: 'text', value: obj[f.key] ?? '', placeholder: 'Pick from the list or type a link', spellcheck: 'false', autocomplete: 'off' });
  const desc = h('p', { class: 'link-desc' });
  const paintDesc = () => {
    fill(desc, icon('arrow-right-bottom'), ` Opens: ${describeLink(input.value.trim())}`);
  };
  const sel = h(
    'select',
    { class: 'input link-preset', 'aria-label': `${f.label || 'Link'} quick pick` },
    h('option', { value: '' }, 'Quick pick…'),
    LINK_PRESETS.map((p) => h('option', { value: p.value }, p.label)),
    h('option', { value: '__product' }, 'A product…'),
  );
  const set = (v) => {
    input.value = v;
    obj[f.key] = v;
    paintDesc();
    notify();
  };
  input.addEventListener('input', () => {
    obj[f.key] = input.value.trim();
    paintDesc();
    notify();
  });
  sel.addEventListener('change', async () => {
    const v = sel.value;
    sel.value = '';
    if (!v) return;
    if (v === '__product') {
      const handle = await pickProducts({ title: 'Link to a product' });
      if (handle) set(`/products/${handle}`);
    } else set(v);
  });
  paintDesc();
  if (/^\/products\//.test(input.value)) whenProducts(paintDesc);
  return wrapField(f, h('div', null, h('div', { class: 'link-row' }, input, h('div', { class: 'select-wrap' }, sel, icon('chevron-down', 'select-caret'))), desc), { id });
}

/* ───────── Products ───────── */

function productChip(handle) {
  const p = productByHandle(handle);
  return h(
    'span',
    { class: 'product-chip' },
    thumbImg(p?.image, 'basket-outline'),
    h('span', { class: 'product-text' }, h('strong', null, p ? p.title : handle), h('small', null, p ? handle : 'Not found in the shop right now')),
  );
}

function productField(f, obj, notify) {
  const box = h('div', { class: 'product-field' });
  const render = () => {
    const v = obj[f.key] || '';
    fill(box, 
      v ? productChip(v) : h('span', { class: 'muted' }, 'No product chosen'),
      h(
        'div',
        { class: 'btn-row' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-soft btn-sm',
            onclick: async () => {
              const handle = await pickProducts();
              if (handle) {
                obj[f.key] = handle;
                render();
                notify();
              }
            },
          },
          icon('basket-outline'),
          v ? 'Change' : 'Choose product',
        ),
        v ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => ((obj[f.key] = ''), render(), notify()) }, 'Clear') : null,
      ),
    );
  };
  render();
  if (obj[f.key]) whenProducts(render);
  return wrapField(f, box, { labelFor: false });
}

function productsField(f, obj, notify) {
  const box = h('div', { class: 'products-field' });
  const list = () => (Array.isArray(obj[f.key]) ? obj[f.key] : (obj[f.key] = []));
  const dnd = makeDnd(() => list(), () => (render(), notify()));
  const render = () => {
    const arr = list();
    const ul = h('div', { class: 'mini-list' });
    arr.forEach((handle, i) => {
      const row = h(
        'div',
        { class: 'mini-row' },
        h('span', { class: 'drag-handle', title: 'Drag to reorder' }, icon('drag-vertical')),
        productChip(handle),
        h(
          'span',
          { class: 'row-actions' },
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => (move(arr, i, i - 1), render(), notify()) }, icon('arrow-up')),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => (move(arr, i, i + 1), render(), notify()) }, icon('arrow-down')),
          h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Remove', 'aria-label': 'Remove product', onclick: () => (arr.splice(i, 1), render(), notify()) }, icon('close')),
        ),
      );
      dnd.attach(row, row.querySelector('.drag-handle'), i);
      add(ul, row);
    });
    fill(box, 
      arr.length ? ul : h('p', { class: 'empty-note' }, 'No products picked.'),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-soft btn-sm',
          onclick: async () => {
            const handles = await pickProducts({ multiple: true, exclude: list() });
            if (handles?.length) {
              list().push(...handles);
              render();
              notify();
            }
          },
        },
        icon('plus'),
        'Add products',
      ),
    );
  };
  render();
  if (list().length) whenProducts(render);
  return wrapField(f, box, { labelFor: false });
}

/* ───────── Small lists: colours, strings ───────── */

function colorsField(f, obj, notify) {
  const box = h('div', { class: 'colors-field' });
  const list = () => (Array.isArray(obj[f.key]) ? obj[f.key] : (obj[f.key] = ['#FFF3D6', '#E9B955']));
  const preview = h('div', { class: 'gradient-preview', 'aria-hidden': 'true' });
  const paint = () => {
    const arr = list().filter((c) => HEX.test(c));
    preview.style.background = arr.length > 1 ? `linear-gradient(135deg, ${arr.join(', ')})` : arr[0] || 'transparent';
  };
  const render = () => {
    const arr = list();
    fill(box, 
      preview,
      h(
        'div',
        { class: 'colors-row' },
        arr.map((c, i) =>
          h(
            'div',
            { class: 'color-chip' },
            colorInput(c, (v) => {
              arr[i] = v;
              paint();
              notify();
            }, { label: `Colour ${i + 1}` }),
            arr.length > 2
              ? h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Remove colour', 'aria-label': `Remove colour ${i + 1}`, onclick: () => (arr.splice(i, 1), render(), notify()) }, icon('close'))
              : null,
          ),
        ),
        arr.length < 4
          ? h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => (arr.push(arr[arr.length - 1] || '#FFFFFF'), render(), notify()) }, icon('plus'), 'Add colour')
          : null,
      ),
    );
    paint();
  };
  render();
  return wrapField(f, box, { labelFor: false });
}

function stringsField(f, obj, notify) {
  const box = h('div', { class: 'strings-field' });
  const list = () => (Array.isArray(obj[f.key]) ? obj[f.key] : (obj[f.key] = []));
  const render = (focusIndex) => {
    const arr = list();
    const rows = arr.map((s, i) => {
      const input = h('input', { type: 'text', class: 'input', value: s, 'aria-label': `${f.label} ${i + 1}` });
      input.addEventListener('input', () => {
        arr[i] = input.value;
        notify();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          arr.splice(i + 1, 0, '');
          render(i + 1);
          notify();
        }
      });
      return h(
        'div',
        { class: 'string-row' },
        input,
        h('button', { type: 'button', class: 'icon-btn sm', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => (move(arr, i, i - 1), render(), notify()) }, icon('arrow-up')),
        h('button', { type: 'button', class: 'icon-btn sm', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => (move(arr, i, i + 1), render(), notify()) }, icon('arrow-down')),
        h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Remove', 'aria-label': 'Remove', onclick: () => (arr.splice(i, 1), render(), notify()) }, icon('close')),
      );
    });
    fill(box, 
      h('div', { class: 'string-rows' }, rows),
      h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => (arr.push(''), render(arr.length - 1), notify()) }, icon('plus'), 'Add'),
    );
    if (focusIndex != null) box.querySelectorAll('.string-row input')[focusIndex]?.focus();
  };
  render();
  return wrapField(f, box, { labelFor: false });
}

/* ───────── Group ───────── */

function groupField(f, obj, notify) {
  if (!obj[f.key] || typeof obj[f.key] !== 'object') obj[f.key] = {};
  return h(
    'fieldset',
    { class: 'field field-group', dataset: { key: f.key } },
    h('legend', null, f.label),
    f.help ? h('p', { class: 'help' }, f.help) : null,
    renderFields(f.fields || [], obj[f.key], notify),
  );
}

/* ───────── Drag & drop reorder (handle-only) ───────── */

let dragging = null; // { token, from }

/**
 * Lets rows be reordered by dragging their handle. getArr() returns the live array,
 * after() runs after a move. Rows are only draggable while the handle is held, so text
 * inside them can still be selected.
 */
function makeDnd(getArr, after) {
  const token = {};
  return {
    attach(row, handle, index) {
      if (!handle) return;
      handle.addEventListener('pointerdown', () => (row.draggable = true));
      const off = () => (row.draggable = false);
      handle.addEventListener('pointerup', off);
      row.addEventListener('dragstart', (e) => {
        if (!row.draggable) return;
        e.stopPropagation();
        dragging = { token, from: index };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        requestAnimationFrame(() => row.classList.add('dragging'));
      });
      row.addEventListener('dragend', (e) => {
        e.stopPropagation();
        off();
        row.classList.remove('dragging');
        document.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
        dragging = null;
      });
      row.addEventListener('dragover', (e) => {
        if (dragging?.token !== token) return;
        e.preventDefault();
        e.stopPropagation();
        const r = row.getBoundingClientRect();
        const before = e.clientY < r.top + r.height / 2;
        row.classList.toggle('drop-before', before);
        row.classList.toggle('drop-after', !before);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-before', 'drop-after'));
      row.addEventListener('drop', (e) => {
        if (dragging?.token !== token) return;
        e.preventDefault();
        e.stopPropagation();
        const r = row.getBoundingClientRect();
        const before = e.clientY < r.top + r.height / 2;
        const from = dragging.from;
        let to = before ? index : index + 1;
        if (from < to) to--;
        dragging = null;
        if (from !== to) {
          move(getArr(), from, to);
          after();
        } else row.classList.remove('drop-before', 'drop-after');
      });
    },
  };
}

/* ───────── List of cards ───────── */

function displayValue(key, item, fields) {
  const v = item?.[key];
  if (isEmpty(v)) return '';
  const f = fields.find((x) => x.key === key);
  if (f?.type === 'select') {
    const o = f.options?.find((x) => x.value === v);
    return o ? o.label.replace(/\s*\(.*\)\s*$/, '') : String(v);
  }
  if (f?.type === 'product') return productByHandle(v)?.title || String(v);
  if (f?.type === 'category') return categoryOptions().find((o) => o.value === v)?.label || String(v);
  if (typeof v === 'object') return '';
  return String(v);
}

/** "{title|type}" → first non-empty of title, type. Empty string when nothing filled in. */
export function itemLabel(tpl, item, fields) {
  if (!tpl) return '';
  let any = false;
  const out = tpl.replace(/\{([^}]+)\}/g, (_, expr) => {
    for (const k of expr.split('|')) {
      const v = displayValue(k.trim(), item, fields);
      if (v) {
        any = true;
        return v;
      }
    }
    return '';
  });
  return any ? out.replace(/\s+/g, ' ').replace(/^[\s—–\-·]+|[\s—–\-·]+$/g, '').trim() : '';
}

function itemThumbValue(item, fields) {
  for (const f of fields) {
    if (!isShown(f, item)) continue;
    const v = item?.[f.key];
    if (f.type === 'image' && v) return v;
    if (f.type === 'images' && Array.isArray(v) && v[0]) return v[0];
    if (f.type === 'product' && v) return `product:${v}`;
  }
  return '';
}

function itemBadges(item) {
  const out = [];
  if (item?.enabled === false) out.push(['Hidden', 'off']);
  if (item?.hidden === true) out.push(['Hidden from app', 'off']);
  const now = Date.now();
  if (item?.endAt && new Date(item.endAt).getTime() < now) out.push(['Ended', 'off']);
  else if (item?.startAt && new Date(item.startAt).getTime() > now) out.push(['Scheduled', 'sched']);
  return out;
}

function listField(f, obj, notify) {
  const fields = f.fields || [];
  const list = () => (Array.isArray(obj[f.key]) ? obj[f.key] : (obj[f.key] = []));
  const items = h('div', { class: 'list-items' });
  const count = h('span', { class: 'count-pill' });
  const addBtn = h('button', { type: 'button', class: 'btn btn-add' });
  const max = f.max || Infinity;
  const usesTpl = new Set([...(f.itemLabel || '').matchAll(/\{([^}]+)\}/g)].flatMap((m) => m[1].split('|')));
  const dnd = makeDnd(list, () => (render(), notify()));

  function card(item, i, arr) {
    const body = h('div', { class: 'item-body' });
    const title = h('span', { class: 'item-title' });
    const sub = h('span', { class: 'item-sub' });
    const badges = h('span', { class: 'item-badges' });
    const thumbSlot = h('span', { class: 'item-thumb-slot' });
    const chevron = icon('chevron-down', 'chev');
    const toggle = h('button', { type: 'button', class: 'item-toggle', 'aria-expanded': 'false' }, thumbSlot, h('span', { class: 'item-text' }, title, sub), badges);
    const label = () => itemLabel(f.itemLabel, item, fields) || 'Untitled';

    const paintHead = () => {
      const l = itemLabel(f.itemLabel, item, fields);
      title.textContent = l || 'Untitled';
      title.classList.toggle('untitled', !l);
      // A short "kind" line from the first select field not already in the title.
      const sf = fields.find((x) => x.type === 'select' && !usesTpl.has(x.key) && isShown(x, item));
      const sv = sf ? displayValue(sf.key, item, fields) : '';
      const typeShown = fields.find((x) => x.type === 'select' && usesTpl.has(x.key));
      sub.textContent = sv || (typeShown && l !== displayValue(typeShown.key, item, fields) ? displayValue(typeShown.key, item, fields) : '');
      fill(badges, itemBadges(item).map(([t, k]) => h('span', { class: `badge badge-${k}` }, t)));
      const tv = itemThumbValue(item, fields);
      fill(thumbSlot, tv ? thumb(tv, 'item-thumb') : null);
    };

    const el = h(
      'div',
      { class: 'item-card' },
      h(
        'div',
        { class: 'item-head' },
        h('span', { class: 'drag-handle', title: 'Drag to reorder' }, icon('drag-vertical')),
        toggle,
        h(
          'span',
          { class: 'item-actions' },
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => (move(arr, i, i - 1), render(), notify()) }, icon('arrow-up')),
          h('button', { type: 'button', class: 'icon-btn sm', title: 'Move down', 'aria-label': 'Move down', disabled: i === arr.length - 1, onclick: () => (move(arr, i, i + 1), render(), notify()) }, icon('arrow-down')),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm',
              title: 'Duplicate',
              'aria-label': 'Duplicate',
              disabled: arr.length >= max,
              onclick: () => {
                const copy = clone(item);
                if (f.autoId && copy) copy.id = '';
                arr.splice(i + 1, 0, copy);
                openItems.add(copy);
                render();
                notify();
              },
            },
            icon('content-copy'),
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm danger',
              title: 'Delete',
              'aria-label': 'Delete',
              onclick: async () => {
                if (!(await confirmDialog(`"${label()}" will be removed. You can still undo this by pressing Discard changes before you publish.`, { title: 'Delete this item?', ok: 'Delete', danger: true }))) return;
                const at = arr.indexOf(item);
                if (at >= 0) arr.splice(at, 1);
                render();
                notify();
              },
            },
            icon('trash-can-outline'),
          ),
          h('button', { type: 'button', class: 'icon-btn sm chev-btn', title: 'Open / close', 'aria-label': 'Open or close', onclick: () => toggle.click() }, chevron),
        ),
      ),
      body,
    );

    let built = false;
    const setOpen = (open) => {
      el.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
      if (open && !built) {
        built = true;
        add(body, renderFields(fields, item, () => (paintHead(), notify())));
      }
      open ? openItems.add(item) : openItems.delete(item);
    };
    toggle.addEventListener('click', () => setOpen(!el.classList.contains('open')));
    paintHead();
    if (item && typeof item === 'object' && fields.some((x) => x.type === 'product' || x.type === 'category')) whenProducts(paintHead);
    setOpen(item && typeof item === 'object' && openItems.has(item));
    dnd.attach(el, el.querySelector('.drag-handle'), i);
    return el;
  }

  function render() {
    const arr = list();
    clear(items);
    arr.forEach((item, i) => {
      if (!item || typeof item !== 'object') arr[i] = {};
      add(items, card(arr[i], i, arr));
    });
    if (!arr.length) add(items, h('p', { class: 'empty-note' }, 'Nothing here yet.'));
    count.textContent = Number.isFinite(max) ? `${arr.length} of ${max}` : `${arr.length} item${arr.length === 1 ? '' : 's'}`;
    const full = arr.length >= max;
    addBtn.disabled = full;
    fill(addBtn, icon(full ? 'check' : 'plus'), full ? `Maximum of ${max} reached` : 'Add new');
  }

  addBtn.addEventListener('click', () => {
    const arr = list();
    if (arr.length >= max) return;
    const item = f.newItem ? clone(f.newItem) : {};
    arr.push(item);
    openItems.add(item);
    render();
    notify();
    const last = items.lastElementChild;
    last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => last?.querySelector('.item-body input:not([type=checkbox]), .item-body textarea, .item-body select')?.focus({ preventScroll: true }), 300);
  });

  render();
  return h(
    'div',
    { class: 'field field-list', dataset: { key: f.key } },
    h('div', { class: 'list-head' }, h('span', { class: 'field-label' }, f.label), count),
    f.help ? h('p', { class: 'help' }, f.help) : null,
    items,
    addBtn,
  );
}
