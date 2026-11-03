//! Thin, safe-ish wrappers over the Win32 calls the app needs. This is the only
//! module with `unsafe`; it is pure FFI (no std::os::windows), so it can be
//! type-checked on any host with `--features win-ffi-check`.

use crate::crypto::hex;
use crate::error::{Error, Result};
use crate::model::Token;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::{GetLastError, LocalFree, ERROR_ALREADY_EXISTS};
use windows_sys::Win32::Security::Credentials::{
    CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
};
use windows_sys::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB};
use windows_sys::Win32::System::Threading::CreateMutexW;
use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowW, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Copy a DPAPI-allocated blob into a Vec and free the original.
unsafe fn take_blob(blob: CRYPT_INTEGER_BLOB) -> Vec<u8> {
    if blob.pbData.is_null() {
        return Vec::new();
    }
    let v = std::slice::from_raw_parts(blob.pbData, blob.cbData as usize).to_vec();
    LocalFree(blob.pbData as *mut _);
    v
}

/// DPAPI encrypt for the current Windows user (same description string as the old app).
pub fn dpapi_protect(data: &[u8]) -> Result<Vec<u8>> {
    unsafe {
        let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: null_mut() };
        let desc = wide("EpicToken");
        if CryptProtectData(&input, desc.as_ptr(), null(), null(), null(), 0, &mut out) == 0 {
            return Err(Error::app("Windows DPAPI encryption failed."));
        }
        Ok(take_blob(out))
    }
}

pub fn dpapi_unprotect(data: &[u8]) -> Result<Vec<u8>> {
    unsafe {
        let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut out = CRYPT_INTEGER_BLOB { cbData: 0, pbData: null_mut() };
        if CryptUnprotectData(&input, null_mut(), null(), null(), null(), 0, &mut out) == 0 {
            return Err(Error::app("Cannot decrypt this profile (saved by a different Windows user or PC?)."));
        }
        Ok(take_blob(out))
    }
}

unsafe fn from_wide_ptr(p: *const u16) -> String {
    if p.is_null() {
        return String::new();
    }
    let mut len = 0usize;
    while *p.add(len) != 0 {
        len += 1;
    }
    String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
}

/// Read a generic credential (user name + raw blob as hex), `None` if it does not exist.
pub fn read_credential(target: &str) -> Option<Token> {
    unsafe {
        let name = wide(target);
        let mut cred: *mut CREDENTIALW = null_mut();
        if CredReadW(name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut cred) == 0 || cred.is_null() {
            return None;
        }
        let c = &*cred;
        let blob: Vec<u8> = if c.CredentialBlobSize > 0 && !c.CredentialBlob.is_null() {
            std::slice::from_raw_parts(c.CredentialBlob, c.CredentialBlobSize as usize).to_vec()
        } else {
            Vec::new()
        };
        let token = Token { username: from_wide_ptr(c.UserName), blob_hex: hex(&blob) };
        CredFree(cred as *const _);
        Some(token)
    }
}

pub fn write_credential(target: &str, username: &str, blob: &[u8]) -> Result<()> {
    unsafe {
        let mut target_w = wide(target);
        let mut user_w = wide(username);
        let mut cred: CREDENTIALW = std::mem::zeroed();
        cred.Type = CRED_TYPE_GENERIC;
        cred.TargetName = target_w.as_mut_ptr();
        cred.UserName = user_w.as_mut_ptr();
        cred.CredentialBlobSize = blob.len() as u32;
        cred.CredentialBlob = blob.as_ptr() as *mut u8;
        cred.Persist = CRED_PERSIST_LOCAL_MACHINE;
        if CredWriteW(&cred, 0) == 0 {
            return Err(Error::app("Could not write the credential to Windows Credential Manager."));
        }
        Ok(())
    }
}

/// Take a named mutex. Returns `false` if another instance already owns it.
/// The handle is intentionally leaked: the mutex must live as long as the process.
pub fn acquire_single_instance(name: &str) -> bool {
    unsafe {
        let n = wide(name);
        let handle = CreateMutexW(null(), 0, n.as_ptr());
        if handle.is_null() {
            return true; // could not create it: do not block startup
        }
        GetLastError() != ERROR_ALREADY_EXISTS
    }
}

/// Bring an already-running instance's window (found by title) to the front.
pub fn focus_window_by_title(title: &str) {
    unsafe {
        let t = wide(title);
        let hwnd = FindWindowW(null(), t.as_ptr());
        if hwnd.is_null() {
            return;
        }
        if IsIconic(hwnd) != 0 {
            ShowWindow(hwnd, SW_RESTORE);
        }
        SetForegroundWindow(hwnd);
    }
}
