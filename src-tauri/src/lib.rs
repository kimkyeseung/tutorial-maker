use std::path::{Path, PathBuf};
use std::fs;
use std::env;
use std::io::{BufWriter, Read, Write, Seek, SeekFrom};
use tauri::Emitter;
use ico::{IconDir, IconDirEntry, IconImage, ResourceType};

#[allow(unused_imports)]
use image::GenericImageView;

// 매직 바이트: exe 끝에 데이터가 있는지 확인하는 마커
const MAGIC_BYTES: &[u8] = b"TUTORIALMAKER_DATA_V1";

// exe 파일 끝에 프로젝트 데이터 추가
fn append_data_to_exe(exe_path: &Path, data: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(exe_path)
        .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

    // 데이터 길이 (8바이트, little endian)
    let data_len = data.len() as u64;

    // 데이터 쓰기
    file.write_all(data)
        .map_err(|e| format!("데이터 쓰기 실패: {}", e))?;

    // 데이터 길이 쓰기
    file.write_all(&data_len.to_le_bytes())
        .map_err(|e| format!("데이터 길이 쓰기 실패: {}", e))?;

    // 매직 바이트 쓰기
    file.write_all(MAGIC_BYTES)
        .map_err(|e| format!("매직 바이트 쓰기 실패: {}", e))?;

    Ok(())
}

// exe 파일 끝에서 프로젝트 데이터 읽기
fn read_data_from_exe(exe_path: &Path) -> Result<Vec<u8>, String> {
    let mut file = fs::File::open(exe_path)
        .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

    let file_size = file.metadata()
        .map_err(|e| format!("파일 메타데이터 읽기 실패: {}", e))?
        .len();

    // 매직 바이트 확인
    let magic_len = MAGIC_BYTES.len() as u64;
    file.seek(SeekFrom::End(-(magic_len as i64)))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut magic_buf = vec![0u8; MAGIC_BYTES.len()];
    file.read_exact(&mut magic_buf)
        .map_err(|e| format!("매직 바이트 읽기 실패: {}", e))?;

    if magic_buf != MAGIC_BYTES {
        return Err("내장된 프로젝트 데이터를 찾을 수 없습니다.".to_string());
    }

    // 데이터 길이 읽기 (매직 바이트 앞 8바이트)
    file.seek(SeekFrom::End(-(magic_len as i64) - 8))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut len_buf = [0u8; 8];
    file.read_exact(&mut len_buf)
        .map_err(|e| format!("데이터 길이 읽기 실패: {}", e))?;

    let data_len = u64::from_le_bytes(len_buf);

    // 데이터 읽기
    let data_start = file_size - magic_len - 8 - data_len;
    file.seek(SeekFrom::Start(data_start))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut data = vec![0u8; data_len as usize];
    file.read_exact(&mut data)
        .map_err(|e| format!("데이터 읽기 실패: {}", e))?;

    Ok(data)
}

// 이미지를 ICO 파일로 변환
fn create_ico_file(source_image_path: &Path, output_ico_path: &Path) -> Result<(), String> {
    let img = image::open(source_image_path)
        .map_err(|e| format!("이미지 로드 실패: {}", e))?;

    let ico_sizes = [16u32, 24, 32, 48, 64, 128, 256];
    let mut icon_dir = IconDir::new(ResourceType::Icon);

    for size in ico_sizes.iter() {
        let resized = img.resize_exact(*size, *size, image::imageops::FilterType::Lanczos3);
        let rgba = resized.to_rgba8();
        let (width, height) = rgba.dimensions();

        let icon_image = IconImage::from_rgba_data(width, height, rgba.into_raw());
        icon_dir.add_entry(IconDirEntry::encode(&icon_image)
            .map_err(|e| format!("ICO 엔트리 인코딩 실패: {}", e))?);
    }

    let ico_file = fs::File::create(output_ico_path)
        .map_err(|e| format!("ICO 파일 생성 실패: {}", e))?;
    icon_dir.write(BufWriter::new(ico_file))
        .map_err(|e| format!("ICO 파일 쓰기 실패: {}", e))?;

    Ok(())
}

