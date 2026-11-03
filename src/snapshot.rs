//! Capture / restore of the Epic Launcher session folder
//! (`%LOCALAPPDATA%\com.epicgames.eglv2\auth`) plus the "clear and back up" step.

use crate::error::{Error, Result};
use crate::model::Opened;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::collections::BTreeMap;
use std::fs;
use serde_json::Value;
use std::path::{Component, Path, PathBuf};

const SNAPSHOT_DIRS: &[&str] = &["auth"];
const CLEAR_ITEMS: &[&str] = &["auth", "EBWebView"];
/// Where the Launcher keeps the signed-in account's details, next to the DPAPI access token.
const AUTH_JSON: &[&str] = &["auth/auth.json", "auth.json"];
const SNAPSHOT_MAX: usize = 8 * 1024 * 1024;
const KEEP_BACKUPS: usize = 3;

fn walk_files(dir: &Path, out: &mut Vec<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let ty = entry.file_type()?;
        if ty.is_dir() {
            walk_files(&path, out)?;
        } else if ty.is_file() {
            out.push(path);
        }
    }
    Ok(())
}

fn rel_key(epic_data: &Path, file: &Path) -> String {
    file.strip_prefix(epic_data)
        .unwrap_or(file)
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// Serialize the credential blob and the session files into the JSON payload
/// that gets encrypted as a profile.
pub fn capture(epic_data: &Path, cred_hex: &str) -> Result<String> {
    let mut files = BTreeMap::new();
    let mut total = 0usize;
    for d in SNAPSHOT_DIRS {
        let dir = epic_data.join(d);
        if !dir.exists() {
            continue;
        }
        let mut list = Vec::new();
        walk_files(&dir, &mut list)?;
        for f in list {
            let buf = fs::read(&f)?;
            total += buf.len();
            if total > SNAPSHOT_MAX {
                return Err(Error::app("Epic session folder is too large to snapshot."));
            }
            files.insert(rel_key(epic_data, &f), STANDARD.encode(buf));
        }
    }
    Ok(serde_json::to_string(&Opened { cred: cred_hex.to_string(), files: Some(files), legacy: false })?)
}

/// A snapshot key is only accepted if every path segment is a plain name,
/// so a tampered profile can never write outside the Epic data folder.
fn safe_relative(rel: &str) -> Option<PathBuf> {
    if rel.is_empty() {
        return None;
    }
    let mut out = PathBuf::new();
    for seg in rel.split('/') {
        if seg.is_empty() || seg == "." || seg == ".." || seg.contains(['\\', ':']) {
            return None;
        }
        out.push(seg);
    }
    Some(out)
}

pub fn restore(epic_data: &Path, files: &BTreeMap<String, String>) -> Result<()> {
    for (rel, b64) in files {
        let Some(rel_path) = safe_relative(rel) else { continue };
        let target = epic_data.join(rel_path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target, STANDARD.decode(b64)?)?;
    }
    Ok(())
}

/// The signed-in account's display name from the Launcher's `auth.json`
/// (`{ "prod": { "account_info": { "display_name": "..." } } }`).
pub fn read_display_name(epic_data: &Path) -> Option<String> {
    AUTH_JSON.iter().find_map(|rel| display_name_from_json(&fs::read_to_string(epic_data.join(rel)).ok()?))
}

fn display_name_from_json(text: &str) -> Option<String> {
    let root: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let root = root.as_object()?;
    let pick = |env: &Value| -> Option<String> {
        let name = env.get("account_info")?.get("display_name")?.as_str()?.trim();
        (!name.is_empty()).then(|| name.chars().take(64).collect())
    };
    root.get("prod").and_then(pick).or_else(|| root.values().find_map(pick))
}

/// Recursive copy (existing files are overwritten).
pub fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), &to)?;
        }
    }
    Ok(())
}

