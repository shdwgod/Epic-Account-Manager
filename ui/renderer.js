'use strict';

/* ------------------------------------------------------------------ helpers */
const $ = (sel) => document.querySelector(sel);
const t = (key, vars) => I18N.t(key, vars);

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const SVG = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICONS = {
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  gear: SVG('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  chevronLeft: SVG('<path d="m15 18-6-6 6-6"/>'),
  dots: SVG('<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>'),
  swap: SVG('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  pencil: SVG('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash: SVG('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  shield: SVG('<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>'),
  check: SVG('<path d="M20 6 9 17l-5-5"/>'),
  alert: SVG('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  search: SVG('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
  play: SVG('<polygon points="6 3 20 12 6 21 6 3"/>'),
  refresh: SVG('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
  pin: SVG('<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>'),
  grid: SVG('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  list: SVG('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>'),
  chevron: SVG('<path d="m6 9 6 6 6-6"/>'),
  image: SVG('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
  folder: SVG('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
};
function icon(name) {
  const s = document.createElement('span');
  s.style.display = 'inline-flex';
  s.innerHTML = ICONS[name];
  return s;
}

/* UI-only preferences live in localStorage (the profile data stays in the Rust core). */
const prefs = (() => {
  const defaults = { sort: 'used' };
  let data = { ...defaults };
  try { data = { ...defaults, ...JSON.parse(localStorage.getItem('eam.prefs') || '{}') }; } catch { /* ignore */ }
  return {
    sort: ['used', 'name', 'saved'].includes(data.sort) ? data.sort : defaults.sort,
    save() { try { localStorage.setItem('eam.prefs', JSON.stringify({ sort: this.sort })); } catch { /* ignore */ } },
  };
})();

/* ------------------------------------------------------------------- state */
let state = { profiles: [], settings: {}, version: '' };
let session = null; // { username, activeProfile, epicRunning } from the `status` command
let query = '';
let busy = false;
let statusSeq = 0;
let view = 'home'; // 'home' | 'settings'
let openDialogCtl = null;
let managing = false;    // "Manage accounts": tiles open the editor instead of switching
let introPending = true; // the tiles rise in once, on the first render with accounts

const HUES = [8, 32, 48, 140, 175, 210, 262, 320];

const hashOf = (str) => { let n = 5381; for (const ch of str) n = ((n << 5) + n + ch.charCodeAt(0)) | 0; return Math.abs(n); };
let autoHues = new Map(); // account id -> colour, for accounts whose owner has not picked one

/* An account keeps the colour its owner picked. The others get one from the same set: stable per account, and
   different from each other for as long as there are free colours. */
function computeAutoHues() {
  const taken = new Set(state.profiles.filter((p) => p.hue != null).map((p) => p.hue));
  const byAge = state.profiles.filter((p) => p.hue == null).sort((a, b) => stamp(a.saved) - stamp(b.saved) || a.name.localeCompare(b.name));
  autoHues = new Map();
  for (const p of byAge) {
    const key = p.username || p.name;
    let i = hashOf(key) % HUES.length;
    for (let n = 0; n < HUES.length && taken.has(HUES[i]); n++) i = (i + 1) % HUES.length;
    autoHues.set(key, HUES[i]);
    taken.add(HUES[i]);
  }
}
const hueOf = (p) => p.hue ?? autoHues.get(p.username || p.name) ?? HUES[hashOf(p.username || p.name || '') % HUES.length];

const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLowerCase();
const stamp = (s) => { const n = s ? new Date(s.replace(' ', 'T')).getTime() : 0; return Number.isNaN(n) ? 0 : n; };
const shortId = (u) => (u && u.length > 12 ? `${u.slice(0, 4)}…${u.slice(-4)}` : u || '');
const activeProfile = () => state.profiles.find((p) => p.name === session?.activeProfile) || null;
const launcherFound = () => !!state.settings.resolvedEpicPath;

function ago(s) {
  const ms = stamp(s);
  if (!ms) return '';
  const diff = (ms - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return t('rel.now');
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(ms).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function avatarEl(p, cls = '') {
  const el = h('div', { class: `avatar ${cls}` }, p.avatar ? h('img', { src: p.avatar, alt: '' }) : (p.name.trim().charAt(0) || '?'));
  el.style.setProperty('--h', hueOf(p));
  return el;
}

/* The background glow takes the colour of the hovered account and rests on the active one. */
function setGlow(hue) {
  const el = $('#ambient');
  if (hue != null) { el.style.setProperty('--gh', hue); el.className = 'ambient on'; return; }
  const act = activeProfile();
  if (act) el.style.setProperty('--gh', hueOf(act));
  el.className = act ? 'ambient idle' : 'ambient';
}

/* --------------------------------------------------------------------- api */
async function rpc(promise) {
  try {
    const res = await promise;
    return res.ok ? { ok: true, data: res.data } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
async function call(promise) {
  const r = await rpc(promise);
  if (!r.ok) { toast(r.error, 'err'); return null; }
  return r.data;
}
function applyState(data) {
  state = { profiles: data.profiles, settings: data.settings, version: data.version || state.version };
  computeAutoHues();
  renderAll();
}

/* ---------------------------------------------------------- busy / toasts */
function setBusy(on, title = '', sub = '', profile = null) {
  busy = on;
  $('#busy').hidden = !on;
  $('#shell').inert = on || !!openDialogCtl;
  $('#dialogs').inert = on;
  if (!on) return;
  $('#busyText').textContent = title;
  $('#busySub').textContent = sub;
  $('#busyArt').replaceChildren(profile ? avatarEl(profile) : '');
}

function toast(message, type = 'ok', action = null) {
  const el = h('div', { class: `toast ${type}` }, icon(type === 'ok' ? 'check' : 'alert'), h('span', {}, message));
  const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 320); };
  if (action) el.append(h('button', { type: 'button', onclick: () => { action.run(); dismiss(); } }, action.label));
  $('#toasts').append(el);
  setTimeout(dismiss, action ? 7000 : type === 'ok' ? 3200 : 5600);
}

/* ------------------------------------------------------------------ dialogs */
function openDialog({ title, hint, children = [], confirm, danger = false, hideCancel = false, extra = null, onSubmit }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const err = h('p', { class: 'form-error', role: 'alert' });
    const okBtn = h('button', { type: 'submit', class: `btn ${danger ? 'danger' : 'primary'}` }, confirm);
    const form = h('form', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, novalidate: true },
      h('h2', {}, title),
      hint ? h('p', { class: 'hint' }, hint) : null,
      ...children, err,
      h('div', { class: 'dialog-actions' },
        extra ? h('div', { class: 'dialog-extra' }, extra) : null,
        hideCancel ? null : h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, t('common.cancel')),
        okBtn));
    const backdrop = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === backdrop && !busy) close(null); } }, form);
    let done = false;

    const ctl = {
      okBtn, form,
      error: (m) => { err.textContent = m || ''; },
      focus: () => (form.querySelector('input:not([type=checkbox]):not([readonly])') || okBtn).focus(),
      setConfirm(text, isDanger) { okBtn.textContent = text; okBtn.classList.toggle('danger', !!isDanger); okBtn.classList.toggle('primary', !isDanger); },
      close,
    };
    function close(value) {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (openDialogCtl === ctl) openDialogCtl = null;
      $('#shell').inert = busy;
      if (previous && previous.isConnected) previous.focus();
      resolve(value);
    }
    function onKey(e) {
      if (busy) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      else if (e.key === 'Tab') {
        const f = [...form.querySelectorAll('button, input, select')].filter((x) => !x.disabled && !x.closest('[hidden]') && x.tabIndex >= 0);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      ctl.error('');
      const result = onSubmit ? await onSubmit(ctl) : true;
      if (result !== false) close(result ?? true);
    });

    openDialogCtl = ctl;
    $('#shell').inert = true;
    $('#dialogs').append(backdrop);
    document.addEventListener('keydown', onKey, true);
    ctl.focus();
  });
}

function textField(label, { value = '', placeholder = '', readonly = false } = {}) {
  const input = h('input', { type: 'text', value, placeholder, autocomplete: 'off', spellcheck: 'false', readonly });
  return { input, el: h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'input-wrap' }, input)) };
}
/* -------------------------------------------------------------------- menu */
function closeMenu() {
  $('#menuRoot').replaceChildren();
  document.querySelectorAll('.tile.menu-open').forEach((x) => x.classList.remove('menu-open'));
}
function openMenu(items, x, y, tile) {
  closeMenu();
  const menu = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it === 'sep') { menu.append(h('hr')); continue; }
    menu.append(h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', onclick: () => { closeMenu(); it.run(); } }, icon(it.icon), it.label));
  }
  $('#menuRoot').append(menu);
  tile?.classList.add('menu-open');
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  const btns = [...menu.querySelectorAll('button')];
  btns[0]?.focus();
  menu.addEventListener('keydown', (e) => {
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeMenu(); tile?.querySelector('.tile-menu')?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); tile?.querySelector('.tile-menu')?.focus(); }
  });
}
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu')) closeMenu(); });
window.addEventListener('blur', closeMenu);
window.addEventListener('resize', closeMenu);

