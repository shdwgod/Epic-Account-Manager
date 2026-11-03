//! Profile encryption. The on-disk formats are byte-compatible with the Electron
//! version, so profiles saved by `Epic.Account.Manager.1.0.0.exe` keep working:
//!
//! * `ETM2` (v2/v3): scrypt(N=32768, r=8, p=1) -> 64 bytes (enc key | mac key),
//!   HMAC-SHA256 counter-mode keystream, HMAC-SHA256 tag, then wrapped in DPAPI.
//! * `ETM0` (v4): password-free, DPAPI only.
//! * legacy v1: DPAPI + XOR with SHA-256(password).

use crate::error::{Error, Result};
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const MAGIC: &[u8; 4] = b"ETM2";
const MAGIC_OPEN: &[u8; 4] = b"ETM0";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 16;
const TAG_LEN: usize = 32;

/// Machine/user bound wrapping layer (Windows DPAPI in the real app).
pub trait Protector {
    fn protect(&self, data: &[u8]) -> Result<Vec<u8>>;
    fn unprotect(&self, data: &[u8]) -> Result<Vec<u8>>;
}

fn hmac(key: &[u8]) -> HmacSha256 {
    <HmacSha256 as KeyInit>::new_from_slice(key).expect("HMAC accepts any key length")
}

fn derive(password: &str, salt: &[u8]) -> Result<([u8; 32], [u8; 32])> {
    let params = scrypt::Params::new(15, 8, 1).map_err(|e| Error::Unexpected(e.to_string()))?;
    let mut out = [0u8; 64];
    scrypt::scrypt(password.as_bytes(), salt, &params, &mut out)
        .map_err(|e| Error::Unexpected(e.to_string()))?;
    let mut enc = [0u8; 32];
    let mut mac = [0u8; 32];
    enc.copy_from_slice(&out[..32]);
    mac.copy_from_slice(&out[32..]);
    Ok((enc, mac))
}

fn stream_xor(key: &[u8], nonce: &[u8], data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len());
    for (counter, chunk) in data.chunks(32).enumerate() {
        let mut m = hmac(key);
        m.update(nonce);
        m.update(&(counter as u64).to_be_bytes());
        let ks = m.finalize().into_bytes();
        out.extend(chunk.iter().zip(ks.iter()).map(|(a, b)| a ^ b));
    }
    out
}

fn tag(mac_key: &[u8], salt: &[u8], nonce: &[u8], ct: &[u8]) -> HmacSha256 {
    let mut m = hmac(mac_key);
    m.update(MAGIC);
    m.update(salt);
    m.update(nonce);
    m.update(ct);
    m
}

fn random<const N: usize>() -> Result<[u8; N]> {
    let mut buf = [0u8; N];
    getrandom::fill(&mut buf).map_err(|e| Error::Unexpected(format!("random generator failed: {e}")))?;
    Ok(buf)
}

/// Password layer only (no DPAPI): `ETM2 | salt | nonce | ciphertext | tag`.
pub fn seal(plain: &str, password: &str) -> Result<Vec<u8>> {
    let salt = random::<SALT_LEN>()?;
    let nonce = random::<NONCE_LEN>()?;
    seal_with(plain, password, &salt, &nonce)
}

fn seal_with(plain: &str, password: &str, salt: &[u8], nonce: &[u8]) -> Result<Vec<u8>> {
    let (enc, mac) = derive(password, salt)?;
    let ct = stream_xor(&enc, nonce, plain.as_bytes());
    let t = tag(&mac, salt, nonce, &ct).finalize().into_bytes();
    let mut raw = Vec::with_capacity(4 + SALT_LEN + NONCE_LEN + ct.len() + TAG_LEN);
    raw.extend_from_slice(MAGIC);
    raw.extend_from_slice(salt);
    raw.extend_from_slice(nonce);
    raw.extend_from_slice(&ct);
    raw.extend_from_slice(&t);
    Ok(raw)
}

pub fn unseal(raw: &[u8], password: &str) -> Result<String> {
    if raw.len() < 4 + SALT_LEN + NONCE_LEN + TAG_LEN || &raw[..4] != MAGIC {
        return Err(Error::app("Corrupted profile."));
    }
    let salt = &raw[4..4 + SALT_LEN];
    let nonce = &raw[4 + SALT_LEN..4 + SALT_LEN + NONCE_LEN];
    let ct = &raw[4 + SALT_LEN + NONCE_LEN..raw.len() - TAG_LEN];
    let given = &raw[raw.len() - TAG_LEN..];
    let (enc, mac) = derive(password, salt)?;
    // verify_slice compares in constant time
    tag(&mac, salt, nonce, ct)
        .verify_slice(given)
        .map_err(|_| Error::wrong_password())?;
    String::from_utf8(stream_xor(&enc, nonce, ct)).map_err(|_| Error::app("Corrupted profile."))
}

pub fn encrypt_token(p: &dyn Protector, plain: &str, password: &str) -> Result<String> {
    Ok(hex(&p.protect(&seal(plain, password)?)?))
}

