//! End-to-end behaviour of the command layer on a fake OS.

use eam::app::App;
use eam::crypto::{self, Protector};
use eam::error::Result;
use eam::model::Token;
use eam::platform::Platform;
use serde_json::{json, Value};
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

    /// Pretend the user signed in to `user` in the launcher. The launcher writes the
    /// account's display name to `auth/auth.json` (left out when `display` is `None`).
    fn sign_in(&self, user: &str, display: Option<&str>, blob_hex: &str, session_marker: &str) {
        *self.token.lock().unwrap() = Some(Token { username: user.into(), blob_hex: blob_hex.into() });
        let auth = self.epic_data_dir().join("auth");
        let _ = fs::remove_dir_all(&auth);
        fs::create_dir_all(&auth).unwrap();
        fs::write(auth.join("session.dat"), session_marker).unwrap();
        if let Some(name) = display {
            let json = json!({ "prod": { "account_info": { "email": "x", "display_name": name, "country": "PL" } } });
            fs::write(auth.join("auth.json"), json.to_string()).unwrap();
        }
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
    fn legacy_data_dir(&self) -> Option<PathBuf> {
        Some(self.root.join("old-data"))
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

/// Save the account the launcher is signed in to (the profile is named automatically).
fn save(app: &App) -> Value {
    app.call("save", &json!({}))
}

/// Refresh an existing profile.
fn save_as(app: &App, name: &str) -> Value {
    app.call("save", &json!({ "name": name }))
}

fn switch(app: &App, name: &str) -> Value {
    app.call("switch", &json!({ "name": name }))
}

fn profile<'a>(state: &'a Value, name: &str) -> &'a Value {
    state["profiles"].as_array().unwrap().iter().find(|p| p["name"] == name).unwrap_or_else(|| panic!("no profile {name}"))
}

fn names(state: &Value) -> Vec<&str> {
    state["profiles"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect()
}

#[test]
fn save_without_launcher_token_fails_cleanly() {
    let (_d, _fake, app) = setup();
    let msg = err(save(&app));
    assert!(msg.starts_with("No Epic Games token found."), "{msg}");
}

#[test]
fn refreshing_an_unknown_profile_is_rejected_before_closing_the_launcher() {
    let (_d, fake, app) = setup();
    fake.sign_in("a@x", Some("A"), "aa", "A");
    assert_eq!(err(save_as(&app, "Ghost")), "Profile does not exist.");
    assert_eq!(*fake.kills.lock().unwrap(), 0);
}

#[test]
fn profile_is_named_after_the_epic_display_name() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("shdwlol"), "a1a1", "A");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["shdwlol"]);
    assert_eq!(st["saved"], json!("shdwlol"));
    assert_eq!(profile(&st, "shdwlol")["username"], json!("alice@x"));
    assert_eq!(profile(&st, "shdwlol")["legacy"], json!(false));
    assert!(profile(&st, "shdwlol").get("locked").is_none(), "passwords are gone");
    assert!(st["settings"].get("requirePassword").is_none());
}

#[test]
fn without_auth_json_the_account_id_is_the_name() {
    let (_d, fake, app) = setup();
    fake.sign_in("carol@x", None, "c3c3", "C");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["carol@x"]);
}

#[test]
fn same_display_name_on_another_account_gets_a_suffix() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Sam"), "a1a1", "A");
    ok(save(&app));
    fake.sign_in("bob@x", Some("Sam"), "b2b2", "B");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["Sam", "Sam (2)"]);
    assert_eq!(profile(&st, "Sam (2)")["username"], json!("bob@x"));

    // Saving the same accounts again refreshes them instead of adding more profiles.
    fake.sign_in("bob@x", Some("Sam"), "b3b3", "B2");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["Sam", "Sam (2)"]);
    fake.sign_in("alice@x", Some("Sam"), "a4a4", "A2");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["Sam", "Sam (2)"]);
    assert_eq!(st["saved"], json!("Sam"));
}

#[test]
fn resaving_keeps_a_name_the_user_chose() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
    ok(app.call("rename", &json!({ "oldName": "Alice", "newName": "Main" })));
    fake.sign_in("alice@x", Some("Alice"), "a2a2", "A2");
    let st = ok(save(&app));
    assert_eq!(names(&st), vec!["Main"]);
    let st = ok(save_as(&app, "Main"));
    assert_eq!(names(&st), vec!["Main"]);
}

#[test]
fn status_reports_the_display_name() {
    let (_d, fake, app) = setup();
    let status = ok(app.call("status", &json!({})));
    assert_eq!(status["username"], Value::Null);
    assert_eq!(status["displayName"], Value::Null);

    fake.sign_in("alice@x", Some("shdwlol"), "a1a1", "A");
    let status = ok(app.call("status", &json!({})));
    assert_eq!(status["username"], json!("alice@x"));
    assert_eq!(status["displayName"], json!("shdwlol"));
}