function profileMenu(p, x, y, tile) {
  openMenu([
    { icon: 'pencil', label: t('menu.edit'), run: () => doEdit(p) },
    { icon: 'pin', label: t(p.pinned ? 'menu.unpin' : 'menu.pin'), run: () => doPin(p) },
    { icon: 'refresh', label: t('menu.refresh'), run: () => doRefresh(p) },
    'sep',
    { icon: 'trash', label: t('common.delete'), danger: true, run: () => doDelete(p) },
  ], x, y, tile);
}

/* ---------------------------------------------------------------- rendering */
const SEARCH_MIN = 6; // search only appears once the list is long enough to need it

function syncSearch() { $('#searchWrap').classList.toggle('filled', !!query); }

function setManaging(on) {
  managing = on;
  renderStatic();
  renderGrid();
}

function renderStatic() {
  $('#btnSettings').replaceChildren(icon('gear'));
  $('#btnSettings').title = t('bar.settings');
  $('#btnSettings').setAttribute('aria-label', t('bar.settings'));
  $('#searchIcon').innerHTML = ICONS.search;
  $('#search').placeholder = t('toolbar.search');
  $('#search').setAttribute('aria-label', t('toolbar.search'));
  $('#viewHome').classList.toggle('managing', managing);
  $('#pageTitle').textContent = t(managing ? 'manage.title' : 'page.title');
  $('#btnManage').textContent = t(managing ? 'manage.exit' : 'manage.enter');
}

