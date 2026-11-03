//! End-to-end behaviour of the command layer on a fake OS: same rules and messages
//! as the old Electron `main.js` handlers.

use eam::app::App;
use eam::crypto::{self, Protector};
use eam::error::Result;
use eam::model::Token;
use eam::platform::Platform;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

struct Fake {
    root: PathBuf,
    token: Mutex<Option<Token>>,
    running: Mutex<bool>,
    kills: Mutex<u32>,
    starts: Mutex<u32>,
    exe: Option<PathBuf>,
}

impl Fake {
    fn new(root: &Path, with_exe: bool) -> Arc<Self> {
        let exe = root.join("EpicGamesLauncher.exe");
        if with_exe {
            fs::write(&exe, "").unwrap();
        }
        Arc::new(Fake {
            root: root.to_path_buf(),
            token: Mutex::new(None),
            running: Mutex::new(false),
            kills: Mutex::new(0),
            starts: Mutex::new(0),
            exe: with_exe.then_some(exe),
        })
    }

    /// Pretend the user signed in to `user` in the launcher.
    fn sign_in(&self, user: &str, blob_hex: &str, session_marker: &str) {
        *self.token.lock().unwrap() = Some(Token { username: user.into(), blob_hex: blob_hex.into() });
        let auth = self.epic_data_dir().join("auth");
        let _ = fs::remove_dir_all(&auth);
        fs::create_dir_all(&auth).unwrap();
        fs::write(auth.join("session.dat"), session_marker).unwrap();
    }

    fn session(&self) -> String {
        fs::read_to_string(self.epic_data_dir().join("auth/session.dat")).unwrap_or_default()
    }
}

impl Protector for Fake {
    fn protect(&self, d: &[u8]) -> Result<Vec<u8>> {
        Ok(d.iter().map(|b| b ^ 0x5a).collect())
    }
    fn unprotect(&self, d: &[u8]) -> Result<Vec<u8>> {
        self.protect(d)
    }
}

impl Platform for Fake {
    fn read_token(&self) -> Option<Token> {
        self.token.lock().unwrap().clone()
    }
    fn write_token(&self, username: &str, blob_hex: &str) -> Result<()> {
        *self.token.lock().unwrap() = Some(Token { username: username.into(), blob_hex: blob_hex.into() });
        Ok(())
    }
    fn epic_running(&self) -> bool {
        *self.running.lock().unwrap()
    }
    fn kill_epic(&self) {
        *self.kills.lock().unwrap() += 1;
        *self.running.lock().unwrap() = false;
    }
    fn start_epic(&self, _exe: &Path) -> Result<()> {
        *self.starts.lock().unwrap() += 1;
        *self.running.lock().unwrap() = true;
        Ok(())
    }
    fn find_epic_exe(&self) -> Option<PathBuf> {
        self.exe.clone()
    }
    fn data_dir(&self) -> PathBuf {
        self.root.join("EpicAccountManager")
    }
    fn epic_data_dir(&self) -> PathBuf {
        self.root.join("com.epicgames.eglv2")
    }
    fn open_folder(&self, _dir: &Path) -> Result<()> {
        Ok(())
    }
}

fn setup() -> (tempfile::TempDir, Arc<Fake>, App) {
    let dir = tempfile::tempdir().unwrap();
    let fake = Fake::new(dir.path(), true);
    let app = App::new(fake.clone());
    (dir, fake, app)
}

fn ok(v: Value) -> Value {
    assert_eq!(v["ok"], json!(true), "expected ok, got {v}");
    v["data"].clone()
}

fn err(v: Value) -> String {
    assert_eq!(v["ok"], json!(false), "expected error, got {v}");
    v["error"].as_str().unwrap().to_string()
}

fn save(app: &App, name: &str, pw: &str) -> Value {
    app.call("save", &json!({ "name": name, "password": pw }))
}

fn switch(app: &App, name: &str, pw: &str) -> Value {
    app.call("switch", &json!({ "name": name, "password": pw }))
}

