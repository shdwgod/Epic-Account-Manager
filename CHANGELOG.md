# Changelog

## Unreleased

### Changed
- **No more passwords.** Profiles are protected by Windows DPAPI only; the password option, strength meter and the "Require a password" setting are gone. Profiles saved with a password by an older version can no longer be opened: sign in to the account and use *Update saved session* once.
- **Saving is one click.** The save dialog is gone; a new profile is named after the account's Epic display name, read from the Launcher's `auth.json` (`prod.account_info.display_name`). A duplicate name gets a ` (2)` suffix, and without `auth.json` the account id is used. Re-saving the same account refreshes its existing profile and keeps a name you chose.
- The status banner shows the display name of an account that is not saved yet.
- **Data folder moved** to `%LOCALAPPDATA%\EpicAccountManager` (profiles, backups and the WebView2 cache are all there now). Data from the old `%USERPROFILE%\EpicAccountManager` is copied over automatically the first time the new folder has no `accounts.json`.

- **Calmer look.** Neutral graphite theme with a single accent; the coloured gradient tiles and background glow are gone. Accounts are neutral unless you pick a colour in *Edit profile*. The list view is the default (the grid is still one click away).

### Removed
- The `setLock` command and the `password` argument of `save` / `switch`.

## 2.1.0

### UI
- Completely redesigned interface: profile tiles (or a compact list), live status banner, search, sorting, pinning, per-profile colours.
- Single-step save dialog with password strength meter; detects when the signed-in account is already saved and warns before replacing a profile with a different account.
- Errors (for example a wrong password) are shown inside the dialog instead of closing it.
- Keyboard shortcuts: `Ctrl+F`, `Ctrl+N`, `Ctrl+,`, arrow keys; right-click profile menu.
- The UI recovers from backend errors instead of failing silently.

### Build and release
- Reworked GitHub Actions workflow: separate UI check, test + build and release jobs, `--locked` builds, tag/version consistency check, SHA-256 checksums.
- The executable is named `Epic Account Manager.exe`; releases ship it in `Epic-Account-Manager-vX.Y.Z-windows.zip` because GitHub rewrites spaces in asset names to dots.
- The exe's version resource now carries the proper product and original file name.

### Core
- New `setMeta` command (pin and colour); re-saving a profile keeps its picture, pin, colour and last-used time.
- A Launcher that cannot be started after a successful switch is now a warning, not a failed switch.
- The UI is served from an asset table; the exposed state includes the app version.

## 2.0.0
- Rewrite in Rust with a WebView2 window (no Electron, no Node.js).