function renderSession() {
  const el = $('#session');
  if (!session) { el.replaceChildren(h('span', { class: 'skeleton pulse' }, t('session.checking'))); return; }
  const running = session.epicRunning;
  const act = activeProfile();

  // One capsule, three kinds of segment: Launcher state, who is signed in, what you can do about it.
  const info = [h('span', { class: `seg chip${running ? ' on' : ''}` }, h('span', { class: 'dot' }), t(running ? 'session.running' : 'session.closed'))];
  if (!launcherFound()) info.push(h('button', { type: 'button', class: 'seg chip warn', onclick: openSettings }, t('session.notFound')));
  const actions = [];
  if (act) {
    info.push(h('span', { class: 'seg' }, t('session.active', { name: act.name })));
    actions.push(action(t('session.refresh'), 'refresh', () => doRefresh(act)));
  } else if (session.username) {
    info.push(h('span', { class: 'seg' }, t('session.unsaved', { id: session.displayName || shortId(session.username) })));
    actions.push(action(t('session.saveThis'), 'plus', () => doSave(), true));
  } else {
    info.push(h('span', { class: 'seg' }, t('session.out')));
  }
  if (actions.length) info.push(h('span', { class: 'status-actions' }, ...actions));
  el.replaceChildren(...info);
}

function visibleProfiles() {
  const q = fold(query.trim());
  const by = {
    name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
    used: (a, b) => stamp(b.lastUsed) - stamp(a.lastUsed) || by.name(a, b),
    saved: (a, b) => stamp(b.saved) - stamp(a.saved) || by.name(a, b),
  };
  return state.profiles
    .filter((p) => !q || fold(p.name).includes(q))
    .sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || by[prefs.sort](a, b));
}

