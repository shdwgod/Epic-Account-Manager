'use strict';

const $ = (sel) => document.querySelector(sel);

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
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICONS = {
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  gear: SVG('<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>'),
  dots: SVG('<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>'),
  swap: SVG('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  pencil: SVG('<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash: SVG('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  eye: SVG('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: SVG('<path d="M9.9 4.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/>'),
  folder: SVG('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  users: SVG('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'),
  shield: SVG('<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>'),
  camera: SVG('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
  lock: SVG('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  unlock: SVG('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
  check: SVG('<path d="M20 6 9 17l-5-5"/>'),
  alert: SVG('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
};
function icon(name) {
  const s = document.createElement('span');
  s.style.display = 'inline-flex';
  s.innerHTML = ICONS[name];
  return s;
}

let state = { profiles: [], settings: {} };
let busy = false;

function setBusy(on, text) {
  busy = on;
  $('#busy').classList.toggle('hidden', !on);
  if (text) $('#busyText').textContent = text;
}

function toast(message, type = 'ok') {
  const el = h('div', { class: `toast ${type}` }, icon(type === 'ok' ? 'check' : 'alert'), h('span', {}, message));
  $('#toasts').append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, type === 'ok' ? 3200 : 5200);
}

async function call(promise) {
  const res = await promise;
  if (!res.ok) {
    toast(res.error, 'err');
    return null;
  }
  return res.data;
}

function applyState(data) {
  state = data;
  render();
}

function hueOf(name) {
  let x = 0;
  for (const c of name) x = (x * 31 + c.charCodeAt(0)) % 360;
  return x;
}

function infoBox(label, value) {
  return h('div', { class: 'info' }, h('span', {}, label), h('b', {}, value));
}

function renderCard(p) {
  const face = h('div', { class: 'avatar' }, p.avatar ? h('img', { src: p.avatar, alt: '' }) : (p.name.trim().charAt(0) || '?'));
  face.style.setProperty('--h', hueOf(p.name));
  const avatar = h('button', { class: 'avatar-btn', title: 'Change picture', onclick: () => doPicture(p) },
    face, h('span', { class: 'avatar-edit' }, icon('camera')));

  const card = h('article', { class: 'card' });
  const menuBtn = h('button', { class: 'icon-btn', title: 'More', onclick: (e) => { e.stopPropagation(); toggleMenu(card, p); } }, icon('dots'));
  const lockTag = h('div', { class: 'uid lock-tag ' + (p.locked ? '' : 'open') }, icon(p.locked ? 'lock' : 'unlock'), p.locked ? 'Password protected' : 'No password');

  card.append(
    h('div', { class: 'card-top' }, avatar, h('div', { class: 'meta' }, h('h3', { title: p.name }, p.name), lockTag), menuBtn),
    h('div', { class: 'card-info' }, infoBox('Saved', p.saved || '—'), infoBox('Last used', p.lastUsed || 'Never')),
    h('button', { class: 'btn primary wide', onclick: () => doSwitch(p) }, icon('swap'), 'Switch to this account')
  );
  return card;
}

function render() {
  $('#grid').replaceChildren(...state.profiles.map(renderCard));
  $('#empty').classList.toggle('hidden', state.profiles.length > 0);
}

function closeMenus() { document.querySelectorAll('.menu').forEach((m) => m.remove()); }
document.addEventListener('click', closeMenus);

function toggleMenu(card, p) {
  const had = card.querySelector('.menu');
  closeMenus();
  if (had) return;
  card.append(
    h('div', { class: 'menu', onclick: (e) => e.stopPropagation() },
      h('button', { onclick: () => { closeMenus(); doPicture(p); } }, icon('camera'), 'Change picture'),
      p.avatar ? h('button', { onclick: () => { closeMenus(); doRemovePicture(p); } }, icon('trash'), 'Remove picture') : null,
      h('button', { onclick: () => { closeMenus(); doRename(p); } }, icon('pencil'), 'Rename'),
      p.locked
        ? h('button', { onclick: () => { closeMenus(); doRemoveLock(p); } }, icon('unlock'), 'Remove password')
        : h('button', { onclick: () => { closeMenus(); doAddLock(p); } }, icon('lock'), 'Set password'),
      h('button', { class: 'danger', onclick: () => { closeMenus(); doDelete(p); } }, icon('trash'), 'Delete'))
  );
}

function modal({ title, hint, fields = [], content = [], confirmText = 'OK', danger = false, hideCancel = false, validate }) {
  return new Promise((resolve) => {
    const inputs = {};
    const err = h('p', { class: 'form-error' });

    const fieldEls = fields.map((f) => {
      const input = h('input', { type: f.secret ? 'password' : 'text', placeholder: f.placeholder || '', autocomplete: 'off', spellcheck: 'false' });
      inputs[f.name] = input;
      const wrap = h('div', { class: 'input-wrap' }, input);
      if (f.secret) {
        const eye = h('button', { type: 'button', class: 'eye', tabindex: '-1', title: 'Show / hide' }, icon('eye'));
        eye.addEventListener('click', () => {
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          eye.replaceChildren(icon(show ? 'eyeOff' : 'eye'));
        });
        wrap.append(eye);
      }
      return h('div', { class: 'field' }, h('label', {}, f.label), wrap);
    });

    function close(value) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(value);
    }
    function submit() {
      const values = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value]));
      if (validate) {
        const msg = validate(values);
        if (msg) { err.textContent = msg; return; }
      }
      close(values);
    }
    function onKey(e) { if (e.key === 'Escape') close(null); }

    const okBtn = h('button', { type: 'submit', class: 'btn ' + (danger ? 'danger' : 'primary') }, confirmText);
    const form = h('form', { class: 'dialog', onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('h2', {}, title),
      hint ? h('p', { class: 'hint' }, hint) : null,
      ...content, ...fieldEls, err,
      h('div', { class: 'dialog-actions' },
        hideCancel ? null : h('button', { type: 'button', class: 'btn', onclick: () => close(null) }, 'Cancel'),
        okBtn));
    const backdrop = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === backdrop) close(null); } }, form);

    $('#modalRoot').append(backdrop);
    document.addEventListener('keydown', onKey);
    const first = Object.values(inputs)[0];
    (first || okBtn).focus();
  });
}

