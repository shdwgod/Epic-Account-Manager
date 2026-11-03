/* Fake `window.api` so the UI can be developed in a normal browser (no Rust, no Windows).
   Options via URL: ?empty  ?signedout  ?unsaved */
(() => {
  const q = new URLSearchParams(location.search);
  const ago = (min) => { const d = new Date(Date.now() - min * 60000); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  let profiles = q.has('empty') ? [] : [
    { name: 'Main account', username: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', saved: ago(60 * 24 * 40), lastUsed: ago(25), avatar: null, locked: true, pinned: true, hue: null },
    { name: 'Zosia', username: 'b2c3d4e5f60718293a4b5c6d7e8f90a1', saved: ago(60 * 24 * 9), lastUsed: ago(60 * 30), avatar: null, locked: false, pinned: false, hue: 320 },
    { name: 'Smurf', username: 'c3d4e5f60718293a4b5c6d7e8f90a1b2', saved: ago(60 * 24 * 3), lastUsed: null, avatar: null, locked: true, pinned: false, hue: null },
    { name: 'Łukasz – Fortnite', username: 'd4e5f60718293a4b5c6d7e8f90a1b2c3', saved: ago(60 * 24 * 90), lastUsed: ago(60 * 24 * 6), avatar: null, locked: false, pinned: false, hue: 175 },
  ];
  let settings = { requirePassword: true, launchAfterSwitch: true, epicPath: '', resolvedEpicPath: 'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe' };
  let active = q.has('empty') || q.has('signedout') || q.has('unsaved') ? null : 'Main account';
  let running = true;
  const snap = () => ({ version: '2.1.0-dev', profiles: structuredClone(profiles), settings: { ...settings } });
  const ok = (data) => new Promise((r) => setTimeout(() => r({ ok: true, data }), 150));
  const fail = (error) => new Promise((r) => setTimeout(() => r({ ok: false, error }), 150));
  const find = (n) => profiles.find((p) => p.name === n);
  window.api = {
    state: () => ok(snap()),
    status: () => ok({ username: q.has('signedout') ? null : q.has('unsaved') ? 'ffffffffffff00000000' : (find(active)?.username ?? null), activeProfile: active, epicRunning: running }),
    save: (name, password) => { if (!name.trim()) return fail('Enter a profile name.'); const ex = find(name); const cur = active && find(active); if (ex) Object.assign(ex, { saved: ago(0), locked: !!password }); else profiles.push({ name, username: cur?.username || 'new' + Date.now(), saved: ago(0), lastUsed: null, avatar: null, locked: !!password, pinned: false, hue: null }); active = name; return ok(snap()); },
    switchTo: (name, password) => { const p = find(name); if (!p) return fail('Profile does not exist.'); if (p.locked && password !== 'test') return fail('Wrong password.'); p.lastUsed = ago(0); active = name; running = settings.launchAfterSwitch; return new Promise((r) => setTimeout(() => r({ ok: true, data: snap() }), 1200)); },
    rename: (o, n) => { const p = find(o); if (!p) return fail('Profile does not exist.'); if (find(n)) return fail('A profile with this name already exists.'); p.name = n; if (active === o) active = n; return ok(snap()); },
    setLock: (name, pw, np) => { const p = find(name); if (np) p.locked = true; else if (pw !== 'test') return fail('Wrong password.'); else p.locked = false; return ok(snap()); },
    remove: (name) => { profiles = profiles.filter((p) => p.name !== name); if (active === name) active = null; return ok(snap()); },
    settings: (patch) => { Object.assign(settings, patch); if (patch.epicPath === '') settings.resolvedEpicPath = 'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe'; return ok(snap()); },
    browse: () => ok(null),
    launch: () => { running = true; return ok(true); },
    pickImage: () => ok(null),
    setAvatar: (name, avatar) => { find(name).avatar = avatar; return ok(snap()); },
    setMeta: (name, meta) => { Object.assign(find(name), meta); return ok(snap()); },
    openDataFolder: () => ok(true),
  };
})();