function renderTile(p, index, animate) {
  const active = p.name === session?.activeProfile;
  const tile = h('article', { class: `tile${active ? ' active' : ''}${animate ? ' enter' : ''}`, role: 'listitem', 'data-name': p.name });
  tile.style.setProperty('--h', hueOf(p));
  tile.style.setProperty('--i', index);

  const meta = p.legacy
    ? h('span', { class: 'tile-meta warn', title: t('tile.legacy') }, icon('alert'), t('tile.legacyShort'))
    : h('span', { class: 'tile-meta', title: p.saved || '' }, p.lastUsed ? t('tile.used', { when: ago(p.lastUsed) }) : t('tile.neverUsed'));

  const art = h('span', { class: 'tile-art' },
    p.avatar ? h('img', { src: p.avatar, alt: '' }) : h('span', { class: 'tile-initial' }, p.name.trim().charAt(0) || '?'),
    h('span', { class: 'tile-sheen' }),
    active ? h('span', { class: 'tile-badge' }, h('span', { class: 'dot' }), t('tile.active')) : h('span', { class: 'tile-switch' }, icon('swap'), t('tile.switchCue')),
    h('span', { class: 'tile-edit' }, icon('pencil')));
  art.addEventListener('pointermove', (e) => {
    const r = art.getBoundingClientRect();
    art.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    art.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
  });

  const main = h('button', { type: 'button', class: 'tile-main', 'aria-label': t(managing ? 'tile.edit' : 'tile.switch', { name: p.name }), onclick: () => (managing ? doEdit(p) : doSwitch(p)) },
    art,
    h('span', { class: 'tile-name', title: p.name }, h('span', { class: 'tile-name-text' }, p.name), p.pinned ? h('span', { class: 'flag', title: t('tile.pinned') }, icon('pin')) : null),
    meta);

  const more = h('button', { type: 'button', class: 'tile-menu', 'aria-label': t('tile.more'), 'aria-haspopup': 'menu' }, icon('dots'));
  more.addEventListener('click', (e) => { e.stopPropagation(); const r = more.getBoundingClientRect(); profileMenu(p, r.right - 210, r.bottom + 4, tile); });
  tile.addEventListener('contextmenu', (e) => { e.preventDefault(); profileMenu(p, e.clientX, e.clientY, tile); });
  tile.addEventListener('pointerenter', () => setGlow(hueOf(p)));
  tile.addEventListener('pointerleave', () => setGlow(null));
  main.addEventListener('focus', () => { if (main.matches(':focus-visible')) setGlow(hueOf(p)); });
  main.addEventListener('blur', () => setGlow(null));

  tile.append(main, more);
  return tile;
}

/* The last tile: saves the account the Launcher is signed in to, or explains how to add one. */
function renderAddTile(index, animate) {
  const unsaved = !!session?.username && !activeProfile();
  const label = unsaved ? t('tile.saveNamed', { name: session.displayName || shortId(session.username) }) : t('tile.add');
  const main = h('button', { type: 'button', class: 'tile-main', 'aria-label': label, onclick: unsaved ? () => doSave() : showAddHelp },
    h('span', { class: 'tile-art' }, icon('plus')),
    h('span', { class: 'tile-name', title: label }, h('span', { class: 'tile-name-text' }, label)));
  const tile = h('article', { class: `tile add${unsaved ? ' cta' : ''}${animate ? ' enter' : ''}`, role: 'listitem' }, main);
  tile.style.setProperty('--i', index);
  return tile;
}

