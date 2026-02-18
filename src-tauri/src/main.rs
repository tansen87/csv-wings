#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{
  Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

use insight::command;
use insight::flow;
use insight::view::large_text_view;

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
    .manage(large_text_view::AppState::default())
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
      // 创建菜单项
      let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
      // 创建托盘菜单
      let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      // 创建系统托盘
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tray_menu)
        .show_menu_on_left_click(false) // 左键不显示菜单，触发 Click 事件
        .tooltip("insight-x")
        .on_tray_icon_event(|tray, event| {
          match event {
            // 只处理左键点击
            TrayIconEvent::Click {
              button: MouseButton::Left,
              button_state: tauri::tray::MouseButtonState::Up,
              ..
            } => {
              let app = tray.app_handle();
              if let Some(window) = app.get_webview_window("main") {
                // 左键单击:直接显示窗口
                window.show().unwrap();
                window.set_focus().unwrap();
                window.set_always_on_top(true).unwrap();
                window.set_always_on_top(false).unwrap();
              }
            }
            // 处理右键点击
            TrayIconEvent::Click {
              button: MouseButton::Right,
              ..
            } => {
              // 右键不需要处理，show_menu_on_left_click(false) 会自动显示菜单
            }
            _ => {}
          }
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
      large_text_view::get_available_encodings,
      large_text_view::open_file,
      large_text_view::get_file_content,
      large_text_view::search_file,
      large_text_view::replace_text,
      large_text_view::close_file,
      large_text_view::get_line,
      large_text_view::get_file_stats,
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
