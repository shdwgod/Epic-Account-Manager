'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { promisify } = require('util');
const { execFile, spawn } = require('child_process');
const koffi = require('koffi');

const scrypt = promisify(crypto.scrypt);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EPIC_TARGET = 'LegacyGeneric:target=credentials.com.epicgames.eglv2.prod';
const DATA_DIR = path.join(os.homedir(), 'EpicAccountManager');
const CONFIG_FILE = path.join(DATA_DIR, 'accounts.json');

class AppError extends Error {}
class WrongPassword extends AppError {}

const advapi32 = koffi.load('advapi32.dll');
const crypt32 = koffi.load('crypt32.dll');
const kernel32 = koffi.load('kernel32.dll');

const FILETIME = koffi.struct('FILETIME', { dwLowDateTime: 'uint32', dwHighDateTime: 'uint32' });
const CREDENTIALW = koffi.struct('CREDENTIALW', {
  Flags: 'uint32',
  Type: 'uint32',
  TargetName: 'str16',
  Comment: 'str16',
  LastWritten: FILETIME,
  CredentialBlobSize: 'uint32',
  CredentialBlob: 'void *',
  Persist: 'uint32',
  AttributeCount: 'uint32',
  Attributes: 'void *',
  TargetAlias: 'str16',
  UserName: 'str16',
});
const DATA_BLOB = koffi.struct('DATA_BLOB', { cbData: 'uint32', pbData: 'void *' });

const CredReadW = advapi32.func('int __stdcall CredReadW(str16 target, uint32 type, uint32 flags, _Out_ void **cred)');
const CredWriteW = advapi32.func('int __stdcall CredWriteW(CREDENTIALW *cred, uint32 flags)');
const CredFree = advapi32.func('void __stdcall CredFree(void *buffer)');
const CryptProtectData = crypt32.func(
  'int __stdcall CryptProtectData(DATA_BLOB *in, str16 desc, void *entropy, void *reserved, void *prompt, uint32 flags, _Out_ DATA_BLOB *out)'
);
const CryptUnprotectData = crypt32.func(
  'int __stdcall CryptUnprotectData(DATA_BLOB *in, void *desc, void *entropy, void *reserved, void *prompt, uint32 flags, _Out_ DATA_BLOB *out)'
);
const LocalFree = kernel32.func('void *__stdcall LocalFree(void *mem)');

function takeBlob(out) {
  try {
    return Buffer.from(koffi.decode(out.pbData, 'uint8_t', out.cbData));
  } finally {
    LocalFree(out.pbData);
  }
}

function dpapiProtect(buf) {
  const out = {};
  if (!CryptProtectData({ cbData: buf.length, pbData: buf }, 'EpicToken', null, null, null, 0, out)) {
    throw new AppError('Windows DPAPI encryption failed.');
  }
  return takeBlob(out);
}

function dpapiUnprotect(buf) {
  const out = {};
  if (!CryptUnprotectData({ cbData: buf.length, pbData: buf }, null, null, null, null, 0, out)) {
    throw new AppError('Cannot decrypt this profile (saved by a different Windows user or PC?).');
  }
  return takeBlob(out);
}

function readCurrentToken() {
  const out = [null];
  if (!CredReadW(EPIC_TARGET, 1, 0, out) || !out[0]) return null;
  try {
    const cred = koffi.decode(out[0], CREDENTIALW);
    const size = cred.CredentialBlobSize;
    const blob =
      size && cred.CredentialBlob
        ? Buffer.from(koffi.decode(cred.CredentialBlob, 'uint8_t', size))
        : Buffer.alloc(0);
    return { username: cred.UserName, blobHex: blob.toString('hex') };
  } finally {
    CredFree(out[0]);
  }
}

function writeTokenToSystem(username, blobHex) {
  const blob = Buffer.from(blobHex, 'hex');
  const ok = CredWriteW(
    {
      Flags: 0,
      Type: 1,
      TargetName: EPIC_TARGET,
      Comment: null,
      LastWritten: { dwLowDateTime: 0, dwHighDateTime: 0 },
      CredentialBlobSize: blob.length,
      CredentialBlob: blob,
      Persist: 2,
      AttributeCount: 0,
      Attributes: null,
      TargetAlias: null,
      UserName: username,
    },
    0
  );
  if (!ok) throw new AppError('Could not write the credential to Windows Credential Manager.');
}