#[test]
fn save_then_switch_restores_credential_and_session() {
    let (_d, fake, app) = setup();

    fake.sign_in("alice@x", Some("Alice"), "a1a1", "SESSION-ALICE");
    ok(save(&app));
    fake.sign_in("bob@x", Some("Bob"), "b2b2", "SESSION-BOB");
    ok(save(&app));

    // Currently Bob; switch to Alice.
    let st = ok(switch(&app, "Alice"));
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
    ok(switch(&app, "Bob"));
    assert_eq!(fake.session(), "SESSION-BOB");
    assert_eq!(fake.read_token().unwrap().username, "bob@x");

    assert_eq!(err(switch(&app, "Ghost")), "Profile does not exist.");
}

#[test]
fn profiles_saved_with_a_password_must_be_saved_again() {
    let (_d, fake, app) = setup();
    fake.sign_in("bob@x", Some("Bob"), "b2b2", "SESSION-BOB");

    // A v3 profile as written by an older version.
    let p: &dyn Protector = &*fake;
    let enc = crypto::encrypt_token(p, r#"{"cred":"a1a1","files":{}}"#, "old-pw").unwrap();
    fs::create_dir_all(fake.data_dir()).unwrap();
    fs::write(
        fake.data_dir().join("accounts.json"),
        json!({ "accounts": { "Old": { "v": 3, "username": "old@x", "token_encrypted": enc } }, "settings": { "require_password": true } }).to_string(),
    )
    .unwrap();

    let st = ok(app.call("state", &json!({})));
    assert_eq!(profile(&st, "Old")["legacy"], json!(true));

    let msg = err(switch(&app, "Old"));
    assert!(msg.contains("saved with a password") && msg.contains("save it again"), "{msg}");
    assert_eq!(*fake.kills.lock().unwrap(), 0, "the launcher must not be closed");
    assert_eq!(fake.read_token().unwrap().username, "bob@x");
    assert_eq!(fake.session(), "SESSION-BOB");

    // Signing in and saving again replaces it with a password-free profile.
    fake.sign_in("old@x", Some("Old"), "a1a1", "SESSION-OLD");
    let st = ok(save_as(&app, "Old"));
    assert_eq!(profile(&st, "Old")["legacy"], json!(false));
    ok(switch(&app, "Old"));
    assert_eq!(fake.session(), "SESSION-OLD");
}

#[test]
fn data_from_the_old_folder_is_migrated_once() {
    let dir = tempfile::tempdir().unwrap();
    let fake = Fake::new(dir.path(), true);
    {
        let app = App::new(fake.clone());
        fake.sign_in("alice@x", Some("Alice"), "a1a1", "SESSION-ALICE");
        ok(save(&app));
    }
    // Pretend this is what an older version left behind.
    fs::rename(fake.data_dir(), dir.path().join("old-data")).unwrap();
    assert!(!fake.data_dir().exists());

    let app = App::new(fake.clone());
    assert!(fake.data_dir().join("accounts.json").is_file());
    assert!(dir.path().join("old-data/accounts.json").is_file(), "the old folder is left alone");
    let st = ok(app.call("state", &json!({})));
    assert_eq!(names(&st), vec!["Alice"]);
    fake.sign_in("bob@x", Some("Bob"), "b2b2", "SESSION-BOB");
    ok(switch(&app, "Alice"));
    assert_eq!(fake.session(), "SESSION-ALICE");

    // Once the new folder has data, the old one is never copied again.
    ok(app.call("remove", &json!({ "name": "Alice" })));
    let app = App::new(fake.clone());
    let st = ok(app.call("state", &json!({})));
    assert!(names(&st).is_empty(), "{st}");
}

#[test]
fn launch_after_switch_can_be_disabled() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
    ok(app.call("settings", &json!({ "launchAfterSwitch": false })));
    ok(switch(&app, "Alice"));
    assert_eq!(*fake.starts.lock().unwrap(), 0);
}

#[test]
fn saving_while_launcher_runs_restarts_it() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    *fake.running.lock().unwrap() = true;
    ok(save(&app));
    assert_eq!(*fake.starts.lock().unwrap(), 1);
}