async function doSave() {
  if (busy) return;
  const named = await modal({
    title: 'Save current account',
    hint: 'Saves the account the Epic Games Launcher is currently signed in to.',
    fields: [{ name: 'name', label: 'Profile name', placeholder: 'e.g. Main account' }],
    confirmText: 'Continue',
    validate: (v) => (v.name.trim() ? null : 'Enter a profile name.'),
  });
  if (!named) return;
  const name = named.name.trim();

  if (state.profiles.some((p) => p.name === name)) {
    const ok = await modal({ title: 'Profile already exists', hint: `Overwrite “${name}”?`, confirmText: 'Overwrite', danger: true });
    if (!ok) return;
  }

  let password = '';
  if (state.settings.requirePassword !== false) {
    const pw = await modal({
      title: 'Protect this profile',
      hint: 'The token is encrypted with this password. You will need it every time you switch to this profile.',
      fields: [
        { name: 'password', label: 'Password / PIN', secret: true },
        { name: 'repeat', label: 'Repeat password', secret: true },
      ],
      confirmText: 'Save profile',
      validate: (v) => (v.password.length < 4 ? 'Password must be at least 4 characters.' : v.password !== v.repeat ? 'Passwords do not match.' : null),
    });
    if (!pw) return;
    password = pw.password;
  }

  setBusy(true, 'Closing Epic and saving profile…');
  const data = await call(window.api.save(name, password));
  setBusy(false);
  if (data) { applyState(data); toast(`Saved profile “${name}”`); }
}

async function doSwitch(p) {
  if (busy) return;
  let password = '';
  if (p.locked) {
    const pw = await modal({
      title: `Switch to ${p.name}`,
      hint: 'Enter the password you set for this profile.',
      fields: [{ name: 'password', label: 'Password / PIN', secret: true }],
      confirmText: 'Switch',
      validate: (v) => (v.password ? null : 'Enter the password.'),
    });
    if (!pw) return;
    password = pw.password;
  }

  setBusy(true, `Switching to ${p.name}…`);
  const data = await call(window.api.switchTo(p.name, password));
  setBusy(false);
  if (data) {
    applyState(data);
    toast(`Switched to “${p.name}”`);
    if (data.warning) toast(data.warning, 'err');
  }
}

function cropToAvatar(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 192;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) return reject(new Error('empty'));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

async function doPicture(p) {
  if (busy) return;
  const res = await window.api.pickImage();
  if (!res.ok) { toast(res.error, 'err'); return; }
  if (!res.data) return;
  let cropped;
  try { cropped = await cropToAvatar(res.data); } catch { toast('Could not read this image.', 'err'); return; }
  const data = await call(window.api.setAvatar(p.name, cropped));
  if (data) { applyState(data); toast('Picture updated'); }
}

async function doRemovePicture(p) {
  const data = await call(window.api.setAvatar(p.name, null));
  if (data) { applyState(data); toast('Picture removed'); }
}