const MAGIC = Buffer.from('ETM2');

async function derive(password, salt) {
  const key = await scrypt(Buffer.from(password, 'utf8'), salt, 64, {
    N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024,
  });
  return { enc: key.subarray(0, 32), mac: key.subarray(32) };
}

function streamXor(key, nonce, data) {
  const out = Buffer.alloc(data.length);
  for (let off = 0, c = 0; off < data.length; off += 32, c++) {
    const ctr = Buffer.alloc(8);
    ctr.writeBigUInt64BE(BigInt(c));
    const ks = crypto.createHmac('sha256', key).update(nonce).update(ctr).digest();
    const n = Math.min(32, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
  }
  return out;
}

async function encryptToken(plainHex, password) {
  const salt = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(16);
  const { enc, mac } = await derive(password, salt);
  const ct = streamXor(enc, nonce, Buffer.from(plainHex, 'ascii'));
  const tag = crypto.createHmac('sha256', mac).update(MAGIC).update(salt).update(nonce).update(ct).digest();
  return dpapiProtect(Buffer.concat([MAGIC, salt, nonce, ct, tag])).toString('hex');
}

async function decryptToken(encHex, password) {
  const raw = dpapiUnprotect(Buffer.from(encHex, 'hex'));
  if (raw.length < 4 + 16 + 16 + 32 || !raw.subarray(0, 4).equals(MAGIC)) throw new AppError('Corrupted profile.');
  const salt = raw.subarray(4, 20);
  const nonce = raw.subarray(20, 36);
  const ct = raw.subarray(36, raw.length - 32);
  const tag = raw.subarray(raw.length - 32);
  const { enc, mac } = await derive(password, salt);
  const expected = crypto.createHmac('sha256', mac).update(MAGIC).update(salt).update(nonce).update(ct).digest();
  if (!crypto.timingSafeEqual(tag, expected)) throw new WrongPassword('Wrong password.');
  return streamXor(enc, nonce, ct).toString('ascii');
}

function decryptLegacy(encHex, password) {
  const raw = dpapiUnprotect(Buffer.from(encHex, 'hex'));
  const key = crypto.createHash('sha256').update(password, 'utf8').digest();
  const plain = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) plain[i] = raw[i] ^ key[i % key.length];
  const text = plain.toString('latin1');
  if (!/^(?:[0-9a-f]{2})*$/i.test(text)) throw new WrongPassword('Wrong password.');
  return text;
}

const MAGIC_OPEN = Buffer.from('ETM0');

function encryptOpen(plain) {
  return dpapiProtect(Buffer.concat([MAGIC_OPEN, Buffer.from(plain, 'utf8')])).toString('hex');
}

function decryptOpen(encHex) {
  const raw = dpapiUnprotect(Buffer.from(encHex, 'hex'));
  if (raw.length < 4 || !raw.subarray(0, 4).equals(MAGIC_OPEN)) throw new AppError('Corrupted profile.');
  return raw.subarray(4).toString('utf8');
}

async function openProfile(prof, password) {
  if (prof.v === 4) return JSON.parse(decryptOpen(prof.token_encrypted));
  if (prof.v === 3) return JSON.parse(await decryptToken(prof.token_encrypted, password || ''));
  if (prof.v === 2) return { cred: await decryptToken(prof.token_encrypted, password || ''), legacy: true };
  return { cred: decryptLegacy(prof.token_encrypted, password || ''), legacy: true };
}

const run = (cmd, args) =>
  new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (_e, stdout) => resolve(stdout || '')));

async function epicRunning() {
  const out = await run('tasklist', ['/FI', 'IMAGENAME eq EpicGamesLauncher.exe', '/NH']);
  return /epicgameslauncher\.exe/i.test(out);
}

async function killEpic(timeoutMs = 8000) {
  await run('taskkill', ['/F', '/IM', 'EpicGamesLauncher.exe']);
  await run('taskkill', ['/F', '/IM', 'EpicWebHelper.exe']);
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (!(await epicRunning())) {
      await sleep(400);
      return;
    }
    await sleep(200);
  }
}

