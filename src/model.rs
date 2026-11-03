use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

fn yes() -> bool {
    true
}
fn is_false(b: &bool) -> bool {
    !*b
}

/// One saved account in `accounts.json` (field names match the Electron version).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub v: u8,
    pub username: String,
    pub token_encrypted: String,
    #[serde(default)]
    pub saved: Option<String>,
    #[serde(default)]
    pub last_used: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default = "yes")]
    pub launch_after_switch: bool,
    #[serde(default)]
    pub epic_path: String,
    #[serde(default = "yes")]
    pub require_password: bool,
    #[serde(default)]
    pub active_profile: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings { launch_after_switch: true, epic_path: String::new(), require_password: true, active_profile: None }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Db {
    #[serde(default)]
    pub accounts: BTreeMap<String, Profile>,
    #[serde(default)]
    pub settings: Settings,
}

/// Decrypted profile payload. v3/v4 carry a session snapshot (`files`);
/// v1/v2 only hold the credential and are flagged `legacy`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Opened {
    pub cred: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub files: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub legacy: bool,
}

/// What the Windows Credential Manager entry holds.
#[derive(Debug, Clone)]
pub struct Token {
    pub username: String,
    pub blob_hex: String,
}
