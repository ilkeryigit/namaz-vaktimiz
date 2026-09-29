use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

const MAIN_WINDOW: &str = "main";
const SETTINGS_WINDOW: &str = "settings";

fn show_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(SETTINGS_WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// Widget'ın tek geri dönüş yolu: pencere hiçbir koşulda geri getirilemezse
// uygulama kullanılamaz hale gelir.
fn show_widget(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn quit(app: &AppHandle) {
    app.exit(0);
}

/// Widget'ın köşesindeki ayarlar düğmesi bunu çağırır; tray menüsü de
/// aynı `show_settings` fonksiyonunu kullanır, ayrı yol yok.
#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // İlk sırada olmalı: ikinci örnek başka bir örnek doğmadan yakalanır.
        // Widget'ın kopyası veya çift tray ikonu oluşmasın, mevcut öne gelsin.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_widget(app);
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let settings = MenuItem::with_id(app, "settings", "Ayarlar…", true, None::<&str>)?;
            let hide =
                MenuItem::with_id(app, "hide-widget", "Widget'ı gizle", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&settings, &hide, &sep, &quit_i])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Namaz Vaktimiz")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => show_settings(app),
                    "hide-widget" => {
                        if let Some(w) = app.get_webview_window(MAIN_WINDOW) {
                            let _ = w.hide();
                        }
                    }
                    "quit" => quit(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Sol tık widget'ı geri getirir; sağ tık menüyü gösterir.
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_widget(tray.app_handle());
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
        .invoke_handler(tauri::generate_handler![open_settings])
        .run(tauri::generate_context!())
        .expect("ayarlar penceresi açılırken hata oluştu");
}
