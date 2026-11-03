//! Compatibility with profiles written by the old Electron app.
//!
//! `tests/fixtures/node_vectors.json` was produced by running the *original* crypto
//! code from `main.js` (with DPAPI swapped for the identity function, since DPAPI is
//! supplied by Windows in both versions). If these pass, profiles saved by
//! `Epic.Account.Manager.1.0.0.exe` can be opened by this version.

use eam::crypto::{self, Protector};
use eam::error::Result;
use serde_json::Value;

struct Identity;
impl Protector for Identity {
    fn protect(&self, d: &[u8]) -> Result<Vec<u8>> {
        Ok(d.to_vec())
    }
    fn unprotect(&self, d: &[u8]) -> Result<Vec<u8>> {
        Ok(d.to_vec())
    }
}

fn vectors() -> Value {
    serde_json::from_str(include_str!("fixtures/node_vectors.json")).unwrap()
}

fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v[k].as_str().unwrap_or_else(|| panic!("missing {k}"))
}

#[test]
fn rust_opens_node_etm2_profiles() {
    let v = vectors();
    let pw = s(&v, "password");
    assert_eq!(crypto::decrypt_token(&Identity, s(&v, "etm2_short_hex"), pw).unwrap(), s(&v, "snapshot"));
    assert_eq!(crypto::decrypt_token(&Identity, s(&v, "etm2_long_hex"), pw).unwrap(), s(&v, "longSnapshot"));
}

#[test]
fn rust_rejects_wrong_password_on_node_profile() {
    let v = vectors();
    let err = crypto::decrypt_token(&Identity, s(&v, "etm2_short_hex"), "not the password").unwrap_err();
    assert_eq!(err.message(), "Wrong password.");
}

#[test]
fn rust_opens_node_password_free_profiles() {
    let v = vectors();
    assert_eq!(crypto::decrypt_open(&Identity, s(&v, "etm0_hex")).unwrap(), s(&v, "snapshot"));
}

#[test]
fn rust_opens_node_legacy_v1_profiles() {
    let v = vectors();
    assert_eq!(
        crypto::decrypt_legacy(&Identity, s(&v, "legacy_hex"), s(&v, "legacy_password")).unwrap(),
        s(&v, "legacy_plain")
    );
    assert!(crypto::decrypt_legacy(&Identity, s(&v, "legacy_hex"), "wrong").is_err());
}

/// Reverse direction: Rust writes, the original Node code reads. Run with
/// `EAM_RUST_VECTORS_OUT=<file> cargo test --test node_compat` and check it with
/// the original `decryptToken`/`decryptOpen` from main.js.
#[test]
fn emit_vectors_for_node() {
    let Some(out) = std::env::var_os("EAM_RUST_VECTORS_OUT") else { return };
    let v = vectors();
    let pw = s(&v, "password");
    let doc = serde_json::json!({
        "password": pw,
        "snapshot": s(&v, "snapshot"),
        "longSnapshot": s(&v, "longSnapshot"),
        "etm2_short_hex": crypto::encrypt_token(&Identity, s(&v, "snapshot"), pw).unwrap(),
        "etm2_long_hex": crypto::encrypt_token(&Identity, s(&v, "longSnapshot"), pw).unwrap(),
        "etm0_hex": crypto::encrypt_open(&Identity, s(&v, "snapshot")).unwrap(),
    });
    std::fs::write(out, serde_json::to_string_pretty(&doc).unwrap()).unwrap();
}
