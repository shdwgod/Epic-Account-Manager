//! Windows implementation of [`Platform`].

use crate::crypto::{unhex, Protector};
use crate::error::{Error, Result};
use crate::model::Token;
use crate::platform::Platform;
use crate::win_ffi;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const EPIC_TARGET: &str = "LegacyGeneric:target=credentials.com.epicgames.eglv2.prod";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const DETACHED_PROCESS: u32 = 0x0000_0008;
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

pub struct WinPlatform;

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key).filter(|v| !v.is_empty()).map(PathBuf::from)
}

fn home_dir() -> PathBuf {
    env_path("USERPROFILE").unwrap_or_else(|| PathBuf::from("."))
}

fn local_app_data() -> PathBuf {
    env_path("LOCALAPPDATA").unwrap_or_else(|| home_dir().join("AppData").join("Local"))
}

/// Run a console tool without flashing a window and return its stdout.
fn run(cmd: &str, args: &[&str]) -> String {
    Command::new(cmd)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

impl Protector for WinPlatform {
    fn protect(&self, data: &[u8]) -> Result<Vec<u8>> {
        win_ffi::dpapi_protect(data)
    }
    fn unprotect(&self, data: &[u8]) -> Result<Vec<u8>> {
        win_ffi::dpapi_unprotect(data)
    }
}

impl Platform for WinPlatform {
    fn read_token(&self) -> Option<Token> {
        win_ffi::read_credential(EPIC_TARGET)
    }

    fn write_token(&self, username: &str, blob_hex: &str) -> Result<()> {
        win_ffi::write_credential(EPIC_TARGET, username, &unhex(blob_hex)?)
    }

    fn epic_running(&self) -> bool {
        run("tasklist", &["/FI", "IMAGENAME eq EpicGamesLauncher.exe", "/NH"])
            .to_lowercase()
            .contains("epicgameslauncher.exe")
    }

    fn kill_epic(&self) {
        run("taskkill", &["/F", "/IM", "EpicGamesLauncher.exe"]);
        run("taskkill", &["/F", "/IM", "EpicWebHelper.exe"]);
        let deadline = Instant::now() + Duration::from_secs(8);
        while Instant::now() < deadline {
            if !self.epic_running() {
                std::thread::sleep(Duration::from_millis(400));
                return;
            }
            std::thread::sleep(Duration::from_millis(200));
        }
    }

    fn start_epic(&self, exe: &Path) -> Result<()> {
        Command::new(exe)
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|_| ())
            .map_err(|e| Error::app(format!("Could not start the Epic Games Launcher: {e}")))
    }

    fn find_epic_exe(&self) -> Option<PathBuf> {
        let rel = Path::new("Epic Games").join("Launcher").join("Portal").join("Binaries");
        let pf86 = env_path("ProgramFiles(x86)").unwrap_or_else(|| PathBuf::from(r"C:\Program Files (x86)"));
        let pf = env_path("ProgramFiles").unwrap_or_else(|| PathBuf::from(r"C:\Program Files"));
        let local = env_path("LOCALAPPDATA").unwrap_or_default();
        [
            pf86.join(&rel).join("Win32").join("EpicGamesLauncher.exe"),
            pf86.join(&rel).join("Win64").join("EpicGamesLauncher.exe"),
            pf.join(&rel).join("Win64").join("EpicGamesLauncher.exe"),
            local.join("Epic Games").join("Launcher").join("EpicGamesLauncher.exe"),
        ]
        .into_iter()
        .find(|p| p.exists())
    }

    fn data_dir(&self) -> PathBuf {
        local_app_data().join("EpicAccountManager")
    }

    fn legacy_data_dir(&self) -> Option<PathBuf> {
        Some(home_dir().join("EpicAccountManager"))
    }

    fn epic_data_dir(&self) -> PathBuf {
        local_app_data().join("com.epicgames.eglv2")
    }

    fn open_folder(&self, dir: &Path) -> Result<()> {
        Command::new("explorer.exe")
            .arg(dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| Error::Unexpected(format!("could not open the folder: {e}")))
    }
}