fn profile<'a>(state: &'a Value, name: &str) -> &'a Value {
    state["profiles"].as_array().unwrap().iter().find(|p| p["name"] == name).unwrap_or_else(|| panic!("no profile {name}"))
}

#[test]
fn save_validation_messages() {
    let (_d, fake, app) = setup();
    fake.sign_in("a@x", "aa", "A");
    assert_eq!(err(save(&app, "  ", "pw12")), "Enter a profile name.");
    assert_eq!(err(save(&app, "A", "abc")), "Password must be at least 4 characters.");
    assert_eq!(err(save(&app, "A", "")), "A password is required (see Settings).");
    assert_eq!(*fake.kills.lock().unwrap(), 0, "validation failures must not close the launcher");
}

#[test]
fn save_without_launcher_token_fails_cleanly() {
    let (_d, _fake, app) = setup();
    let msg = err(save(&app, "A", "pw12"));
    assert!(msg.starts_with("No Epic Games token found."), "{msg}");
}

#[test]
fn save_then_switch_restores_credential_and_session() {
    let (_d, fake, app) = setup();

    fake.sign_in("alice@x", "a1a1", "SESSION-ALICE");
    let st = ok(save(&app, "Alice", "pw-alice"));
    assert_eq!(profile(&st, "Alice")["locked"], json!(true));
    assert_eq!(profile(&st, "Alice")["username"], json!("alice@x"));

    fake.sign_in("bob@x", "b2b2", "SESSION-BOB");
    ok(save(&app, "Bob", "pw-bob"));

    // Currently Bob; switch to Alice.
    let st = ok(switch(&app, "Alice", "pw-alice"));
    let tok = fake.read_token().unwrap();
    assert_eq!((tok.username.as_str(), tok.blob_hex.as_str()), ("alice@x", "a1a1"));
    assert_eq!(fake.session(), "SESSION-ALICE");
    assert!(profile(&st, "Alice")["lastUsed"].is_string());
    assert_eq!(*fake.starts.lock().unwrap(), 1, "launcher restarted after switch");
    assert!(st.get("warning").is_none());

    // Bob's old session was backed up, not deleted.
    let backups: Vec<_> = fs::read_dir(fake.data_dir().join("backup")).unwrap().flatten().collect();
    assert_eq!(backups.len(), 1);
    assert_eq!(fs::read_to_string(backups[0].path().join("auth/session.dat")).unwrap(), "SESSION-BOB");

    // And back to Bob.
    ok(switch(&app, "Bob", "pw-bob"));
    assert_eq!(fake.session(), "SESSION-BOB");
    assert_eq!(fake.read_token().unwrap().username, "bob@x");
}

#[test]
fn wrong_password_changes_nothing() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", "a1a1", "SESSION-ALICE");
    ok(save(&app, "Alice", "pw-alice"));
    fake.sign_in("bob@x", "b2b2", "SESSION-BOB");
    let kills_before = *fake.kills.lock().unwrap();

    assert_eq!(err(switch(&app, "Alice", "nope")), "Wrong password.");
    assert_eq!(*fake.kills.lock().unwrap(), kills_before, "launcher must not be closed on a wrong password");
    assert_eq!(fake.read_token().unwrap().username, "bob@x");
    assert_eq!(fake.session(), "SESSION-BOB");
    assert_eq!(err(switch(&app, "Ghost", "")), "Profile does not exist.");
}