function renderGrid() {
  const focused = document.activeElement?.closest?.('.tile')?.dataset.name;
  const list = visibleProfiles();
  const animate = introPending && list.length > 0;
  const tiles = list.map((p, i) => renderTile(p, i, animate));
  if (!query) tiles.push(renderAddTile(list.length, animate));
  const grid = $('#grid');
  grid.replaceChildren(...tiles);
  if (animate) introPending = false;
  if (focused) grid.querySelector(`.tile[data-name="${CSS.escape(focused)}"] .tile-main`)?.focus();
  setGlow(null);
}

function renderSteps() {
  return h('ol', { class: 'steps' }, h('li', {}, t('empty.step1')), h('li', {}, t('empty.step2')), h('li', {}, t('empty.step3')));
}

function showAddHelp() {
  if (busy || openDialogCtl) return;
  openDialog({ title: t('add.title'), hint: t('empty.text'), children: [renderSteps()], confirm: t('common.done'), hideCancel: true });
}

function renderEmpty() {
  const total = state.profiles.length;
  const noMatch = total > 0 && visibleProfiles().length === 0;
  const empty = $('#empty');
  if (total < SEARCH_MIN && query) { query = ''; $('#search').value = ''; syncSearch(); } // search is hidden, so a stale filter must not linger
  if (total === 0 && managing) { managing = false; renderStatic(); }
  empty.hidden = !(total === 0 || noMatch);
  $('#searchWrap').hidden = total < SEARCH_MIN;
  $('#btnManage').hidden = total === 0;
  $('#grid').hidden = total === 0 || noMatch;
  if (empty.hidden) return;
  if (total === 0) {
    empty.replaceChildren(
      h('h2', {}, t('empty.title')), h('p', {}, t('empty.text')), renderSteps(),
      h('button', { type: 'button', class: 'btn primary', onclick: () => doSave() }, icon('plus'), t('bar.save')));
  } else {
    empty.replaceChildren(h('h2', {}, t('empty.none', { q: query.trim() })),
      h('button', { type: 'button', class: 'btn outline', onclick: () => { query = ''; $('#search').value = ''; syncSearch(); renderAll(); } }, t('empty.clear')));
  }
}

function renderAll() {
  renderStatic();
  renderSession();
  renderGrid();
  renderEmpty();
}

/* ----------------------------------------------------------------- status */
async function refreshStatus() {
  if (busy || document.hidden) return;
  const seq = ++statusSeq;
  const res = await rpc(window.api.status());
  if (!res.ok || seq !== statusSeq || busy) return;
  const prev = session;
  const changed = JSON.stringify(res.data) !== JSON.stringify(prev);
  const tilesChanged = res.data.activeProfile !== prev?.activeProfile || res.data.username !== prev?.username || res.data.displayName !== prev?.displayName;
  session = res.data;
  if (!changed) return;
  renderSession();
  if (tilesChanged) renderGrid();
}

/* ----------------------------------------------------------------- actions */
/* Saving needs no dialog: the profile is named after the Epic display name, and
   `existing` refreshes a profile that is already saved. */
async function doSave(existing = null) {
  if (busy || openDialogCtl || !session) return;
  if (!session.username) { toast(t('save.needSignIn'), 'err'); return; }
  const target = existing || state.profiles.find((p) => p.username === session.username) || null;
  setBusy(true, t('save.busy'));
  const res = await rpc(window.api.save(target?.name));
  setBusy(false);
  if (!res.ok) { toast(res.error, 'err'); return; }
  applyState(res.data);
  toast(t(target ? 'save.updated' : 'save.done', { name: res.data.saved }));
  refreshStatus();
}

function afterSwitch(p, data) {
  applyState(data);
  toast(t('switch.done', { name: p.name }));
  const notes = data.warnings || (data.warning ? [data.warning] : []);
  notes.forEach((n) => toast(n, 'err'));
  refreshStatus();
}

async function doSwitch(p) {
  if (busy || openDialogCtl) return;
  setBusy(true, t('switch.busy', { name: p.name }), t('switch.busySub'), p);
  const res = await rpc(window.api.switchTo(p.name));
  setBusy(false);
  if (!res.ok) { toast(res.error, 'err'); return; }
  afterSwitch(p, res.data);
}

