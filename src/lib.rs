//! Core of Epic Account Manager. Everything except the window shell lives here so it
//! can be unit-tested without Windows (the OS is hidden behind [`platform::Platform`]).

pub mod app;
pub mod crypto;
pub mod error;
pub mod model;
pub mod platform;
pub mod snapshot;
pub mod store;

/// Raw Win32 wrappers (DPAPI, Credential Manager, single-instance mutex).
#[cfg(any(windows, feature = "win-ffi-check"))]
pub mod win_ffi;

/// The real `Platform` implementation for Windows.
#[cfg(windows)]
pub mod winplat;