pub fn decrypt_token(p: &dyn Protector, enc_hex: &str, password: &str) -> Result<String> {
    let raw = p.unprotect(&unhex(enc_hex)?)?;
    unseal(&raw, password)
}

/// v1 profiles: DPAPI(plain XOR sha256(password)). Only a hex string is a valid plaintext.
pub fn decrypt_legacy(p: &dyn Protector, enc_hex: &str, password: &str) -> Result<String> {
    let raw = p.unprotect(&unhex(enc_hex)?)?;
    let key = Sha256::digest(password.as_bytes());
    let plain: Vec<u8> = raw.iter().enumerate().map(|(i, b)| b ^ key[i % key.len()]).collect();
    let valid = plain.len() % 2 == 0 && plain.iter().all(|b| b.is_ascii_hexdigit());
    if !valid {
        return Err(Error::wrong_password());
    }
    Ok(String::from_utf8(plain).expect("hex digits are ASCII"))
}

pub fn encrypt_open(p: &dyn Protector, plain: &str) -> Result<String> {
    let mut raw = MAGIC_OPEN.to_vec();
    raw.extend_from_slice(plain.as_bytes());
    Ok(hex(&p.protect(&raw)?))
}

pub fn decrypt_open(p: &dyn Protector, enc_hex: &str) -> Result<String> {
    let raw = p.unprotect(&unhex(enc_hex)?)?;
    if raw.len() < 4 || &raw[..4] != MAGIC_OPEN {
        return Err(Error::app("Corrupted profile."));
    }
    String::from_utf8(raw[4..].to_vec()).map_err(|_| Error::app("Corrupted profile."))
}

pub fn hex(data: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(data.len() * 2);
    for b in data {
        s.push(DIGITS[(b >> 4) as usize] as char);
        s.push(DIGITS[(b & 15) as usize] as char);
    }
    s
}

pub fn unhex(s: &str) -> Result<Vec<u8>> {
    let bytes = s.as_bytes();
    if bytes.len() % 2 != 0 {
        return Err(Error::app("Corrupted profile."));
    }
    let nib = |c: u8| -> Result<u8> {
        match c {
            b'0'..=b'9' => Ok(c - b'0'),
            b'a'..=b'f' => Ok(c - b'a' + 10),
            b'A'..=b'F' => Ok(c - b'A' + 10),
            _ => Err(Error::app("Corrupted profile.")),
        }
    };
    bytes.chunks(2).map(|p| Ok(nib(p[0])? << 4 | nib(p[1])?)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Stand-in for DPAPI in tests: reversible, but visibly different from the input.
    pub struct XorProtector;
    impl Protector for XorProtector {
        fn protect(&self, d: &[u8]) -> Result<Vec<u8>> {
            Ok(d.iter().map(|b| b ^ 0x5a).collect())
        }
        fn unprotect(&self, d: &[u8]) -> Result<Vec<u8>> {
            self.protect(d)
        }
    }

    #[test]
    fn seal_roundtrip_and_wrong_password() {
        let raw = seal("{\"cred\":\"00ff\"}", "hunter22").unwrap();
        assert_eq!(unseal(&raw, "hunter22").unwrap(), "{\"cred\":\"00ff\"}");
        assert!(matches!(unseal(&raw, "hunter23"), Err(Error::App(m)) if m == "Wrong password."));
    }

    #[test]
    fn tampering_is_detected() {
        let mut raw = seal("secret", "pw12").unwrap();
        let mid = raw.len() / 2;
        raw[mid] ^= 1;
        assert!(unseal(&raw, "pw12").is_err());
    }

    #[test]
    fn open_and_token_roundtrip_through_protector() {
        let p = XorProtector;
        let e = encrypt_open(&p, "hello").unwrap();
        assert_eq!(decrypt_open(&p, &e).unwrap(), "hello");
        let t = encrypt_token(&p, "payload", "pw12").unwrap();
        assert_eq!(decrypt_token(&p, &t, "pw12").unwrap(), "payload");
        assert!(decrypt_token(&p, &t, "nope").is_err());
    }

    #[test]
    fn legacy_rejects_non_hex() {
        let p = XorProtector;
        let key = Sha256::digest(b"pw12");
        let plain = b"deadbeef";
        let xored: Vec<u8> = plain.iter().enumerate().map(|(i, b)| b ^ key[i % 32]).collect();
        let enc = hex(&p.protect(&xored).unwrap());
        assert_eq!(decrypt_legacy(&p, &enc, "pw12").unwrap(), "deadbeef");
        assert!(decrypt_legacy(&p, &enc, "bad!").is_err());
    }

    #[test]
    fn hex_roundtrip() {
        assert_eq!(unhex(&hex(&[0, 1, 254, 255])).unwrap(), vec![0, 1, 254, 255]);
        assert!(unhex("abc").is_err());
        assert!(unhex("zz").is_err());
    }
}
