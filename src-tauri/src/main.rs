#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{
  Emitter, Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

use insight::view::{text_view, text_view_utils};

fn main() {
  #[cfg(debug_assertions)]
  {
    use std::io::Write;

    env_logger::Builder::new()
      .filter_module("insight", log::LevelFilter::Debug)
      .format(|buf, record| {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        writeln!(
          buf,
          "[{} {} {}] {}",
          now,
          record.level(),
          record.target(),
          record.args()
        )
      })
      .init();
  }

  tauri::Builder::default()
    .manage(text_view_utils::AppState::default())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      let args: Vec<String> = std::env::args().collect();
      if args.len() > 1 {
        let file_path = &args[1];
        // 将文件路径存储到AppState中,前端可以主动查询
        let state = app.state::<text_view_utils::AppState>();
        *state.pending_file_path.lock().unwrap() = Some(file_path.clone());

        if let Some(window) = app.get_webview_window("main") {
          // 设置窗口标题
          let title = format!("{} - Peek", file_path);
          window.set_title(&title).map_err(|e| e.to_string())?;

          window.show().map_err(|e| e.to_string())?;
          window.set_focus().map_err(|e| e.to_string())?;
          window.emit("open-text-file", file_path).map_err(|e| e.to_string())?;
        }
      }

      // 创建菜单项
      let show_item = MenuItem::with_id(app, "show", "show", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "quit", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .tooltip("Peek")
        .on_tray_icon_event(|tray, event| match event {
          TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
          } => {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              window.show().ok();
              window.set_focus().ok();
              window.set_always_on_top(true).ok();
              window.set_always_on_top(false).ok();
            }
          }
          TrayIconEvent::Click {
            button: MouseButton::Right,
            ..
          } => {}
          _ => {}
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              window.show().ok();
              window.set_focus().ok();
              window.set_always_on_top(true).ok();
              window.set_always_on_top(false).ok();
            }
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        window.hide().ok();
      }
    })
    .invoke_handler(tauri::generate_handler![
      text_view::open_file,
      text_view::get_file_content,
      text_view::search_file,
      text_view::replace_text,
      text_view::close_file,
      text_view::cleanup_sessions,
      text_view::get_pending_file_path,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
