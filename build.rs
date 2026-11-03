fn main() {
    println!("cargo:rerun-if-changed=icon.ico");
    println!("cargo:rerun-if-env-changed=EAM_SKIP_RC");

    // Embed the icon and version info into the .exe. Set EAM_SKIP_RC=1 to skip
    // (useful when cross-checking from a host that has no resource compiler).
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var_os("EAM_SKIP_RC").is_none()
    {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("icon.ico");
        res.set("ProductName", "Epic Account Manager");
        res.set("FileDescription", "Epic Account Manager");
        res.set("InternalName", "Epic Account Manager");
        res.set("OriginalFilename", "Epic Account Manager.exe");
        res.compile().expect("failed to embed Windows resources");
    }
}