async function doRefresh(p) {
  if (busy || openDialogCtl) return;
  if (session && !session.username) { toast(t('save.needSignIn'), 'err'); return; }
  if (session?.username && session.username !== p.username) { toast(t('save.wrongAccount', { name: p.name }), 'err'); return; }
  await doSave(p);
}

async function doPin(p) {
  const data = await call(window.api.setMeta(p.name, { pinned: !p.pinned }));
  if (data) { applyState(data); toast(t(p.pinned ? 'pin.off' : 'pin.on', { name: p.name })); }
}

async function pickCropped() {
  const res = await window.api.pickImage();
  if (!res.ok) { toast(res.error, 'err'); return null; }
  if (!res.data) return null;
  try { return await cropToAvatar(res.data); } catch { toast(t('edit.imageError'), 'err'); return null; }
}
function cropToAvatar(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return reject(new Error('empty'));
      for (const size of [256, 192, 128]) { // keep the PNG under the core's size limit
        const c = document.createElement('canvas');
        c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
        const url = c.toDataURL('image/png');
        if (url.length <= 480000 || size === 128) return resolve(url);
      }
    };
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

async function doEdit(p) {
  if (busy || openDialogCtl) return;
  let pic = p.avatar || null;
  let hue = p.hue ?? null;
  const name = textField(t('save.name'), { value: p.name });
  const preview = h('div');
  const draw = () => preview.replaceChildren(avatarEl({ name: name.input.value || p.name, username: p.username, avatar: pic, hue }));
  name.input.addEventListener('input', draw);
  draw();

  const choose = h('button', { type: 'button', class: 'btn small', onclick: async () => { const c = await pickCropped(); if (c) { pic = c; draw(); } } }, icon('image'), t('edit.choose'));
  const remove = h('button', { type: 'button', class: 'btn small ghost', onclick: () => { pic = null; draw(); } }, icon('trash'), t('edit.remove'));
  const swatches = h('div', { class: 'swatches', role: 'group' });
  const paintSwatches = () => swatches.replaceChildren(
    ...[null, ...HUES].map((v) => {
      const b = h('button', { type: 'button', class: `swatch${v === null ? ' auto' : ''}`, 'aria-pressed': String(v === hue), title: v === null ? t('edit.auto') : '', 'aria-label': v === null ? t('edit.auto') : `${v}°` }, v === null ? 'A' : null);
      if (v !== null) b.style.setProperty('--h', v);
      b.addEventListener('click', () => { hue = v; paintSwatches(); draw(); });
      return b;
    }));
  paintSwatches();

  await openDialog({
    title: t('edit.title'), confirm: t('edit.confirm'),
    extra: h('button', { type: 'button', class: 'btn ghost danger-text', onclick: () => { openDialogCtl?.close(null); doDelete(p); } }, icon('trash'), t('delete.title')),
    children: [
      h('div', { class: 'edit-top' }, preview, h('div', { class: 'col' }, h('div', { class: 'label' }, t('edit.picture')), choose, remove)),
      name.el,
      h('div', { class: 'field' }, h('div', { class: 'label' }, t('edit.color')), swatches),
    ],
    onSubmit: async (ctl) => {
      const nm = name.input.value.trim();
      if (!nm) { ctl.error(t('name.enter')); return false; }
      if (nm !== p.name && state.profiles.some((q) => q.name === nm)) { ctl.error(t('name.taken')); return false; }
      let cur = p.name;
      const steps = [];
      if (nm !== p.name) steps.push(() => window.api.rename(p.name, nm).then((r) => { if (r.ok) cur = nm; return r; }));
      if (pic !== (p.avatar || null)) steps.push(() => window.api.setAvatar(cur, pic));
      if (hue !== (p.hue ?? null)) steps.push(() => window.api.setMeta(cur, { hue }));
      for (const step of steps) {
        const res = await rpc(step());
        if (!res.ok) { ctl.error(res.error); return false; }
        applyState(res.data);
      }
      if (steps.length) toast(t('edit.done'));
      return true;
    },
  });
}