// rcedit 다운로드
fn download_rcedit(target_path: &Path) -> Result<(), String> {
    use std::process::Command;

    let url = "https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe";

    // curl 사용하여 다운로드
    let output = Command::new("curl")
        .args(&[
            "-L",
            "-o",
            &target_path.to_string_lossy(),
            url,
        ])
        .output()
        .map_err(|e| format!("curl 실행 실패: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("rcedit 다운로드 실패: {}", error));
    }

    Ok(())
}

// rcedit를 사용하여 exe 파일의 아이콘 변경
fn change_exe_icon(exe_path: &Path, ico_path: &Path) -> Result<(), String> {
    use std::process::Command;

    // rcedit 경로 (LOCALAPPDATA/tauri에 저장)
    let local_app_data = env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA 환경변수를 찾을 수 없습니다.")?;
    let tauri_dir = PathBuf::from(&local_app_data).join("tauri");
    let rcedit_path = tauri_dir.join("rcedit-x64.exe");

    // rcedit가 없으면 다운로드
    if !rcedit_path.exists() {
        // tauri 디렉토리 생성
        fs::create_dir_all(&tauri_dir)
            .map_err(|e| format!("tauri 디렉토리 생성 실패: {}", e))?;

        download_rcedit(&rcedit_path)?;
    }

    let output = Command::new(&rcedit_path)
        .args(&[
            exe_path.to_string_lossy().to_string(),
            "--set-icon".to_string(),
            ico_path.to_string_lossy().to_string(),
        ])
        .output()
        .map_err(|e| format!("rcedit 실행 실패: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("아이콘 변경 실패: {}", error));
    }

    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn build_project(
    app: tauri::AppHandle,
    project_json: String,
    output_dir: String,
    media_paths: Vec<String>,
) -> Result<String, String> {
    let output_path = PathBuf::from(&output_dir);

    // 출력 디렉토리 생성
    fs::create_dir_all(&output_path).map_err(|e| e.to_string())?;

    // 빌드 진행 상황 전송
    let _ = app.emit("build-progress", "프로젝트 파일 준비 중...");

    // 1. 프로젝트 데이터를 JSON 파일로 저장
    let project_file = output_path.join("project.json");
    fs::write(&project_file, &project_json).map_err(|e| e.to_string())?;

    // 2. 미디어 디렉토리 생성 및 파일 복사
    let media_dir = output_path.join("media");
    fs::create_dir_all(&media_dir).map_err(|e| e.to_string())?;

    let _ = app.emit("build-progress", "미디어 파일 복사 중...");

    // 각 미디어 파일 복사
    for media_path in media_paths.iter() {
        if !media_path.is_empty() {
            let source = PathBuf::from(media_path);
            if source.exists() {
                if let Some(filename) = source.file_name() {
                    let dest = media_dir.join(filename);
                    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // 3. 현재 실행 파일 복사
    let _ = app.emit("build-progress", "실행 파일 생성 중...");

    // 현재 실행중인 exe 파일 경로 가져오기
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_name = current_exe.file_name()
        .ok_or_else(|| "실행 파일 이름을 가져올 수 없습니다.".to_string())?;

    let dest_exe = output_path.join(exe_name);
    fs::copy(&current_exe, &dest_exe).map_err(|e| e.to_string())?;

    // 4. WebView2 런타임 등 필요한 파일들 복사 (Tauri가 생성하는 추가 파일들)
    let exe_dir = current_exe.parent()
        .ok_or_else(|| "실행 파일 디렉토리를 찾을 수 없습니다.".to_string())?;

    // resources 폴더 복사 (있는 경우)
    let resources_src = exe_dir.join("resources");
    if resources_src.exists() {
        let resources_dst = output_path.join("resources");
        copy_dir_recursive(&resources_src, &resources_dst).map_err(|e| e.to_string())?;
    }

    let _ = app.emit("build-progress", "빌드 완료!");

    Ok(output_dir)
}

#[tauri::command]
fn get_temp_path(relative_path: String) -> Result<String, String> {
    let temp_dir = env::temp_dir();
    let full_path = temp_dir.join(relative_path);

    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_project_file() -> Result<String, String> {
    // 실행 파일에서 내장된 프로젝트 데이터 읽기
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    // exe 끝에서 데이터 읽기 시도
    match read_data_from_exe(&current_exe) {
        Ok(data) => {
            String::from_utf8(data)
                .map_err(|e| format!("프로젝트 데이터 디코딩 실패: {}", e))
        }
        Err(_) => {
            // 내장 데이터가 없으면 project.json 파일에서 읽기 (개발 모드 호환)
            let exe_dir = current_exe.parent()
                .ok_or_else(|| "실행 파일 디렉토리를 찾을 수 없습니다.".to_string())?;

            let project_file = exe_dir.join("project.json");

            if !project_file.exists() {
                return Err("프로젝트 데이터를 찾을 수 없습니다.".to_string());
            }

            fs::read_to_string(&project_file).map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
fn get_media_path(media_id: String) -> Result<String, String> {
    // 실행 파일과 같은 디렉토리의 media 폴더에서 파일 찾기
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe.parent()
        .ok_or_else(|| "실행 파일 디렉토리를 찾을 수 없습니다.".to_string())?;

    let media_dir = exe_dir.join("media");

    if !media_dir.exists() {
        return Err("media 폴더를 찾을 수 없습니다.".to_string());
    }

    // media_id로 시작하는 파일 찾기
    for entry in fs::read_dir(&media_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with(&media_id) {
            return Ok(entry.path().to_string_lossy().to_string());
        }
    }

    Err(format!("미디어 파일을 찾을 수 없습니다: {}", media_id))
}

#[tauri::command]
fn read_media_file(media_id: String) -> Result<Vec<u8>, String> {
    // 실행 파일과 같은 디렉토리의 media 폴더에서 파일 찾기
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe.parent()
        .ok_or_else(|| "실행 파일 디렉토리를 찾을 수 없습니다.".to_string())?;

    let media_dir = exe_dir.join("media");

    if !media_dir.exists() {
        return Err("media 폴더를 찾을 수 없습니다.".to_string());
    }

    // media_id로 시작하는 파일 찾기
    for entry in fs::read_dir(&media_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with(&media_id) {
            // 파일 읽기
            let data = fs::read(entry.path()).map_err(|e| e.to_string())?;
            return Ok(data);
        }
    }

    Err(format!("미디어 파일을 찾을 수 없습니다: {}", media_id))
}

#[tauri::command]
async fn build_standalone_executable(
    app: tauri::AppHandle,
    project_json: String,
    output_file: String,
    media_paths: Vec<String>,
    app_icon_path: Option<String>,
) -> Result<String, String> {
    let output_path = PathBuf::from(&output_file);
    let output_dir = output_path.parent()
        .ok_or_else(|| "출력 디렉토리를 찾을 수 없습니다.".to_string())?;

    // 출력 디렉토리 생성
    fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let _ = app.emit("build-progress", "프로젝트 빌드 준비 중...");

    // 임시 빌드 디렉토리 생성
    let temp_build_dir = env::temp_dir().join(format!("tutorial_build_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()));
    fs::create_dir_all(&temp_build_dir).map_err(|e| e.to_string())?;

    // 1. project.json 저장
    let project_file = temp_build_dir.join("project.json");
    fs::write(&project_file, &project_json).map_err(|e| e.to_string())?;

    // 2. 미디어 디렉토리 생성 및 파일 복사
    let media_dir = temp_build_dir.join("media");
    fs::create_dir_all(&media_dir).map_err(|e| e.to_string())?;

    let _ = app.emit("build-progress", "미디어 파일 복사 중...");

    for media_path in media_paths.iter() {
        if !media_path.is_empty() {
            let source = PathBuf::from(media_path);
            if source.exists() {
                if let Some(filename) = source.file_name() {
                    let dest = media_dir.join(filename);
                    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // 3. 현재 프로젝트의 소스 코드를 임시 빌드 디렉토리에 복사
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;

    // Cargo.toml이 있는 프로젝트 루트 찾기
    let project_root = if current_dir.join("src-tauri").exists() {
        current_dir.clone()
    } else {
        current_dir.parent()
            .ok_or_else(|| "프로젝트 루트를 찾을 수 없습니다.".to_string())?
            .to_path_buf()
    };

    // 4. 앱 아이콘 ICO 파일 생성 (임시 폴더에)
    let mut custom_icon_path: Option<PathBuf> = None;

    if let Some(icon_path) = &app_icon_path {
        let source_icon = PathBuf::from(icon_path);
        if source_icon.exists() {
            let _ = app.emit("build-progress", "앱 아이콘 변환 중...");

            // 임시 폴더에 ICO 파일 생성
            let ico_path = temp_build_dir.join("custom_icon.ico");
            match create_ico_file(&source_icon, &ico_path) {
                Ok(_) => {
                    custom_icon_path = Some(ico_path);
                }
                Err(e) => {
                    let _ = app.emit("build-progress", &format!("아이콘 변환 경고: {} (기본 아이콘 사용)", e));
                }
            }
        }
    }

    // 5. Tauri 빌드 실행
    let _ = app.emit("build-progress", "프로젝트 빌드 중... (몇 분 소요될 수 있습니다)");

    // npm run tauri:build:product 실행
    use std::process::Command;
    let build_output = Command::new("cmd")
        .args(&["/C", "npm", "run", "tauri:build:product"])
        .current_dir(&project_root)
        .output()
        .map_err(|e| format!("빌드 명령 실행 실패: {}", e))?;

    if !build_output.status.success() {
        let stderr = String::from_utf8_lossy(&build_output.stderr);
        let stdout = String::from_utf8_lossy(&build_output.stdout);
        return Err(format!("빌드 실패:\n{}\n{}", stdout, stderr));
    }

    // 빌드된 실행 파일 찾기
    let target_dir = project_root.join("src-tauri").join("target").join("release");
    let built_exe = if cfg!(target_os = "windows") {
        target_dir.join("app.exe")
    } else if cfg!(target_os = "macos") {
        target_dir.join("app")
    } else {
        target_dir.join("app")
    };

    if !built_exe.exists() {
        return Err(format!(
            "빌드된 실행 파일을 찾을 수 없습니다: {}",
            built_exe.display()
        ));
    }

    let _ = app.emit("build-progress", "빌드된 실행 파일 복사 중...");

    // 6. 빌드된 실행 파일과 리소스를 최종 출력 위치로 복사
    fs::copy(&built_exe, &output_path).map_err(|e| e.to_string())?;

    // 7. 커스텀 아이콘이 있으면 exe 파일의 아이콘 변경
    if let Some(ico_path) = &custom_icon_path {
        let _ = app.emit("build-progress", "앱 아이콘 적용 중...");
        match change_exe_icon(&output_path, ico_path) {
            Ok(_) => {
                let _ = app.emit("build-progress", "앱 아이콘 적용 완료!");
            }
            Err(e) => {
                // 아이콘 변경 실패해도 빌드는 계속 진행
                let _ = app.emit("build-progress", &format!("아이콘 적용 실패 (기본 아이콘 사용): {}", e));
            }
        }
    }

    // 8. 프로젝트 데이터를 exe 파일 끝에 추가 (단일 파일 배포)
    let _ = app.emit("build-progress", "프로젝트 데이터 내장 중...");
    let project_data = fs::read(&project_file).map_err(|e| e.to_string())?;
    append_data_to_exe(&output_path, &project_data)?;

    // 9. 임시 빌드 디렉토리 삭제
    let _ = fs::remove_dir_all(&temp_build_dir);

    let _ = app.emit("build-progress", "빌드 완료!");

    Ok(output_file)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
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
    .invoke_handler(tauri::generate_handler![build_project, get_temp_path, build_standalone_executable, read_project_file, get_media_path, read_media_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
