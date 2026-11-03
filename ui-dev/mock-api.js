/* Fake `window.api` so the UI can be developed in a normal browser (no Rust, no Windows).
   Options via URL: ?empty  ?signedout  ?unsaved  ?many ?nolauncher  (the "Smurf" profile plays an old password-protected one) */
(() => {
  const q = new URLSearchParams(location.search);
  const ago = (min) => { const d = new Date(Date.now() - min * 60000); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  let profiles = q.has('empty') ? [] : [
    { name: 'Main account', username: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', saved: ago(60 * 24 * 40), lastUsed: ago(25), avatar: null, legacy: false, pinned: true, hue: null },
    { name: 'Ava', username: 'b2c3d4e5f60718293a4b5c6d7e8f90a1', saved: ago(60 * 24 * 9), lastUsed: ago(60 * 30), avatar: null, legacy: false, pinned: false, hue: 320 },
    { name: 'Smurf', username: 'c3d4e5f60718293a4b5c6d7e8f90a1b2', saved: ago(60 * 24 * 3), lastUsed: null, avatar: null, legacy: true, pinned: false, hue: null },
    { name: 'Luke – Fortnite', username: 'd4e5f60718293a4b5c6d7e8f90a1b2c3', saved: ago(60 * 24 * 90), lastUsed: ago(60 * 24 * 6), avatar: null, legacy: false, pinned: false, hue: 175 },
  ];
  if (q.has('many')) ['Kate', 'Ben', 'Olivia – Rocket League', 'Mike'].forEach((n, i) => profiles.push({ name: n, username: `e${i}e5f60718293a4b5c6d7e8f90a1b2c3d4`, saved: ago(60 * 24 * (i + 5)), lastUsed: ago(60 * 24 * (i + 8)), avatar: null, legacy: false, pinned: false, hue: null }));
  let settings = { launchAfterSwitch: true, epicPath: '', resolvedEpicPath: 'C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win32\\EpicGamesLauncher.exe' };
  if (q.has('nolauncher')) settings.resolvedEpicPath = '';
  let active = q.has('empty') || q.has('signedout') || q.has('unsaved') ? null : 'Main account';
  let running = true;
  const snap = () => ({ version: '2.1.0-dev', profiles: structuredClone(profiles), settings: { ...settings } });
  const ok = (data) => new Promise((r) => setTimeout(() => r({ ok: true, data }), 150));
  const fail = (error) => new Promise((r) => setTimeout(() => r({ ok: false, error }), 150));
  const find = (n) => profiles.find((p) => p.name === n);
  window.api = {
    state: () => ok(snap()),
    status: () => { const username = q.has('signedout') ? null : q.has('unsaved') ? 'ffffffffffff00000000' : (find(active)?.username ?? null); return ok({ username, displayName: username ? (q.has('unsaved') ? 'shdwlol' : active) : null, activeProfile: active, epicRunning: running }); },
    save: (name) => {
      // The real core names a new profile after the display name from auth.json.
      const cur = q.has('unsaved') ? { username: 'ffffffffffff00000000' } : active && find(active);
      const ex = name ? find(name) : profiles.find((p) => p.username === cur?.username);
      if (name && !ex) return fail('Profile does not exist.');
      let saved;
      if (ex) { Object.assign(ex, { saved: ago(0), legacy: false }); saved = ex.name; }
      else { saved = 'shdwlol'; for (let i = 2; find(saved); i++) saved = `shdwlol (${i})`; profiles.push({ name: saved, username: cur?.username || 'new' + Date.now(), saved: ago(0), lastUsed: null, avatar: null, legacy: false, pinned: false, hue: null }); }
      active = saved;
      return ok({ ...snap(), saved });
    },
    switchTo: (name) => { const p = find(name); if (!p) return fail('Profile does not exist.'); if (p.legacy) return fail('This profile was saved with a password by an older version. Sign in to that account and save it again.'); p.lastUsed = ago(0); active = name; running = settings.launchAfterSwitch; return new Promise((r) => setTimeout(() => r({ ok: true, data: snap() }), 1200)); },
    rename: (o, n) => { const p = find(o); if (!p) return fail('Profile does not exist.'); if (find(n)) return fail('A profile with this name already exists.'); p.name = n; if (active === o) active = n; return ok(snap()); },
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
