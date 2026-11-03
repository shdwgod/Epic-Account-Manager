//! Window shell: a tao window hosting the UI in WebView2 via wry.
//!
//! The UI (`ui/`) is embedded in the exe and served from `http://app.localhost/`.
//! `ui/` talks to the Rust core through `window.api`, which is injected below and
//! forwards each call to [`eam::app::App`] over wry's IPC channel.

use eam::app::App;
use eam::win_ffi;
use eam::winplat::WinPlatform;
use raw_window_handle::{
    DisplayHandle, HandleError, HasDisplayHandle, HasWindowHandle, RawWindowHandle, Win32WindowHandle, WindowHandle,
};
use serde_json::Value;
use std::borrow::Cow;
use std::num::NonZeroIsize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy};
use tao::platform::windows::{IconExtWindows, WindowExtWindows};
use tao::window::{Icon, WindowBuilder};
use wry::http::{header::CONTENT_TYPE, Request, Response};
use wry::{NewWindowResponse, PageLoadEvent, WebContext, WebViewBuilder, WebViewBuilderExtWindows};

const TITLE: &str = "Epic Account Manager";
const HOST: &str = "app.localhost";
const ORIGIN: &str = "http://app.localhost";
const SINGLE_INSTANCE_MUTEX: &str = "Local\\EpicAccountManager.SingleInstance";

/// Everything the UI is made of; embedded in the exe and served from `http://app.localhost/`.
const ASSETS: &[(&str, &str, &str)] = &[
    ("/", "text/html; charset=utf-8", include_str!("../ui/index.html")),
    ("/index.html", "text/html; charset=utf-8", include_str!("../ui/index.html")),
    ("/styles.css", "text/css; charset=utf-8", include_str!("../ui/styles.css")),
    ("/strings.js", "text/javascript; charset=utf-8", include_str!("../ui/strings.js")),
    ("/renderer.js", "text/javascript; charset=utf-8", include_str!("../ui/renderer.js")),
];

/// Replaces the old Electron `preload.js`: same `window.api` surface, backed by wry IPC.
const BRIDGE_JS: &str = r#"
(() => {
  const pending = new Map();
  let next = 1;
  window.__eamReply = (id, reply) => {
    const resolve = pending.get(id);
    if (resolve) { pending.delete(id); resolve(reply); }
  };
  const call = (cmd, arg) => new Promise((resolve) => {
    const id = next++;
    pending.set(id, resolve);
    window.ipc.postMessage(JSON.stringify({ id, cmd, arg: arg === undefined ? {} : arg }));
  });
  window.api = Object.freeze({
    state: () => call('state'),
    status: () => call('status'),
    save: (name) => call('save', name ? { name } : {}),
    switchTo: (name) => call('switch', { name }),
    rename: (oldName, newName) => call('rename', { oldName, newName }),
    remove: (name) => call('remove', { name }),
    settings: (patch) => call('settings', patch),
    browse: () => call('browse'),
    launch: () => call('launch'),
    pickImage: () => call('pickImage'),
    setAvatar: (name, avatar) => call('setAvatar', { name, avatar }),
    setMeta: (name, meta) => call('setMeta', { name, ...meta }),
    openDataFolder: () => call('openDataFolder'),
  });
})();
"#;

enum UserEvent {
    Reply { id: u64, json: String },
    Show,
}

/// Lets native dialogs be modal to the main window while running on a worker thread.
struct Parent(isize);

impl HasWindowHandle for Parent {
    fn window_handle(&self) -> Result<WindowHandle<'_>, HandleError> {
        let hwnd = NonZeroIsize::new(self.0).ok_or(HandleError::Unavailable)?;
        let raw = RawWindowHandle::Win32(Win32WindowHandle::new(hwnd));
        // SAFETY: the HWND belongs to the main window, which lives until the process exits.
        Ok(unsafe { WindowHandle::borrow_raw(raw) })
    }
}

impl HasDisplayHandle for Parent {
    fn display_handle(&self) -> Result<DisplayHandle<'_>, HandleError> {
        Ok(DisplayHandle::windows())
    }
}

fn serve(req: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let path = req.uri().path();
    let Some(&(_, mime, body)) = ASSETS.iter().find(|(p, _, _)| *p == path) else {
        return Response::builder()
            .status(404)
            .header(CONTENT_TYPE, "text/plain")
            .body(Cow::Borrowed(&b"Not found"[..]))
            .expect("static response");
    };
    Response::builder()
        .status(200)
        .header(CONTENT_TYPE, mime)
        .body(Cow::Borrowed(body.as_bytes()))
        .expect("static response")
}

fn pick(parent: isize, title: &str, filter_name: &str, exts: &[&str]) -> Option<PathBuf> {
    rfd::FileDialog::new()
        .set_title(title)
        .add_filter(filter_name, exts)
        .set_parent(&Parent(parent))
        .pick_file()
}