#[test]
fn password_free_profiles_and_lock_toggling() {
    let (_d, fake, app) = setup();
    ok(app.call("settings", &json!({ "requirePassword": false })));
    fake.sign_in("alice@x", "a1a1", "SESSION-ALICE");
    let st = ok(save(&app, "Alice", ""));
    assert_eq!(profile(&st, "Alice")["locked"], json!(false));

    fake.sign_in("bob@x", "b2b2", "SESSION-BOB");
    ok(switch(&app, "Alice", ""));
    assert_eq!(fake.session(), "SESSION-ALICE");

    // add a password, then it is required
    assert_eq!(err(app.call("setLock", &json!({ "name": "Alice", "newPassword": "ab" }))), "Password must be at least 4 characters.");
    let st = ok(app.call("setLock", &json!({ "name": "Alice", "newPassword": "secret1" })));
    assert_eq!(profile(&st, "Alice")["locked"], json!(true));
    assert_eq!(err(app.call("setLock", &json!({ "name": "Alice", "newPassword": "another" }))), "This profile already has a password.");
    assert_eq!(err(switch(&app, "Alice", "")), "Wrong password.");
    ok(switch(&app, "Alice", "secret1"));

    // remove it again (needs the current password)
    assert_eq!(err(app.call("setLock", &json!({ "name": "Alice", "password": "bad", "newPassword": null }))), "Wrong password.");
    let st = ok(app.call("setLock", &json!({ "name": "Alice", "password": "secret1", "newPassword": null })));
    assert_eq!(profile(&st, "Alice")["locked"], json!(false));
    assert_eq!(err(app.call("setLock", &json!({ "name": "Alice", "password": null, "newPassword": null }))), "This profile has no password.");
    ok(switch(&app, "Alice", ""));
    assert_eq!(fake.session(), "SESSION-ALICE", "snapshot survives lock changes");
}

#[test]
fn launch_after_switch_can_be_disabled() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", "a1a1", "A");
    ok(save(&app, "Alice", "pw12"));
    ok(app.call("settings", &json!({ "launchAfterSwitch": false })));
    ok(switch(&app, "Alice", "pw12"));
    assert_eq!(*fake.starts.lock().unwrap(), 0);
}

#[test]
fn saving_while_launcher_runs_restarts_it() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", "a1a1", "A");
    *fake.running.lock().unwrap() = true;
    ok(save(&app, "Alice", "pw12"));
    assert_eq!(*fake.starts.lock().unwrap(), 1);
}

#[test]
fn rename_remove_and_active_profile_tracking() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", "a1a1", "A");
    ok(save(&app, "Alice", "pw12"));
    fake.sign_in("bob@x", "b2b2", "B");
    ok(save(&app, "Bob", "pw12"));

    assert_eq!(err(app.call("rename", &json!({ "oldName": "Alice", "newName": "Bob" }))), "A profile with this name already exists.");
    assert_eq!(err(app.call("rename", &json!({ "oldName": "Alice", "newName": " " }))), "Enter a name.");
    assert_eq!(err(app.call("rename", &json!({ "oldName": "Zed", "newName": "Q" }))), "Profile does not exist.");

    let st = ok(app.call("rename", &json!({ "oldName": "Bob", "newName": "robert" })));
    let names: Vec<_> = st["profiles"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect();
    assert_eq!(names, vec!["Alice", "robert"], "case-insensitive sort");
    let status = ok(app.call("status", &json!({})));
    assert_eq!(status["activeProfile"], json!("robert"), "active marker follows the rename");

    ok(app.call("remove", &json!({ "name": "robert" })));
    let status = ok(app.call("status", &json!({})));
    assert_eq!(status["username"], json!("bob@x"));
    assert_eq!(status["activeProfile"], Value::Null);
}

#[test]
fn avatar_validation() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", "a1a1", "A");
    ok(save(&app, "Alice", "pw12"));
    let good = "data:image/png;base64,iVBORw0KGgo=";
    let st = ok(app.call("setAvatar", &json!({ "name": "Alice", "avatar": good })));
    assert_eq!(profile(&st, "Alice")["avatar"], json!(good));
    for bad in ["data:image/jpeg;base64,AAAA", "data:image/png;base64,", "data:image/png;base64,<script>", "http://evil/x.png"] {
        assert_eq!(err(app.call("setAvatar", &json!({ "name": "Alice", "avatar": bad }))), "Invalid image.", "{bad}");
    }
    let huge = format!("data:image/png;base64,{}", "A".repeat(500_000));
    assert_eq!(err(app.call("setAvatar", &json!({ "name": "Alice", "avatar": huge }))), "Invalid image.");
    assert_eq!(err(app.call("setAvatar", &json!({ "name": "Nobody", "avatar": good }))), "Profile does not exist.");
    // re-saving keeps the picture
    ok(save(&app, "Alice", "pw12"));
    let st = ok(app.call("state", &json!({})));
    assert_eq!(profile(&st, "Alice")["avatar"], json!(good));
    let st = ok(app.call("setAvatar", &json!({ "name": "Alice", "avatar": null })));
    assert_eq!(profile(&st, "Alice")["avatar"], Value::Null);
}

