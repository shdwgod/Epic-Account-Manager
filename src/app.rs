//! Application commands (the IPC handlers the UI talks to through `window.api`).
//! Every command returns `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`.

use crate::crypto;
use crate::error::{Error, Result};
use crate::model::{Db, Opened, Profile};
use crate::platform::Platform;
use crate::snapshot;
use crate::store::Store;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

const MAX_IMAGE_BYTES: u64 = 15 * 1024 * 1024;
const MAX_AVATAR_LEN: usize = 500_000;
const AVATAR_PREFIX: &str = "data:image/png;base64,";

pub struct App {
    platform: Arc<dyn Platform>,
    store: Store,
    busy: AtomicBool,
}

struct BusyGuard<'a>(&'a AtomicBool);
impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn arg_str<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}

/// A string argument that is `null`, missing or empty counts as "not given".
fn arg_opt<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str).filter(|s| !s.is_empty())
}

fn envelope(r: Result<Value>) -> Value {
    match r {
        Ok(data) => json!({ "ok": true, "data": data }),
        Err(e) => json!({ "ok": false, "error": e.message() }),
    }
}

fn now_str() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M").to_string()
}

impl App {
    pub fn new(platform: Arc<dyn Platform>) -> Self {
        let store = Store::new(platform.data_dir());
        App { platform, store, busy: AtomicBool::new(false) }
    }