function findEpicExe() {
  const local = process.env.LOCALAPPDATA || '';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const rel = 'Epic Games\\Launcher\\Portal\\Binaries';
  return [
    path.join(pf86, rel, 'Win32', 'EpicGamesLauncher.exe'),
    path.join(pf86, rel, 'Win64', 'EpicGamesLauncher.exe'),
    path.join(pf, rel, 'Win64', 'EpicGamesLauncher.exe'),
    path.join(local, 'Epic Games', 'Launcher', 'EpicGamesLauncher.exe'),
  ].find((p) => fs.existsSync(p)) || null;
}

const EPIC_DATA = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'com.epicgames.eglv2');
const CLEAR_ITEMS = ['auth', 'EBWebView'];

function clearSession() {
  const failed = [];
  const backupRoot = path.join(DATA_DIR, 'backup');
  const dest = path.join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-'));
  for (const item of CLEAR_ITEMS) {
    const src = path.join(EPIC_DATA, item);
    if (!fs.existsSync(src)) continue;
    try {
      fs.mkdirSync(dest, { recursive: true });
      const target = path.join(dest, item);
      try {
        fs.renameSync(src, target);
      } catch {
        fs.cpSync(src, target, { recursive: true });
        fs.rmSync(src, { recursive: true, force: true });
      }
    } catch {
      failed.push(item);
    }
  }
  try {
    for (const d of fs.readdirSync(backupRoot).sort().reverse().slice(3)) {
      fs.rmSync(path.join(backupRoot, d), { recursive: true, force: true });
    }
  } catch {}
  return failed;
}

const SNAPSHOT_DIRS = ['auth'];
const SNAPSHOT_MAX = 8 * 1024 * 1024;

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function captureSnapshot(credHex) {
  const files = {};
  let total = 0;
  for (const d of SNAPSHOT_DIRS) {
    const dir = path.join(EPIC_DATA, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of walkFiles(dir)) {
      const buf = fs.readFileSync(f);
      total += buf.length;
      if (total > SNAPSHOT_MAX) throw new AppError('Epic session folder is too large to snapshot.');
      files[path.relative(EPIC_DATA, f).split(path.sep).join('/')] = buf.toString('base64');
    }
  }
  return JSON.stringify({ cred: credHex, files });
}

function restoreSnapshot(snap) {
  for (const [rel, b64] of Object.entries(snap.files || {})) {
    const target = path.resolve(EPIC_DATA, ...rel.split('/'));
    if (!target.startsWith(EPIC_DATA + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(b64, 'base64'));
  }
}

const pad = (n) => String(n).padStart(2, '0');
function nowStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let data = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      try { fs.renameSync(CONFIG_FILE, CONFIG_FILE + '.bak'); } catch {}
      data = {};
    }
  }
  if (!data.accounts) data = { accounts: data, settings: {} };
  data.settings = data.settings || {};
  if (data.settings.launch_after_switch === undefined) data.settings.launch_after_switch = true;
  if (data.settings.epic_path === undefined) data.settings.epic_path = '';
  if (data.settings.require_password === undefined) data.settings.require_password = true;
  return data;
}

function saveDb(db) {
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 4), 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
}

function epicPath(db) {
  const p = db.settings.epic_path;
  return p && fs.existsSync(p) ? p : findEpicExe();
}

function startEpic(db) {
  const p = epicPath(db);
  if (!p) throw new AppError('Epic Games Launcher not found. Set its path in Settings.');
  spawn(p, [], { detached: true, stdio: 'ignore' }).unref();
}

async function getStatus(db) {
  let cur = null;
  try { cur = readCurrentToken(); } catch {}
  const username = cur ? cur.username : null;
  let activeProfile = null;
  if (username) {
    const marked = db.settings.active_profile;
    if (marked && db.accounts[marked] && db.accounts[marked].username === username) {
      activeProfile = marked;
    } else {
      const same = Object.keys(db.accounts).filter((n) => db.accounts[n].username === username);
      if (same.length === 1) activeProfile = same[0];
    }
  }
  return { username, activeProfile, epicRunning: await epicRunning() };
}

