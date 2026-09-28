use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const SETTINGS_WINDOW: &str = "settings";

fn show_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(SETTINGS_WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }
    let url = WebviewUrl::App("settings.html".into());
    let _ = WebviewWindowBuilder::new(app, SETTINGS_WINDOW, url)
        .title("Namaz Vaktimiz — Ayarlar")
        .inner_size(760.0, 660.0)
        .min_inner_size(620.0, 560.0)
        .resizable(true)
        .build();
}

fn quit(app: &AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // İlk sırada olmalı: ikinci örnek başka bir örnek doğmadan yakalanır.
        // Widget'ın kopyası veya çift tray ikonu oluşmasın, mevcut öne gelsin.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let settings = MenuItem::with_id(app, "settings", "Ayarlar…", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&settings, &sep, &quit_i])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Namaz Vaktimiz")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => show_settings(app),
                    "quit" => quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Sol tık: ayarları aç. Sağ tık menüyü gösterir.
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_settings(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Kapatma düğmesi pencereyi gizler; çıkış yalnız tray menüsünden.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("ayarlar penceresi açılırken hata oluştu");
}
