// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use vader_sentiment::SentimentIntensityAnalyzer as SIA;
// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn analyze(input: &str) -> HashMap<String, f64> {
    let sia: SIA = SIA::new();
    sia.polarity_scores(input)
        .iter()
        .map(|(k, v)| (k.to_string(), *v))
        .collect()
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![analyze])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
