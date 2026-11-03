use crate::error::{Error, Result};
use crate::model::Db;
use serde::Serialize;
use serde_json::{ser::PrettyFormatter, Serializer, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub struct Store {
    dir: PathBuf,
}

impl Store {
    pub fn new(dir: PathBuf) -> Self {
        Store { dir }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    fn file(&self) -> PathBuf {
        self.dir.join("accounts.json")
    }

    pub fn load(&self) -> Result<Db> {
        fs::create_dir_all(&self.dir)?;
        let file = self.file();
        if !file.exists() {
            return Ok(Db::default());
        }
        let text = fs::read_to_string(&file)?;
        let value: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => {
                // Unreadable file: keep it as .bak and start fresh (same as before).
                let _ = fs::rename(&file, self.dir.join("accounts.json.bak"));
                return Ok(Db::default());
            }
        };
        // Very old files were a bare `{ name: profile }` map.
        let value = if value.get("accounts").is_some() {
            value
        } else {
            serde_json::json!({ "accounts": value, "settings": {} })
        };
        serde_json::from_value(value)
            .map_err(|e| Error::Unexpected(format!("accounts.json has an unexpected shape: {e}")))
    }

    /// Atomic save (temp file + rename), 4-space indent like the old app.
    pub fn save(&self, db: &Db) -> Result<()> {
        fs::create_dir_all(&self.dir)?;
        let mut buf = Vec::new();
        let mut ser = Serializer::with_formatter(&mut buf, PrettyFormatter::with_indent(b"    "));
        db.serialize(&mut ser)?;
        let tmp = self.dir.join("accounts.json.tmp");
        fs::write(&tmp, &buf)?;
        fs::rename(&tmp, self.file())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Profile;

    fn profile() -> Profile {
        Profile { v: 4, username: "u".into(), token_encrypted: "ab".into(), saved: Some("2026-01-01 10:00".into()), last_used: None, avatar: None }
    }

    #[test]
    fn missing_file_gives_defaults() {
        let d = tempfile::tempdir().unwrap();
        let db = Store::new(d.path().to_path_buf()).load().unwrap();
        assert!(db.accounts.is_empty());
        assert!(db.settings.launch_after_switch && db.settings.require_password);
    }

    #[test]
    fn roundtrip() {
        let d = tempfile::tempdir().unwrap();
        let s = Store::new(d.path().to_path_buf());
        let mut db = Db::default();
        db.accounts.insert("Main".into(), profile());
        s.save(&db).unwrap();
        let back = s.load().unwrap();
        assert_eq!(back.accounts["Main"].username, "u");
        assert!(!d.path().join("accounts.json.tmp").exists());
    }

    #[test]
    fn reads_electron_era_file() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(
            d.path().join("accounts.json"),
            r#"{
    "accounts": { "Alt": { "v": 3, "username": "x", "token_encrypted": "00", "saved": "2026-10-01 09:00", "last_used": null } },
    "settings": { "launch_after_switch": false, "epic_path": "", "active_profile": "Alt" }
}"#,
        )
        .unwrap();
        let db = Store::new(d.path().to_path_buf()).load().unwrap();
        assert_eq!(db.accounts["Alt"].v, 3);
        assert!(!db.settings.launch_after_switch);
        assert!(db.settings.require_password, "missing key defaults to true");
        assert_eq!(db.settings.active_profile.as_deref(), Some("Alt"));
    }

    #[test]
    fn reads_bare_legacy_map() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("accounts.json"), r#"{ "Old": { "v": 1, "username": "o", "token_encrypted": "11" } }"#).unwrap();
        let db = Store::new(d.path().to_path_buf()).load().unwrap();
        assert_eq!(db.accounts["Old"].v, 1);
    }

    #[test]
    fn corrupt_file_is_backed_up() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("accounts.json"), "{ not json").unwrap();
        let db = Store::new(d.path().to_path_buf()).load().unwrap();
        assert!(db.accounts.is_empty());
        assert!(d.path().join("accounts.json.bak").exists());
    }
}
