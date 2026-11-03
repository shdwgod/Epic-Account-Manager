use crate::crypto::Protector;
use crate::error::Result;
use crate::model::Token;
use std::path::{Path, PathBuf};

/// Everything the core logic needs from the operating system. The Windows
/// implementation lives in `winplat`; tests use an in-memory fake.
pub trait Platform: Protector + Send + Sync {
    /// Current Epic token from Windows Credential Manager, if any.
    fn read_token(&self) -> Option<Token>;
    fn write_token(&self, username: &str, blob_hex: &str) -> Result<()>;

    fn epic_running(&self) -> bool;
    /// Force-close the launcher and wait (bounded) until it is gone.
    fn kill_epic(&self);
    fn start_epic(&self, exe: &Path) -> Result<()>;
    /// Auto-detect `EpicGamesLauncher.exe` in the usual install locations.
    fn find_epic_exe(&self) -> Option<PathBuf>;

    /// `%LOCALAPPDATA%\EpicAccountManager`
    fn data_dir(&self) -> PathBuf;
    /// Where older versions kept their data (`%USERPROFILE%\EpicAccountManager`); it is
    /// copied into `data_dir` once, the first time the new location is empty.
    fn legacy_data_dir(&self) -> Option<PathBuf> {
        None
    }
    /// `%LOCALAPPDATA%\com.epicgames.eglv2`
    fn epic_data_dir(&self) -> PathBuf;
    /// Open a folder in the file manager.
    fn open_folder(&self, dir: &Path) -> Result<()>;
}