async function doRename(p) {
  const v = await modal({
    title: 'Rename profile',
    fields: [{ name: 'name', label: 'New name' }],
    confirmText: 'Rename',
    validate: (x) => {
      const n = x.name.trim();
      if (!n) return 'Enter a name.';
      if (n !== p.name && state.profiles.some((q) => q.name === n)) return 'A profile with this name already exists.';
      return null;
    },
  });
  if (!v) return;
  const data = await call(window.api.rename(p.name, v.name.trim()));
  if (data) { applyState(data); toast('Profile renamed'); }
}

async function doRemoveLock(p) {
  const pw = await modal({
    title: `Remove password from ${p.name}`,
    hint: 'Switching to this profile will work in one click. It stays protected by your Windows account only.',
    fields: [{ name: 'password', label: 'Current password', secret: true }],
    confirmText: 'Remove password',
    validate: (v) => (v.password ? null : 'Enter the current password.'),
  });
  if (!pw) return;
  setBusy(true, 'Updating profile…');
  const data = await call(window.api.setLock(p.name, pw.password, null));
  setBusy(false);
  if (data) { applyState(data); toast(`“${p.name}” no longer needs a password`); }
}

async function doAddLock(p) {
  const pw = await modal({
    title: `Set a password for ${p.name}`,
    fields: [
      { name: 'password', label: 'Password / PIN', secret: true },
      { name: 'repeat', label: 'Repeat password', secret: true },
    ],
    confirmText: 'Set password',
    validate: (v) => (v.password.length < 4 ? 'Password must be at least 4 characters.' : v.password !== v.repeat ? 'Passwords do not match.' : null),
  });
  if (!pw) return;
  setBusy(true, 'Updating profile…');
  const data = await call(window.api.setLock(p.name, null, pw.password));
  setBusy(false);
  if (data) { applyState(data); toast(`“${p.name}” is now password protected`); }
}

async function doDelete(p) {
  const ok = await modal({ title: 'Delete profile', hint: `Delete “${p.name}”? This cannot be undone.`, confirmText: 'Delete', danger: true });
  if (!ok) return;
  const data = await call(window.api.remove(p.name));
  if (data) { applyState(data); toast(`Deleted “${p.name}”`); }
}

async function openSettings() {
  const s = state.settings;
  const pathBox = h('div', { class: 'ro', title: s.resolvedEpicPath }, s.resolvedEpicPath || 'Launcher not found');
  const toggle = h('input', { type: 'checkbox' });
  toggle.checked = !!s.launchAfterSwitch;
  toggle.addEventListener('change', async () => {
    const data = await call(window.api.settings({ launchAfterSwitch: toggle.checked }));
    if (data) state = data;
  });

  const browse = h('button', { type: 'button', class: 'btn', onclick: async () => {
    const res = await window.api.browse();
    if (res.ok && res.data) { state = res.data; pathBox.textContent = state.settings.resolvedEpicPath; pathBox.title = pathBox.textContent; render(); }
    else if (!res.ok) toast(res.error, 'err');
  } }, icon('folder'), 'Browse');

  const pwToggle = h('input', { type: 'checkbox' });
  pwToggle.checked = s.requirePassword !== false;
  pwToggle.addEventListener('change', async () => {
    const data = await call(window.api.settings({ requirePassword: pwToggle.checked }));
    if (data) state = data;
    else pwToggle.checked = !pwToggle.checked;
  });

  const content = [
    h('div', { class: 'setting' },
      h('div', {}, h('b', {}, 'Require a password'), h('p', {}, 'Turn off to save new profiles without a password and switch with one click. They stay protected by your Windows account only.')),
      h('label', { class: 'switch' }, pwToggle, h('span', { class: 'slider' }))),
    h('div', { class: 'setting' },
      h('div', {}, h('b', {}, 'Launch Epic after switching'), h('p', {}, 'Start the Launcher automatically with the new account.')),
      h('label', { class: 'switch' }, toggle, h('span', { class: 'slider' }))),
    h('div', { class: 'path-row' }, h('div', { class: 'input-wrap' }, pathBox), browse),
    h('button', { type: 'button', class: 'link', style: null, onclick: () => window.api.openDataFolder() }, 'Open data folder'),
  ];
  await modal({ title: 'Settings', content, confirmText: 'Done', hideCancel: true });
}

async function init() {
  $('#logo').innerHTML = ICONS.shield;
  $('#emptyIcon').innerHTML = ICONS.users;
  $('#btnSave').append(icon('plus'), 'Save current account');
  $('#btnSettings').append(icon('gear'), 'Settings');
  $('#btnSave').addEventListener('click', doSave);
  $('#btnSettings').addEventListener('click', openSettings);

  const data = await call(window.api.state());
  if (data) applyState(data);
}

init();