async function doDelete(p) {
  if (busy || openDialogCtl) return;
  await openDialog({
    title: t('delete.title'), hint: t('delete.text', { name: p.name }), confirm: t('common.delete'), danger: true,
    onSubmit: async (ctl) => {
      const res = await rpc(window.api.remove(p.name));
      if (!res.ok) { ctl.error(res.error); return false; }
      applyState(res.data);
      refreshStatus();
      toast(t('delete.done', { name: p.name }));
      return true;
    },
  });
}

/* ----------------------------------------------------------------- settings
   A page of its own (not a pop-up), so the Launcher path has room and the rows can be big and clear. */
function showView(next) {
  view = next;
  $('#viewHome').hidden = next !== 'home';
  $('#viewSettings').hidden = next !== 'settings';
  $('#main').scrollTop = 0;
  $('#viewSettings').scrollTop = 0;
}

function closeSettings() {
  showView('home');
  $('#btnSettings').focus();
}

function openSettings() {
  if (busy) return;
  if (openDialogCtl) openDialogCtl.close(null);
  renderSettings();
  showView('settings');
  $('#viewSettings .back').focus();
}

function renderSettings() {
  const root = $('#viewSettings');

  // -- Launcher location: status, the path itself (wraps, never cut off) and two actions
  const status = h('div', { class: 'launcher-status' });
  const pathBox = h('div', { class: 'pathbox' });
  const help = h('p', {});
  const choose = h('button', { type: 'button', class: 'btn small', onclick: async () => {
    const res = await window.api.browse();
    if (res.ok && res.data) { applyState(res.data); paintPath(); } else if (!res.ok) toast(res.error, 'err');
  } }, icon('folder'), t('settings.choose'));
  const auto = h('button', { type: 'button', class: 'btn small ghost', onclick: async () => {
    const data = await call(window.api.settings({ epicPath: '' }));
    if (data) { applyState(data); paintPath(); }
  } }, t('settings.auto'));
  function paintPath() {
    const st = state.settings;
    const kind = st.resolvedEpicPath ? (st.epicPath ? 'custom' : 'auto') : 'missing';
    status.className = `launcher-status ${kind}`;
    status.replaceChildren(h('span', { class: 'status-dot' }), t(`settings.status.${kind}`));
    pathBox.textContent = st.resolvedEpicPath || '';
    pathBox.hidden = !st.resolvedEpicPath;
    help.textContent = kind === 'missing' ? t('settings.missingHelp') : '';
    help.hidden = kind !== 'missing';
    auto.hidden = !st.epicPath;
  }
  paintPath();

  // -- Launch after switching: the whole row is the switch
  const launchInput = h('input', { type: 'checkbox', role: 'switch' });
  launchInput.checked = !!state.settings.launchAfterSwitch;
  launchInput.addEventListener('change', async () => {
    const data = await call(window.api.settings({ launchAfterSwitch: launchInput.checked }));
    if (data) applyState(data); else launchInput.checked = !launchInput.checked;
  });

  // -- Order of the accounts on the home screen
  const sortSelect = h('select', { 'aria-label': t('settings.order') }, ...['used', 'name', 'saved'].map((k) => h('option', { value: k }, t(`sort.${k}`))));
  sortSelect.value = prefs.sort;
  sortSelect.addEventListener('change', () => { prefs.sort = sortSelect.value; prefs.save(); renderGrid(); });
  const chevron = h('span'); chevron.innerHTML = ICONS.chevron;

  const section = (title, ...rows) => h('section', {}, h('h2', { class: 'group-title' }, title), h('div', { class: 'group' }, ...rows));

  root.replaceChildren(h('div', { class: 'page-inner' },
    h('button', { type: 'button', class: 'btn ghost back', onclick: closeSettings }, icon('chevronLeft'), t('settings.back')),
    h('header', { class: 'settings-head' }, h('h1', {}, t('settings.title'))),
    section(t('settings.general'),
      h('label', { class: 'setting' },
        h('div', { class: 'setting-text' }, h('b', {}, t('settings.launch')), h('p', {}, t('settings.launchText'))),
        h('span', { class: 'switch' }, launchInput, h('span', { class: 'slider' }))),
      h('div', { class: 'setting' },
        h('div', { class: 'setting-text' }, h('b', {}, t('settings.order')), h('p', {}, t('settings.orderText'))),
        h('span', { class: 'select' }, sortSelect, chevron))),
    section(t('settings.launcherSection'),
      h('div', { class: 'setting stack' }, status, help, pathBox, h('div', { class: 'row-actions' }, choose, auto))),
    section(t('settings.dataSection'),
      h('div', { class: 'setting' },
        h('div', { class: 'setting-text' }, h('b', {}, t('settings.dataTitle')), h('p', {}, t('settings.dataText'))),
        h('button', { type: 'button', class: 'btn small', onclick: () => window.api.openDataFolder() }, icon('folder'), t('settings.openData'))))));
}