/// Move the launcher's current session folders into `<data_dir>/backup/<utc-stamp>`
/// (never deleting them outright) and keep only the last few backups.
/// Returns the items that could not be moved (usually: files still in use).
pub fn clear_session(epic_data: &Path, data_dir: &Path) -> Vec<String> {
    let backup_root = data_dir.join("backup");
    let stamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S-%3fZ").to_string();
    let dest = backup_root.join(stamp);
    let mut failed = Vec::new();

    for item in CLEAR_ITEMS {
        let src = epic_data.join(item);
        if !src.exists() {
            continue;
        }
        let moved = (|| -> std::io::Result<()> {
            fs::create_dir_all(&dest)?;
            let target = dest.join(item);
            if fs::rename(&src, &target).is_err() {
                copy_dir(&src, &target)?;
                fs::remove_dir_all(&src)?;
            }
            Ok(())
        })();
        if moved.is_err() {
            failed.push((*item).to_string());
        }
    }

    if let Ok(read) = fs::read_dir(&backup_root) {
        let mut names: Vec<String> = read.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        names.sort();
        names.reverse();
        for old in names.into_iter().skip(KEEP_BACKUPS) {
            let _ = fs::remove_dir_all(backup_root.join(old));
        }
    }
    failed
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(p: &Path, content: &str) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, content).unwrap();
    }

    #[test]
    fn display_name_is_read_from_auth_json() {
        let epic = tempfile::tempdir().unwrap();
        assert_eq!(read_display_name(epic.path()), None, "no file");

        write(&epic.path().join("auth/auth.json"), r#"{ "prod": { "account_info": { "email": "x", "display_name": "  shdwlol ", "country": "PL" } } }"#);
        assert_eq!(read_display_name(epic.path()).as_deref(), Some("shdwlol"));

        // BOM, other environment names and the file next to the auth folder also work.
        let other = tempfile::tempdir().unwrap();
        write(&other.path().join("auth.json"), "\u{feff}{ \"gamedev\": { \"account_info\": { \"display_name\": \"Dev\" } } }");
        assert_eq!(read_display_name(other.path()).as_deref(), Some("Dev"));
    }

    #[test]
    fn display_name_ignores_unusable_files() {
        assert_eq!(display_name_from_json("not json"), None);
        assert_eq!(display_name_from_json("[]"), None);
        assert_eq!(display_name_from_json(r#"{ "prod": { "account_info": { "display_name": "   " } } }"#), None);
        assert_eq!(display_name_from_json(r#"{ "prod": { "account_info": {} } }"#), None);
        assert_eq!(display_name_from_json(r#"{ "prod": { "account_info": { "display_name": 5 } } }"#), None);
        let long = "a".repeat(200);
        let json = format!(r#"{{ "prod": {{ "account_info": {{ "display_name": "{long}" }} }} }}"#);
        assert_eq!(display_name_from_json(&json).unwrap().len(), 64);
    }

    #[test]
    fn capture_then_restore_roundtrip() {
        let epic = tempfile::tempdir().unwrap();
        write(&epic.path().join("auth/a.dat"), "AAA");
        write(&epic.path().join("auth/sub/b.dat"), "BBB");
        write(&epic.path().join("other/ignored.dat"), "NO");

        let json = capture(epic.path(), "cafe").unwrap();
        let opened: Opened = serde_json::from_str(&json).unwrap();
        assert_eq!(opened.cred, "cafe");
        let files = opened.files.unwrap();
        assert_eq!(files.keys().cloned().collect::<Vec<_>>(), vec!["auth/a.dat", "auth/sub/b.dat"]);

        let fresh = tempfile::tempdir().unwrap();
        restore(fresh.path(), &files).unwrap();
        assert_eq!(fs::read_to_string(fresh.path().join("auth/sub/b.dat")).unwrap(), "BBB");
        assert!(!fresh.path().join("other").exists());
    }

    #[test]
    fn restore_rejects_path_traversal() {
        let root = tempfile::tempdir().unwrap();
        let epic = root.path().join("epic");
        fs::create_dir_all(&epic).unwrap();
        let mut files = BTreeMap::new();
        let evil = STANDARD.encode("pwned");
        for key in ["../escaped.txt", "auth/../../escaped.txt", "/abs.txt", "C:/win.txt", "a\\b.txt", "auth//x", ""] {
            files.insert(key.to_string(), evil.clone());
        }
        files.insert("auth/ok.txt".to_string(), STANDARD.encode("fine"));
        restore(&epic, &files).unwrap();
        assert!(!root.path().join("escaped.txt").exists());
        assert!(!epic.join("abs.txt").exists());
        assert_eq!(fs::read_to_string(epic.join("auth/ok.txt")).unwrap(), "fine");
    }

    #[test]
    fn oversized_snapshot_is_refused() {
        let epic = tempfile::tempdir().unwrap();
        fs::create_dir_all(epic.path().join("auth")).unwrap();
        fs::write(epic.path().join("auth/big.bin"), vec![0u8; SNAPSHOT_MAX + 1]).unwrap();
        let err = capture(epic.path(), "00").unwrap_err();
        assert!(err.message().contains("too large"));
    }

    #[test]
    fn clear_moves_into_backup_and_prunes_old() {
        let epic = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        write(&epic.path().join("auth/a.dat"), "A");
        write(&epic.path().join("EBWebView/x.bin"), "X");
        for old in ["2020-01-01T00-00-00-000Z", "2021-01-01T00-00-00-000Z", "2022-01-01T00-00-00-000Z"] {
            fs::create_dir_all(data.path().join("backup").join(old)).unwrap();
        }

        let failed = clear_session(epic.path(), data.path());
        assert!(failed.is_empty());
        assert!(!epic.path().join("auth").exists() && !epic.path().join("EBWebView").exists());

        let mut left: Vec<_> = fs::read_dir(data.path().join("backup")).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        left.sort();
        assert_eq!(left.len(), KEEP_BACKUPS, "only the newest backups survive: {left:?}");
        assert!(!left.contains(&"2020-01-01T00-00-00-000Z".to_string()));
        let newest = left.last().unwrap();
        assert_eq!(fs::read_to_string(data.path().join("backup").join(newest).join("auth/a.dat")).unwrap(), "A");
    }
}
