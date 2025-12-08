use std::path::PathBuf;
use std::fs;
use tauri::{Manager, Emitter};

#[tauri::command]
async fn build_project(
    app: tauri::AppHandle,
    project_json: String,
    output_dir: String,
) -> Result<String, String> {
    // 출력 디렉토리 생성
    let output_path = PathBuf::from(&output_dir);
    fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;

    // 프로젝트 데이터를 JSON 파일로 저장
    let project_file = output_path.join("project.json");
    fs::write(&project_file, &project_json).map_err(|e| e.to_string())?;

    // 빌드 진행 상황 전송
    let _ = app.emit("build-progress", "프로젝트 파일 준비 완료");

    // Tauri 프로젝트 템플릿 복사 (실제로는 빌드 프로세스를 여기에 구현)
    // 이 부분은 실제 빌드 로직으로 대체되어야 합니다.

    let _ = app.emit("build-progress", "빌드 완료");

    Ok(output_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![build_project])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