#[test]
fn rename_remove_and_active_profile_tracking() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
    fake.sign_in("bob@x", Some("Bob"), "b2b2", "B");
    ok(save(&app));

    assert_eq!(err(app.call("rename", &json!({ "oldName": "Alice", "newName": "Bob" }))), "A profile with this name already exists.");
    assert_eq!(err(app.call("rename", &json!({ "oldName": "Alice", "newName": " " }))), "Enter a name.");
    assert_eq!(err(app.call("rename", &json!({ "oldName": "Zed", "newName": "Q" }))), "Profile does not exist.");

    let st = ok(app.call("rename", &json!({ "oldName": "Bob", "newName": "robert" })));
    assert_eq!(names(&st), vec!["Alice", "robert"], "case-insensitive sort");
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
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
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
    ok(save(&app));
    let st = ok(app.call("state", &json!({})));
    assert_eq!(profile(&st, "Alice")["avatar"], json!(good));
    let st = ok(app.call("setAvatar", &json!({ "name": "Alice", "avatar": null })));
    assert_eq!(profile(&st, "Alice")["avatar"], Value::Null);
}

#[test]
fn launcher_missing_is_reported() {
    let dir = tempfile::tempdir().unwrap();
    let fake = Fake::new(dir.path(), false);
    let app = App::new(fake.clone());
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
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
    assert!(err(app.call("setLock", &json!({ "name": "A", "newPassword": "secret1" }))).starts_with("Unexpected error:"), "passwords are gone");
}

#[test]
fn pin_and_colour_are_stored_validated_and_survive_edits() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    let st = ok(save(&app));
    assert_eq!(profile(&st, "Alice")["pinned"], json!(false));
    assert_eq!(profile(&st, "Alice")["hue"], Value::Null);
    assert!(st["version"].is_string(), "the UI shows the app version");

    let st = ok(app.call("setMeta", &json!({ "name": "Alice", "pinned": true, "hue": 215 })));
    assert_eq!(profile(&st, "Alice")["pinned"], json!(true));
    assert_eq!(profile(&st, "Alice")["hue"], json!(215));

    // Fields that are not sent stay as they are.
    let st = ok(app.call("setMeta", &json!({ "name": "Alice", "hue": 40 })));
    assert_eq!(profile(&st, "Alice")["pinned"], json!(true));
    assert_eq!(profile(&st, "Alice")["hue"], json!(40));

    // Renaming and re-saving keep the customisation.
    ok(app.call("rename", &json!({ "oldName": "Alice", "newName": "Main" })));
    ok(save(&app));
    let st = ok(app.call("state", &json!({})));
    assert_eq!(profile(&st, "Main")["pinned"], json!(true));
    assert_eq!(profile(&st, "Main")["hue"], json!(40));

    // `null` goes back to the automatic colour; bad input is rejected.
    let st = ok(app.call("setMeta", &json!({ "name": "Main", "hue": null, "pinned": false })));
    assert_eq!(profile(&st, "Main")["hue"], Value::Null);
    assert_eq!(profile(&st, "Main")["pinned"], json!(false));
    for bad in [json!(360), json!(-5), json!("red"), json!(12.5)] {
        assert_eq!(err(app.call("setMeta", &json!({ "name": "Main", "hue": bad }))), "Invalid color.");
    }
    assert_eq!(err(app.call("setMeta", &json!({ "name": "Nobody", "pinned": true }))), "Profile does not exist.");
}

#[test]
fn resaving_keeps_last_used_time() {
    let (_d, fake, app) = setup();
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "A");
    ok(save(&app));
    let st = ok(switch(&app, "Alice"));
    let used = profile(&st, "Alice")["lastUsed"].clone();
    assert!(used.is_string());
    let st = ok(save(&app));
    assert_eq!(profile(&st, "Alice")["lastUsed"], used, "refreshing the session must not erase the history");
}

#[test]
fn switch_still_succeeds_when_the_launcher_cannot_be_started() {
    let dir = tempfile::tempdir().unwrap();
    let fake = Fake::new(dir.path(), false); // no EpicGamesLauncher.exe anywhere
    let app = App::new(fake.clone());
    fake.sign_in("alice@x", Some("Alice"), "a1a1", "SESSION-ALICE");
    ok(save(&app));
    fake.sign_in("bob@x", Some("Bob"), "b2b2", "SESSION-BOB");

    let st = ok(switch(&app, "Alice"));
    assert_eq!(fake.session(), "SESSION-ALICE", "the session was switched");
    assert_eq!(fake.read_token().unwrap().username, "alice@x");
    assert_eq!(st["warnings"], json!(["Epic Games Launcher not found. Set its path in Settings."]));
    assert!(st["warning"].as_str().unwrap().contains("not found"));
    assert!(profile(&st, "Alice")["lastUsed"].is_string(), "the switch is recorded");
    let status = ok(app.call("status", &json!({})));
    assert_eq!(status["activeProfile"], json!("Alice"));
}