/* -------------------------------------------------------------- shortcuts */
function moveFocus(key) {
  const els = [...$('#grid').querySelectorAll('.tile-main')];
  const cur = document.activeElement;
  const i = els.indexOf(cur);
  if (i < 0) return false;
  if (key === 'ArrowLeft' || key === 'ArrowRight') { els[i + (key === 'ArrowLeft' ? -1 : 1)]?.focus(); return true; }
  const top = (e) => e.getBoundingClientRect().top;
  const left = (e) => e.getBoundingClientRect().left;
  const down = key === 'ArrowDown';
  const cands = els.filter((e) => (down ? top(e) > top(cur) + 10 : top(e) < top(cur) - 10));
  if (!cands.length) return true;
  const rowTop = down ? Math.min(...cands.map(top)) : Math.max(...cands.map(top));
  cands.filter((e) => Math.abs(top(e) - rowTop) < 10).sort((a, b) => Math.abs(left(a) - left(cur)) - Math.abs(left(b) - left(cur)))[0].focus();
  return true;
}

document.addEventListener('keydown', (e) => {
  if (busy || openDialogCtl || e.defaultPrevented) return;
  if (view === 'settings') {
    if (e.key === 'Escape' || (e.ctrlKey && e.key === ',')) { e.preventDefault(); closeSettings(); }
    return;
  }
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
  if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (e.key === '/' && !typing)) { e.preventDefault(); if (!$('#searchWrap').hidden) { $('#search').focus(); $('#search').select(); } }
  else if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); doSave(); }
  else if (e.ctrlKey && e.key === ',') { e.preventDefault(); openSettings(); }
  else if (e.key === 'Escape' && e.target.id === 'search') { query = ''; e.target.value = ''; e.target.blur(); syncSearch(); renderAll(); }
  else if (e.key === 'Escape' && managing) setManaging(false);
  else if (e.key.startsWith('Arrow') && !typing && moveFocus(e.key)) e.preventDefault();
});

/* -------------------------------------------------------------------- init */
window.addEventListener('error', (e) => toast(t('app.fatal', { msg: e.message }), 'err'));
window.addEventListener('unhandledrejection', (e) => { e.preventDefault(); toast(t('app.fatal', { msg: String(e.reason?.message || e.reason) }), 'err'); });
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.tile')) e.preventDefault(); });

async function init() {
  renderStatic();
  if (!window.api) { $('#main').replaceChildren(h('p', { class: 'hint' }, t('app.apiMissing'))); return; }
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnManage').addEventListener('click', () => setManaging(!managing));
  $('#search').addEventListener('input', (e) => { query = e.target.value; syncSearch(); renderGrid(); renderEmpty(); });
  renderSession();

  const data = await call(window.api.state());
  if (data) applyState(data);
  refreshStatus();
  setInterval(refreshStatus, 5000);
  window.addEventListener('focus', refreshStatus);
  document.addEventListener('visibilitychange', refreshStatus);
}

init();
