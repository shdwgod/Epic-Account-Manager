#![cfg_attr(windows, windows_subsystem = "windows")]

#[cfg(windows)]
mod shell;

#[cfg(windows)]
fn main() {
    shell::run();
}

#[cfg(not(windows))]
fn main() {
    eprintln!("Epic Account Manager only runs on Windows: it manages the Epic Games Launcher's Windows session.");
    std::process::exit(1);
}
