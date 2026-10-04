/**
 * Visual editing inside the admin panel's phone preview (web only, never in the real app).
 *
 * Hover highlights anything marked with <Editable>; clicking selects it and tells the
 * admin panel, which opens its settings. Selected home sections get a toolbar
 * (drag to reorder, up/down, duplicate, delete, add below); resizable elements get
 * a handle you drag to make them taller or shorter.
 */
type Post = (msg: Record<string, unknown>) => void;

const BRAND = '#A56312';

export function startEditOverlay(post: Post) {
  let editing = true;
  let selectedId: string | null = null;
  let hoverEl: HTMLElement | null = null;
  let drag: null | { kind: 'move'; from: number; to: number } | { kind: 'resize'; startY: number; startH: number; base: number; invert: boolean; target: string; last: number } = null;

  const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);
  const div = (s: Partial<CSSStyleDeclaration> = {}) => {
    const d = document.createElement('div');
    css(d, s);
    return d;
  };

  const layer = div({ position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483646' });
  layer.id = 'rosier-edit-layer';
  const hoverBox = div({ position: 'fixed', border: `1.5px dashed ${BRAND}`, borderRadius: '10px', display: 'none', background: 'rgba(165,99,18,0.05)' });
  const selBox = div({ position: 'fixed', border: `2px solid ${BRAND}`, borderRadius: '12px', display: 'none', boxShadow: '0 0 0 4px rgba(165,99,18,0.18)' });
  const tag = div({ position: 'absolute', left: '-2px', top: '-24px', background: BRAND, color: '#fff', font: '600 11px/22px Poppins, system-ui, sans-serif', padding: '0 8px', borderRadius: '6px 6px 6px 0', whiteSpace: 'nowrap' });
  selBox.appendChild(tag);
  const hoverTag = div({ position: 'absolute', left: '-1px', top: '-20px', background: 'rgba(165,99,18,0.85)', color: '#fff', font: '500 10px/18px Poppins, system-ui, sans-serif', padding: '0 6px', borderRadius: '5px', whiteSpace: 'nowrap' });
  hoverBox.appendChild(hoverTag);

  const btn = (label: string, title: string, onClick: () => void, extra: Partial<CSSStyleDeclaration> = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    css(b, { pointerEvents: 'auto', whiteSpace: 'nowrap', border: '0', background: '#3E2415', color: '#FBE6CF', font: '600 12px Poppins, system-ui, sans-serif', height: '28px', minWidth: '28px', padding: '0 8px', borderRadius: '8px', cursor: 'pointer', ...extra });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  };

  // Toolbar for home sections
  const toolbar = div({ position: 'fixed', display: 'none', gap: '4px', padding: '4px', background: '#fff', borderRadius: '10px', boxShadow: '0 6px 20px rgba(62,36,21,0.25)', pointerEvents: 'auto' });
  const grip = btn('⠿ Drag', 'Drag to move this section', () => {}, { cursor: 'grab' });
  const action = (a: string) => () => selectedId && post({ type: 'rosier:action', action: a, id: selectedId });
  toolbar.append(grip, btn('↑', 'Move up', action('up')), btn('↓', 'Move down', action('down')), btn('⧉', 'Duplicate', action('duplicate')), btn('🗑', 'Delete', action('delete'), { background: '#B3261E' }));
  const addBtn = btn('+ Add section below', 'Add a new section here', action('add'), { position: 'fixed', display: 'none', background: BRAND, color: '#fff', borderRadius: '14px', height: '28px', padding: '0 12px', boxShadow: '0 6px 16px rgba(165,99,18,0.35)' });
  const handle = btn('↕', 'Drag to resize', () => {}, { position: 'fixed', display: 'none', width: '44px', height: '18px', minWidth: '0', padding: '0', borderRadius: '9px', background: BRAND, color: '#fff', font: '700 11px/18px system-ui', cursor: 'ns-resize' });
  const sizeTip = div({ position: 'fixed', display: 'none', background: '#3E2415', color: '#FBE6CF', font: '600 11px/20px Poppins, system-ui', padding: '0 8px', borderRadius: '6px' });
  const dropLine = div({ position: 'fixed', display: 'none', height: '4px', background: BRAND, borderRadius: '2px', boxShadow: '0 0 0 3px rgba(165,99,18,0.2)' });
  layer.append(hoverBox, selBox, toolbar, addBtn, handle, sizeTip, dropLine);
  document.body.appendChild(layer);

  const find = (id: string) => document.querySelector<HTMLElement>(`[data-edit="${CSS.escape(id)}"]`);
  const editableFrom = (t: EventTarget | null) => (t instanceof Element ? (t.closest('[data-edit]') as HTMLElement | null) : null);
  const sectionIndex = (id: string | null) => {
    const m = id?.match(/^home\.sections\.(\d+)$/);
    return m ? Number(m[1]) : null;
  };
  const sectionEls = () =>
    [...document.querySelectorAll<HTMLElement>('[data-edit^="home.sections."]')]
      .map((el) => ({ el, i: sectionIndex(el.dataset.edit ?? null) }))
      .filter((x): x is { el: HTMLElement; i: number } => x.i != null);

  const place = (box: HTMLElement, r: DOMRect) => css(box, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });

  function frame() {
    if (editing && hoverEl && hoverEl.isConnected && hoverEl.dataset.edit !== selectedId && !drag) {
      place(hoverBox, hoverEl.getBoundingClientRect());
      hoverTag.textContent = hoverEl.dataset.editLabel || '';
    } else hoverBox.style.display = 'none';

    const el = editing && selectedId ? find(selectedId) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      place(selBox, r);
      tag.textContent = el.dataset.editLabel || '';
      const isSection = sectionIndex(selectedId) != null;
      css(toolbar, { display: isSection ? 'flex' : 'none', left: `${Math.max(4, r.right - 190)}px`, top: `${Math.max(4, r.top + 6)}px` });
      css(addBtn, { display: isSection ? 'block' : 'none', left: `${r.left + r.width / 2 - 80}px`, top: `${r.bottom - 14}px` });
      const canResize = !!el.dataset.editTarget;
      css(handle, { display: canResize ? 'block' : 'none', left: `${r.left + r.width / 2 - 22}px`, top: `${r.bottom - 9}px` });
      if (canResize && isSection) addBtn.style.top = `${r.bottom + 12}px`;
    } else {
      for (const x of [selBox, toolbar, addBtn, handle]) x.style.display = 'none';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const inLayer = (t: EventTarget | null) => t instanceof Node && layer.contains(t);

  // Swallow taps so buttons/links in the app don't fire while editing.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    window.addEventListener(
      type,
      (e) => {
        if (!editing || inLayer(e.target)) return;
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      true,
    );
  }
  window.addEventListener(
    'click',
    (e) => {
      if (!editing || inLayer(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const el = editableFrom(e.target);
      if (el?.dataset.edit) {
        selectedId = el.dataset.edit;
        post({ type: 'rosier:select', id: selectedId, label: el.dataset.editLabel || '' });
      } else {
        selectedId = null;
        post({ type: 'rosier:select', id: `page:${location.pathname.replace(/^\/preview-app/, '') || '/'}`, label: 'This screen' });
      }
    },
    true,
  );
  window.addEventListener('pointermove', (e) => {
    if (drag) return onDrag(e);
    hoverEl = editing ? editableFrom(e.target) : null;
  });
  window.addEventListener('pointerleave', () => (hoverEl = null));

  // Drag to reorder sections
  grip.addEventListener('pointerdown', (e) => {
    const from = sectionIndex(selectedId);
    if (from == null) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { kind: 'move', from, to: from };
    grip.setPointerCapture?.(e.pointerId);
  });
  // Drag to resize
  handle.addEventListener('pointerdown', (e) => {
    const el = selectedId ? find(selectedId) : null;
    if (!el?.dataset.editTarget) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    drag = { kind: 'resize', startY: e.clientY, startH: r.height, base: Number(el.dataset.editBase) || 1, invert: el.dataset.editInvert === '1', target: el.dataset.editTarget, last: 0 };
    handle.setPointerCapture?.(e.pointerId);
  });

  function onDrag(e: PointerEvent) {
    if (!drag) return;
    if (drag.kind === 'move') {
      const els = sectionEls();
      let to = els.length ? els[els.length - 1].i + 1 : 0;
      let lineY = els.length ? els[els.length - 1].el.getBoundingClientRect().bottom : 0;
      for (const { el, i } of els) {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          to = i;
          lineY = r.top;
          break;
        }
      }
      drag.to = to;
      const w = document.documentElement.clientWidth;
      css(dropLine, { display: 'block', left: '12px', width: `${w - 24}px`, top: `${lineY - 2}px` });
      // Scroll while dragging near the edges.
      const sc = findScroller();
      if (sc) {
        if (e.clientY < 90) sc.scrollTop -= 12;
        if (e.clientY > window.innerHeight - 90) sc.scrollTop += 12;
      }
    } else {
      const newH = Math.max(40, drag.startH + (e.clientY - drag.startY));
      const value = drag.invert ? (drag.base * drag.startH) / newH : (drag.base * newH) / drag.startH;
      css(sizeTip, { display: 'block', left: `${e.clientX + 14}px`, top: `${e.clientY - 10}px` });
      sizeTip.textContent = `${Math.round(newH)} px tall`;
      const now = Date.now();
      if (now - drag.last > 60) {
        drag.last = now;
        post({ type: 'rosier:resize', target: drag.target, value });
      }
      (drag as any).value = value;
    }
  }

  window.addEventListener(
    'pointerup',
    () => {
      if (!drag) return;
      if (drag.kind === 'move') {
        if (drag.to !== drag.from && drag.to !== drag.from + 1) {
          post({ type: 'rosier:action', action: 'move', id: selectedId, to: drag.to });
          const finalIndex = drag.to > drag.from ? drag.to - 1 : drag.to;
          selectedId = `home.sections.${finalIndex}`;
        }
      } else if ((drag as any).value != null) {
        post({ type: 'rosier:resize', target: drag.target, value: (drag as any).value, done: true });
      }
      drag = null;
      dropLine.style.display = 'none';
      sizeTip.style.display = 'none';
    },
    true,
  );

  function findScroller(): HTMLElement | null {
    const all = [...document.querySelectorAll<HTMLElement>('div')].filter((d) => {
      const s = getComputedStyle(d);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 10;
    });
    return all.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] ?? null;
  }

  return {
    setEditing(on: boolean) {
      editing = on;
      if (!on) hoverEl = null;
    },
    select(id: string | null) {
      selectedId = id && !id.startsWith('page:') ? id : null;
      const el = selectedId ? find(selectedId) : null;
      el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    },
  };
}