fn handle_ipc(req: Request<String>, app: &Arc<App>, proxy: &EventLoopProxy<UserEvent>, hwnd: isize) {
    // Only our own embedded page may drive the backend.
    if req.uri().host() != Some(HOST) {
        return;
    }
    let Ok(msg) = serde_json::from_str::<Value>(req.body()) else { return };
    let Some(id) = msg.get("id").and_then(Value::as_u64) else { return };
    let cmd = msg.get("cmd").and_then(Value::as_str).unwrap_or("").to_string();
    let arg = msg.get("arg").cloned().unwrap_or(Value::Null);

    let app = Arc::clone(app);
    let proxy = proxy.clone();
    // Commands can block for seconds (scrypt, closing the launcher, native dialogs),
    // so they never run on the UI thread.
    std::thread::spawn(move || {
        let reply = match cmd.as_str() {
            "browse" => app.apply_browse(pick(hwnd, "Select EpicGamesLauncher.exe", "EpicGamesLauncher.exe", &["exe"])),
            "pickImage" => {
                app.load_image(pick(hwnd, "Choose a picture", "Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp"]))
            }
            _ => app.call(&cmd, &arg),
        };
        let _ = proxy.send_event(UserEvent::Reply { id, json: reply.to_string() });
    });
}

pub fn run() {
    if let Err(message) = try_run() {
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title(TITLE)
            .set_description(message)
            .show();
    }
}

fn try_run() -> Result<(), String> {
    if !win_ffi::acquire_single_instance(SINGLE_INSTANCE_MUTEX) {
        win_ffi::focus_window_by_title(TITLE);
        return Ok(());
    }

    let app = Arc::new(App::new(Arc::new(WinPlatform)));

    let mut builder = EventLoopBuilder::<UserEvent>::with_user_event();
    let event_loop = builder.build();
    let proxy = event_loop.create_proxy();

    let window = WindowBuilder::new()
        .with_title(TITLE)
        .with_inner_size(LogicalSize::new(1040.0, 720.0))
        .with_min_inner_size(LogicalSize::new(820.0, 560.0))
        .with_visible(false) // shown once the page has loaded, so there is no white flash
        .with_theme(Some(tao::window::Theme::Dark))
        .with_window_icon(Icon::from_resource(1, None).ok())
        .build(&event_loop)
        .map_err(|e| format!("Could not create the window: {e}"))?;
    let hwnd = window.hwnd();

    // Keep WebView2's cache out of the folder next to the exe (portable-friendly).
    let webview_dir = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("EpicAccountManager")
        .join("WebView2");
    let mut context = WebContext::new(Some(webview_dir));

    let ipc_app = Arc::clone(&app);
    let ipc_proxy = proxy.clone();
    let load_proxy = proxy.clone();

    let webview = WebViewBuilder::new_with_web_context(&mut context)
        .with_background_color((14, 14, 16, 255))
        .with_initialization_script(BRIDGE_JS)
        .with_custom_protocol("app".into(), |_id, req| serve(req))
        .with_url(format!("{ORIGIN}/"))
        .with_ipc_handler(move |req| handle_ipc(req, &ipc_app, &ipc_proxy, hwnd))
        .with_navigation_handler(|url| url.starts_with(ORIGIN))
        .with_new_window_req_handler(|_url, _features| NewWindowResponse::Deny)
        .with_drag_drop_handler(|_event| true) // swallow file drops instead of navigating to them
        .with_on_page_load_handler(move |event, _url| {
            if matches!(event, PageLoadEvent::Finished) {
                let _ = load_proxy.send_event(UserEvent::Show);
            }
        })
        .with_devtools(false)
        .with_browser_accelerator_keys(false)
        .with_default_context_menus(false)
        .with_theme(wry::Theme::Dark)
        .build(&window)
        .map_err(|e| {
            format!(
                "Could not start the WebView2 runtime: {e}\n\n\
                 Epic Account Manager needs the Microsoft Edge WebView2 Runtime \
                 (preinstalled on Windows 11 and current Windows 10)."
            )
        })?;

    // Safety net: never leave the window hidden if the load event does not arrive.
    let fallback = proxy.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(3));
        let _ = fallback.send_event(UserEvent::Show);
    });

    event_loop.run(move |event, _target, control_flow| {
        let _keep_alive = &context;
        *control_flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(UserEvent::Reply { id, json }) => {
                let _ = webview.evaluate_script(&format!("window.__eamReply({id},{json})"));
            }
            Event::UserEvent(UserEvent::Show) => {
                if !window.is_visible() {
                    window.set_visible(true);
                    window.set_focus();
                }
            }
            Event::WindowEvent { event: WindowEvent::CloseRequested, .. } => *control_flow = ControlFlow::Exit,
            _ => {}
        }
    })
}