    fn lock(&self) -> Result<BusyGuard<'_>> {
        self.busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| Error::app("Another operation is in progress."))?;
        Ok(BusyGuard(&self.busy))
    }

    /// Run one command by name. Never panics on bad input; always returns an envelope.
    pub fn call(&self, cmd: &str, arg: &Value) -> Value {
        envelope(self.dispatch(cmd, arg))
    }

    fn dispatch(&self, cmd: &str, arg: &Value) -> Result<Value> {
        match cmd {
            "state" => Ok(self.public_state(&self.store.load()?)),
            "status" => self.status(),
            "save" => {
                let _g = self.lock()?;
                self.save(arg)
            }
            "switch" => {
                let _g = self.lock()?;
                self.switch(arg)
            }
            "setLock" => {
                let _g = self.lock()?;
                self.set_lock(arg)
            }
            "rename" => self.rename(arg),
            "remove" => self.remove(arg),
            "settings" => self.settings(arg),
            "setAvatar" => self.set_avatar(arg),
            "setMeta" => self.set_meta(arg),
            "launch" => {
                self.start_epic(&self.store.load()?)?;
                Ok(json!(true))
            }
            "openDataFolder" => {
                std::fs::create_dir_all(self.store.dir())?;
                self.platform.open_folder(self.store.dir())?;
                Ok(json!(true))
            }
            other => Err(Error::Unexpected(format!("unknown command '{other}'"))),
        }
    }

    // ---- helpers -----------------------------------------------------------

    fn epic_path(&self, db: &Db) -> Option<PathBuf> {
        let p = &db.settings.epic_path;
        if !p.is_empty() && Path::new(p).exists() {
            Some(PathBuf::from(p))
        } else {
            self.platform.find_epic_exe()
        }
    }

    fn start_epic(&self, db: &Db) -> Result<()> {
        let exe = self
            .epic_path(db)
            .ok_or_else(|| Error::app("Epic Games Launcher not found. Set its path in Settings."))?;
        self.platform.start_epic(&exe)
    }

    fn public_state(&self, db: &Db) -> Value {
        let mut profiles: Vec<(&String, &Profile)> = db.accounts.iter().collect();
        profiles.sort_by_key(|(name, _)| name.to_lowercase());
        let profiles: Vec<Value> = profiles
            .into_iter()
            .map(|(name, p)| {
                json!({
                    "name": name,
                    "username": p.username,
                    "saved": p.saved,
                    "lastUsed": p.last_used,
                    "avatar": p.avatar,
                    "locked": p.v != 4,
                    "pinned": p.pinned,
                    "hue": p.hue,
                })
            })
            .collect();
        json!({
            "version": env!("CARGO_PKG_VERSION"),
            "profiles": profiles,
            "settings": {
                "requirePassword": db.settings.require_password,
                "launchAfterSwitch": db.settings.launch_after_switch,
                "epicPath": db.settings.epic_path,
                "resolvedEpicPath": self.epic_path(db).map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
            }
        })
    }

    fn open_profile(&self, prof: &Profile, password: &str) -> Result<Opened> {
        let p: &dyn crypto::Protector = &*self.platform;
        Ok(match prof.v {
            4 => serde_json::from_str(&crypto::decrypt_open(p, &prof.token_encrypted)?)?,
            3 => serde_json::from_str(&crypto::decrypt_token(p, &prof.token_encrypted, password)?)?,
            2 => Opened { cred: crypto::decrypt_token(p, &prof.token_encrypted, password)?, files: None, legacy: true },
            _ => Opened { cred: crypto::decrypt_legacy(p, &prof.token_encrypted, password)?, files: None, legacy: true },
        })
    }

    // ---- commands ----------------------------------------------------------

    fn status(&self) -> Result<Value> {
        let db = self.store.load()?;
        let cur = self.platform.read_token();
        let username = cur.map(|c| c.username);
        let mut active: Option<String> = None;
        if let Some(user) = &username {
            let marked = db.settings.active_profile.as_ref().filter(|m| db.accounts.get(*m).is_some_and(|p| &p.username == user));
            if let Some(m) = marked {
                active = Some(m.clone());
            } else {
                let same: Vec<&String> = db.accounts.iter().filter(|(_, p)| &p.username == user).map(|(n, _)| n).collect();
                if same.len() == 1 {
                    active = Some(same[0].clone());
                }
            }
        }
        Ok(json!({ "username": username, "activeProfile": active, "epicRunning": self.platform.epic_running() }))
    }

    fn save(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name").trim().to_string();
        if name.is_empty() {
            return Err(Error::app("Enter a profile name."));
        }
        let password = arg_str(arg, "password");
        let mut db = self.store.load()?;
        let use_password = !password.is_empty();
        if use_password && password.chars().count() < 4 {
            return Err(Error::app("Password must be at least 4 characters."));
        }
        if !use_password && db.settings.require_password {
            return Err(Error::app("A password is required (see Settings)."));
        }

        let was_running = self.platform.epic_running();
        self.platform.kill_epic();
        let cur = self
            .platform
            .read_token()
            .filter(|t| !t.blob_hex.is_empty())
            .ok_or_else(|| Error::app("No Epic Games token found. Sign in to the Launcher first (with \"Remember me\" enabled)."))?;

        let snapshot = snapshot::capture(&self.platform.epic_data_dir(), &cur.blob_hex)?;
        let p: &dyn crypto::Protector = &*self.platform;
        let token_encrypted =
            if use_password { crypto::encrypt_token(p, &snapshot, password)? } else { crypto::encrypt_open(p, &snapshot)? };

        // Re-saving a profile refreshes its session but keeps everything the user customised.
        let previous = db.accounts.get(&name).cloned();
        db.accounts.insert(
            name.clone(),
            Profile {
                v: if use_password { 3 } else { 4 },
                username: cur.username,
                token_encrypted,
                saved: Some(now_str()),
                last_used: previous.as_ref().and_then(|x| x.last_used.clone()),
                avatar: previous.as_ref().and_then(|x| x.avatar.clone()),
                pinned: previous.as_ref().is_some_and(|x| x.pinned),
                hue: previous.as_ref().and_then(|x| x.hue),
            },
        );
        db.settings.active_profile = Some(name);
        self.store.save(&db)?;
        if was_running {
            let _ = self.start_epic(&db);
        }
        Ok(self.public_state(&db))
    }

    fn switch(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name").to_string();
        let password = arg_str(arg, "password");
        let mut db = self.store.load()?;
        let prof = db.accounts.get(&name).cloned().ok_or_else(|| Error::app("Profile does not exist."))?;

        let opened = self.open_profile(&prof, password)?;
        let token = opened.cred.clone();
        let snapshot_files = if opened.legacy { None } else { Some(opened.files.clone().unwrap_or_default()) };

        // v1 profiles are upgraded to the scrypt format on first use.
        let upgraded = if ![2, 3, 4].contains(&prof.v) {
            Some(crypto::encrypt_token(&*self.platform, &token, password)?)
        } else {
            None
        };

        self.platform.kill_epic();
        let failed = snapshot::clear_session(&self.platform.epic_data_dir(), self.store.dir());
        self.platform.write_token(&prof.username, &token)?;
        if let Some(files) = &snapshot_files {
            snapshot::restore(&self.platform.epic_data_dir(), files)?;
        }

        if let Some(entry) = db.accounts.get_mut(&name) {
            if let Some(enc) = upgraded {
                entry.token_encrypted = enc;
                entry.v = 2;
            }
            entry.last_used = Some(now_str());
        }
        db.settings.active_profile = Some(name);
        self.store.save(&db)?;

        // The session is already switched at this point, so a launcher that cannot be
        // started is reported as a warning, not as a failed switch.
        let launch_error = if db.settings.launch_after_switch { self.start_epic(&db).err() } else { None };

        let mut state = self.public_state(&db);
        let mut notes = Vec::new();
        if !failed.is_empty() {
            notes.push(format!("Could not reset: {} (file in use?).", failed.join(", ")));
        }
        if snapshot_files.is_none() {
            notes.push("This profile has no session snapshot - log in to that account, then re-save it.".to_string());
        }
        if let Some(e) = launch_error {
            notes.push(e.message());
        }
        if !notes.is_empty() {
            // `warning` is the joined text; `warnings` lets the UI translate each note on its own.
            state["warning"] = Value::String(notes.join(" "));
            state["warnings"] = json!(notes);
        }
        Ok(state)
    }

    fn set_lock(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name");
        let mut db = self.store.load()?;
        let prof = db.accounts.get(name).cloned().ok_or_else(|| Error::app("Profile does not exist."))?;
        let p: &dyn crypto::Protector = &*self.platform;

        let (v, token_encrypted) = if let Some(new_password) = arg_opt(arg, "newPassword") {
            if new_password.chars().count() < 4 {
                return Err(Error::app("Password must be at least 4 characters."));
            }
            if prof.v != 4 {
                return Err(Error::app("This profile already has a password."));
            }
            let opened: Opened = serde_json::from_str(&crypto::decrypt_open(p, &prof.token_encrypted)?)?;
            (3, crypto::encrypt_token(p, &serde_json::to_string(&opened)?, new_password)?)
        } else {
            if prof.v == 4 {
                return Err(Error::app("This profile has no password."));
            }
            let opened = self.open_profile(&prof, arg_str(arg, "password"))?;
            (4, crypto::encrypt_open(p, &serde_json::to_string(&opened)?)?)
        };

        if let Some(entry) = db.accounts.get_mut(name) {
            entry.v = v;
            entry.token_encrypted = token_encrypted;
        }
        self.store.save(&db)?;
        Ok(self.public_state(&db))
    }

    fn rename(&self, arg: &Value) -> Result<Value> {
        let old = arg_str(arg, "oldName");
        let new = arg_str(arg, "newName").trim().to_string();
        let mut db = self.store.load()?;
        if new.is_empty() {
            return Err(Error::app("Enter a name."));
        }
        if !db.accounts.contains_key(old) {
            return Err(Error::app("Profile does not exist."));
        }
        if new != old && db.accounts.contains_key(&new) {
            return Err(Error::app("A profile with this name already exists."));
        }
        if new != old {
            if let Some(profile) = db.accounts.remove(old) {
                db.accounts.insert(new.clone(), profile);
            }
            if db.settings.active_profile.as_deref() == Some(old) {
                db.settings.active_profile = Some(new);
            }
            self.store.save(&db)?;
        }
        Ok(self.public_state(&db))
    }

    fn remove(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name");
        let mut db = self.store.load()?;
        db.accounts.remove(name);
        if db.settings.active_profile.as_deref() == Some(name) {
            db.settings.active_profile = None;
        }
        self.store.save(&db)?;
        Ok(self.public_state(&db))
    }

    fn settings(&self, patch: &Value) -> Result<Value> {
        let mut db = self.store.load()?;
        if let Some(b) = patch.get("launchAfterSwitch").and_then(Value::as_bool) {
            db.settings.launch_after_switch = b;
        }
        if let Some(b) = patch.get("requirePassword").and_then(Value::as_bool) {
            db.settings.require_password = b;
        }
        if let Some(s) = patch.get("epicPath").and_then(Value::as_str) {
            db.settings.epic_path = s.to_string();
        }
        self.store.save(&db)?;
        Ok(self.public_state(&db))
    }

    fn set_avatar(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name");
        let mut db = self.store.load()?;
        let entry = db.accounts.get_mut(name).ok_or_else(|| Error::app("Profile does not exist."))?;
        match arg.get("avatar") {
            None | Some(Value::Null) => entry.avatar = None,
            Some(Value::String(s)) if valid_avatar(s) => entry.avatar = Some(s.clone()),
            _ => return Err(Error::app("Invalid image.")),
        }
        self.store.save(&db)?;
        Ok(self.public_state(&db))
    }

    /// Pin / colour of a profile. Both fields are optional; `"hue": null` goes back to the automatic colour.
    fn set_meta(&self, arg: &Value) -> Result<Value> {
        let name = arg_str(arg, "name");
        let mut db = self.store.load()?;
        let entry = db.accounts.get_mut(name).ok_or_else(|| Error::app("Profile does not exist."))?;
        if let Some(pinned) = arg.get("pinned").and_then(Value::as_bool) {
            entry.pinned = pinned;
        }
        match arg.get("hue") {
            None => {}
            Some(Value::Null) => entry.hue = None,
            Some(v) => match v.as_u64() {
                Some(h) if h < 360 => entry.hue = Some(h as u16),
                _ => return Err(Error::app("Invalid color.")),
            },
        }
        self.store.save(&db)?;
        Ok(self.public_state(&db))
    }

    // ---- results of native dialogs (the dialogs themselves live in the shell) ----

    /// The user picked (or cancelled) `EpicGamesLauncher.exe` in the Browse dialog.
    pub fn apply_browse(&self, picked: Option<PathBuf>) -> Value {
        envelope((|| {
            let Some(path) = picked else { return Ok(Value::Null) };
            let mut db = self.store.load()?;
            db.settings.epic_path = path.to_string_lossy().into_owned();
            self.store.save(&db)?;
            Ok(self.public_state(&db))
        })())
    }

    /// The user picked (or cancelled) a picture; returns it as a data URL for cropping in the UI.
    pub fn load_image(&self, picked: Option<PathBuf>) -> Value {
        envelope((|| {
            let Some(path) = picked else { return Ok(Value::Null) };
            if std::fs::metadata(&path)?.len() > MAX_IMAGE_BYTES {
                return Err(Error::app("Image is too large (max 15 MB)."));
            }
            let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
            let mime = match ext.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                "bmp" => "image/bmp",
                _ => return Err(Error::app("Unsupported image type.")),
            };
            Ok(Value::String(format!("data:{mime};base64,{}", STANDARD.encode(std::fs::read(&path)?))))
        })())
    }
}

fn valid_avatar(s: &str) -> bool {
    let Some(body) = s.strip_prefix(AVATAR_PREFIX) else { return false };
    !body.is_empty() && s.len() <= MAX_AVATAR_LEN && body.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='))
}