async function publicState(db) {
  return {
    profiles: Object.entries(db.accounts)
      .map(([name, p]) => ({
        name,
        username: p.username,
        saved: p.saved || null,
        lastUsed: p.last_used || null,
        avatar: p.avatar || null,
        locked: p.v !== 4,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    settings: {
      requirePassword: db.settings.require_password !== false,
      launchAfterSwitch: !!db.settings.launch_after_switch,
      epicPath: db.settings.epic_path || '',
      resolvedEpicPath: epicPath(db) || '',
    },
  };
}

let busy = false;
function handle(channel, fn, { lock = false } = {}) {
  ipcMain.handle(channel, async (_e, arg) => {
    if (lock && busy) return { ok: false, error: 'Another operation is in progress.' };
    if (lock) busy = true;
    try {
      return { ok: true, data: await fn(arg || {}) };
    } catch (e) {
      return { ok: false, error: e instanceof AppError ? e.message : `Unexpected error: ${e.message}` };
    } finally {
      if (lock) busy = false;
    }
  });
}

handle('state', async () => publicState(loadDb()));
handle('status', async () => getStatus(loadDb()));

handle('save', async ({ name, password }) => {
  name = String(name || '').trim();
  if (!name) throw new AppError('Enter a profile name.');
  const db = loadDb();
  const usePassword = !!password;
  if (usePassword && password.length < 4) throw new AppError('Password must be at least 4 characters.');
  if (!usePassword && db.settings.require_password !== false) throw new AppError('A password is required (see Settings).');
  const wasRunning = await epicRunning();
  await killEpic();
  const cur = readCurrentToken();
  if (!cur || !cur.blobHex) {
    throw new AppError('No Epic Games token found. Sign in to the Launcher first (with "Remember me" enabled).');
  }
  const snapshot = captureSnapshot(cur.blobHex);
  db.accounts[name] = {
    v: usePassword ? 3 : 4,
    username: cur.username,
    token_encrypted: usePassword ? await encryptToken(snapshot, password) : encryptOpen(snapshot),
    saved: nowStr(),
    last_used: null,
    avatar: db.accounts[name] ? db.accounts[name].avatar : undefined,
  };
  db.settings.active_profile = name;
  saveDb(db);
  if (wasRunning) { try { startEpic(db); } catch {} }
  return publicState(db);
}, { lock: true });

handle('switch', async ({ name, password }) => {
  const db = loadDb();
  const prof = db.accounts[name];
  if (!prof) throw new AppError('Profile does not exist.');
  const opened = await openProfile(prof, password);
  const token = opened.cred;
  const snap = opened.legacy ? null : opened;
  if (![2, 3, 4].includes(prof.v)) {
    prof.token_encrypted = await encryptToken(token, password);
    prof.v = 2;
  }
  await killEpic();
  const failed = clearSession();
  writeTokenToSystem(prof.username, token);
  if (snap) restoreSnapshot(snap);
  prof.last_used = nowStr();
  db.settings.active_profile = name;
  saveDb(db);
  if (db.settings.launch_after_switch) startEpic(db);
  const st = await publicState(db);
  const notes = [];
  if (failed.length) notes.push(`Could not reset: ${failed.join(', ')} (file in use?).`);
  if (!snap) notes.push('This profile has no session snapshot - log in to that account, then re-save it.');
  if (notes.length) st.warning = notes.join(' ');
  return st;
}, { lock: true });

handle('setLock', async ({ name, password, newPassword }) => {
  const db = loadDb();
  const prof = db.accounts[name];
  if (!prof) throw new AppError('Profile does not exist.');
  if (newPassword) {
    if (newPassword.length < 4) throw new AppError('Password must be at least 4 characters.');
    if (prof.v !== 4) throw new AppError('This profile already has a password.');
    const opened = JSON.parse(decryptOpen(prof.token_encrypted));
    prof.token_encrypted = await encryptToken(JSON.stringify(opened), newPassword);
    prof.v = 3;
  } else {
    if (prof.v === 4) throw new AppError('This profile has no password.');
    const opened = await openProfile(prof, password);
    prof.token_encrypted = encryptOpen(JSON.stringify(opened));
    prof.v = 4;
  }
  saveDb(db);
  return publicState(db);
}, { lock: true });

handle('rename', async ({ oldName, newName }) => {
  newName = String(newName || '').trim();
  const db = loadDb();
  if (!newName) throw new AppError('Enter a name.');
  if (!db.accounts[oldName]) throw new AppError('Profile does not exist.');
  if (newName !== oldName && db.accounts[newName]) throw new AppError('A profile with this name already exists.');
  if (newName !== oldName) {
    db.accounts[newName] = db.accounts[oldName];
    delete db.accounts[oldName];
    if (db.settings.active_profile === oldName) db.settings.active_profile = newName;
    saveDb(db);
  }
  return publicState(db);
});

handle('remove', async ({ name }) => {
  const db = loadDb();
  delete db.accounts[name];
  if (db.settings.active_profile === name) db.settings.active_profile = null;
  saveDb(db);
  return publicState(db);
});

handle('settings', async (patch) => {
  const db = loadDb();
  if (typeof patch.launchAfterSwitch === 'boolean') db.settings.launch_after_switch = patch.launchAfterSwitch;
  if (typeof patch.requirePassword === 'boolean') db.settings.require_password = patch.requirePassword;
  if (typeof patch.epicPath === 'string') db.settings.epic_path = patch.epicPath;
  saveDb(db);
  return publicState(db);
});

handle('browse', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Select EpicGamesLauncher.exe',
    properties: ['openFile'],
    filters: [{ name: 'EpicGamesLauncher.exe', extensions: ['exe'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const db = loadDb();
  db.settings.epic_path = res.filePaths[0];
  saveDb(db);
  return publicState(db);
});

handle('pickImage', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose a picture',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  const file = res.filePaths[0];
  if (fs.statSync(file).size > 15 * 1024 * 1024) throw new AppError('Image is too large (max 15 MB).');
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' }[
    path.extname(file).slice(1).toLowerCase()
  ];
  if (!mime) throw new AppError('Unsupported image type.');
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
});

handle('setAvatar', async ({ name, avatar }) => {
  const db = loadDb();
  if (!db.accounts[name]) throw new AppError('Profile does not exist.');
  if (avatar === null) {
    delete db.accounts[name].avatar;
  } else {
    if (typeof avatar !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(avatar) || avatar.length > 500000) {
      throw new AppError('Invalid image.');
    }
    db.accounts[name].avatar = avatar;
  }
  saveDb(db);
  return publicState(db);
});

handle('launch', async () => { startEpic(loadDb()); return true; });
handle('openDataFolder', async () => { fs.mkdirSync(DATA_DIR, { recursive: true }); await shell.openPath(DATA_DIR); return true; });

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    backgroundColor: '#0e0f14',
    show: false,
    title: 'Epic Account Manager',
    icon: path.join(__dirname, 'icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0e0f14', symbolColor: '#9aa0b8', height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const showTimer = setTimeout(() => {
    if (win && !win.isDestroyed() && !win.isVisible()) win.show();
  }, 3000);
  win.once('ready-to-show', () => {
    clearTimeout(showTimer);
    win.show();
  });
  win.on('closed', () => {
    clearTimeout(showTimer);
    win = null;
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    if (code === -3) return;
    dialog.showErrorBox('Epic Account Manager', `Could not load the interface: ${desc}`);
    app.quit();
  });
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

const RETRY_FLAG = '--lock-retry=';
const retryArg = process.argv.find((a) => a.startsWith(RETRY_FLAG));
const lockRetries = retryArg ? Number(retryArg.slice(RETRY_FLAG.length)) || 0 : 0;

if (!app.requestSingleInstanceLock()) {
  if (lockRetries < 5) {
    setTimeout(() => {
      const args = process.argv.slice(1).filter((a) => !a.startsWith(RETRY_FLAG));
      args.push(RETRY_FLAG + (lockRetries + 1));
      app.relaunch({ execPath: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, args });
      app.exit(0);
    }, 700);
  } else {
    app.quit();
  }
} else {
  app.on('second-instance', () => {
    if (!win || win.isDestroyed()) {
      if (app.isReady()) createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}