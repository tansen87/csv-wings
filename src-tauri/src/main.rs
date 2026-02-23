#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{
  Emitter, Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

use insight::command;
use insight::flow;
use insight::view::{text_view, text_view_utils};

use insight::cmd::apply;
use insight::cmd::cat;
use insight::cmd::convert;
use insight::cmd::count;
use insight::cmd::datefmt;
use insight::cmd::enumerate;
use insight::cmd::extsort;
use insight::cmd::fill;
use insight::cmd::idx;
use insight::cmd::insert;
use insight::cmd::join;
use insight::cmd::pinyin;
use insight::cmd::rename;
use insight::cmd::replace;
use insight::cmd::reverse;
use insight::cmd::search;
use insight::cmd::select;
use insight::cmd::separate;
use insight::cmd::skip;
use insight::cmd::slice;
use insight::cmd::sort;
use insight::cmd::split;
use insight::cmd::string;
use insight::cmd::transpose;
use insight::cmd::traverse;

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
          window.show().unwrap();
          window.set_focus().unwrap();
          let _ = window.emit("open-text-file", file_path);
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
        .tooltip("insight-x")
        .on_tray_icon_event(|tray, event| match event {
          TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
          } => {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              window.show().unwrap();
              window.set_focus().unwrap();
              window.set_always_on_top(true).unwrap();
              window.set_always_on_top(false).unwrap();
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
              window.show().unwrap();
              window.set_focus().unwrap();
              window.set_always_on_top(true).unwrap();
              window.set_always_on_top(false).unwrap();
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
        window.hide().unwrap();
      }
    })
    .invoke_handler(tauri::generate_handler![
      command::from_headers,
      command::map_headers,
      command::inter_headers,
      command::dupli_headers,
      command::to_json,
      command::xlsx_to_json,
      flow::flow,
      text_view::open_file,
      text_view::get_file_content,
      text_view::search_file,
      text_view::replace_text,
      text_view::close_file,
      text_view::cleanup_sessions,
      text_view::get_pending_file_path,
      apply::apply,
      cat::cat_csv,
      cat::cat_excel,
      convert::excel_to_csv::map_excel_sheets,
      #[cfg(target_os = "windows")]
      convert::perform::access2csv,
      convert::perform::csv2csv,
      convert::perform::encoding2utf8,
      convert::perform::detect_file_encoding,
      convert::perform::csv2xlsx,
      convert::perform::dbf2csv,
      convert::perform::excel2csv,
      convert::perform::json2csv,
      convert::perform::jsonl2csv,
      count::count,
      datefmt::datefmt,
      enumerate::enumer,
      extsort::extsort,
      fill::fill,
      idx::csv_idx,
      insert::insert,
      join::join,
      pinyin::pinyin,
      rename::rename,
      replace::replace,
      reverse::reverse,
      search::perform::search,
      search::perform::search_chain,
      select::select,
      separate::separate,
      skip::skip,
      slice::slice,
      sort::sort,
      split::split,
      string::str_pad,
      string::str_slice,
      string::str_split,
      transpose::transpose,
      traverse::traverse,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
