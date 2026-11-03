# Changelog

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