#[test]
fn legacy_v1_profile_is_upgraded_on_first_switch() {
    let (_d, fake, app) = setup();
    // hand-build a v1 profile: DPAPI(hex-token XOR sha256(password))
    let key = Sha256::digest(b"old-pw");
    let xored: Vec<u8> = b"c0ffee".iter().enumerate().map(|(i, b)| b ^ key[i % 32]).collect();
    let enc = crypto::hex(&fake.protect(&xored).unwrap());
    fs::create_dir_all(fake.data_dir()).unwrap();
    fs::write(
        fake.data_dir().join("accounts.json"),
        serde_json::to_string(&json!({
            "accounts": { "Old": { "v": 1, "username": "old@x", "token_encrypted": enc, "saved": "2025-01-01 00:00", "last_used": null } },
            "settings": {}
        }))
        .unwrap(),
    )
    .unwrap();

    assert_eq!(err(switch(&app, "Old", "wrong")), "Wrong password.");
    let st = ok(switch(&app, "Old", "old-pw"));
    assert_eq!(fake.read_token().unwrap().blob_hex, "c0ffee");
    assert!(st["warning"].as_str().unwrap().contains("no session snapshot"), "{st}");
    // upgraded to the scrypt format: still opens with the same password
    let saved: Value = serde_json::from_str(&fs::read_to_string(fake.data_dir().join("accounts.json")).unwrap()).unwrap();
    assert_eq!(saved["accounts"]["Old"]["v"], json!(2));
    ok(switch(&app, "Old", "old-pw"));
}

#[test]
fn launcher_missing_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let fake = Fake::new(dir.path(), false);
    let app = App::new(fake.clone());
    fake.sign_in("alice@x", "a1a1", "A");
    ok(save(&app, "Alice", "pw12"));
    assert_eq!(err(app.call("launch", &json!({}))), "Epic Games Launcher not found. Set its path in Settings.");
    let st = ok(app.call("state", &json!({})));
    assert_eq!(st["settings"]["resolvedEpicPath"], json!(""));
}

#[test]
fn browse_and_image_dialog_results() {
    let (d, _fake, app) = setup();
    assert_eq!(ok(app.apply_browse(None)), Value::Null);
    let exe = d.path().join("MyLauncher.exe");
    fs::write(&exe, "").unwrap();
    let st = ok(app.apply_browse(Some(exe.clone())));
    assert_eq!(st["settings"]["epicPath"], json!(exe.to_string_lossy()));
    assert_eq!(st["settings"]["resolvedEpicPath"], json!(exe.to_string_lossy()));

    assert_eq!(ok(app.load_image(None)), Value::Null);
    let png = d.path().join("pic.PNG");
    fs::write(&png, [1u8, 2, 3]).unwrap();
    assert_eq!(ok(app.load_image(Some(png))), json!("data:image/png;base64,AQID"));
    let txt = d.path().join("notes.txt");
    fs::write(&txt, "x").unwrap();
    assert_eq!(err(app.load_image(Some(txt))), "Unsupported image type.");
}

#[test]
fn unknown_command_is_an_error_not_a_panic() {
    let (_d, _fake, app) = setup();
    assert!(err(app.call("format-c-drive", &json!({}))).starts_with("Unexpected error:"));
}
