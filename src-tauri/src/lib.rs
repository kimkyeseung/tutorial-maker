use std::path::{Path, PathBuf};
use std::fs;
use std::env;
use std::io::{BufWriter, Read, Write, Seek, SeekFrom};
use tauri::{Emitter, Manager};
use ico::{IconDir, IconDirEntry, IconImage, ResourceType};

#[allow(unused_imports)]
use image::GenericImageView;

// 매직 바이트: exe 끝에 데이터가 있는지 확인하는 마커
const MAGIC_BYTES: &[u8] = b"TUTORIALMAKER_DATA_V1";
// 새 버전 매직 바이트 (바이너리 미디어 포함)
const MAGIC_BYTES_V2: &[u8] = b"TUTORIALMAKER_DATA_V2";

use serde::{Deserialize, Serialize};

// 미디어 매니페스트 엔트리
#[derive(Debug, Clone, Serialize, Deserialize)]
struct MediaManifestEntry {
    id: String,
    name: String,
    mime_type: String,
    offset: u64,
    size: u64,
}

// 빌드 매니페스트
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BuildManifest {
    project_json_offset: u64,
    project_json_size: u64,
    media: Vec<MediaManifestEntry>,
    app_icon_offset: Option<u64>,
    app_icon_size: Option<u64>,
}

// 미디어 빌드 정보 (프론트엔드에서 전달받음)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct MediaBuildInfo {
    id: String,
    name: String,
    #[serde(rename = "mimeType")]
    mime_type: String,
    #[serde(rename = "filePath")]
    file_path: String,
}

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

// 번들된 product-template.exe 찾기
fn find_bundled_template(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 유효한 exe인지 확인하는 함수 (최소 1MB 이상)
    let is_valid_exe = |path: &PathBuf| -> bool {
        if let Ok(metadata) = fs::metadata(path) {
            metadata.len() > 1_000_000  // 1MB 이상이면 유효한 exe로 간주
        } else {
            false
        }
    };

    // 1. Tauri 리소스 경로에서 찾기 (번들된 앱)
    if let Ok(resource_path) = app.path().resource_dir() {
        let template_path = resource_path.join("product-template.exe");
        if template_path.exists() && is_valid_exe(&template_path) {
            return Some(template_path);
        }
    }

    // 2. 실행 파일 옆에서 찾기
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let template_path = exe_dir.join("product-template.exe");
            if template_path.exists() && is_valid_exe(&template_path) {
                return Some(template_path);
            }

            // resources 하위 폴더에서 찾기
            let template_path = exe_dir.join("resources").join("product-template.exe");
            if template_path.exists() && is_valid_exe(&template_path) {
                return Some(template_path);
            }
        }
    }

    // 3. 개발 모드: 프로젝트 src-tauri/resources에서 찾기
    if let Ok(current_dir) = env::current_dir() {
        // 프로젝트 루트에서 실행된 경우
        let template_path = current_dir.join("src-tauri").join("resources").join("product-template.exe");
        if template_path.exists() && is_valid_exe(&template_path) {
            return Some(template_path);
        }

        // src-tauri에서 실행된 경우
        let template_path = current_dir.join("resources").join("product-template.exe");
        if template_path.exists() && is_valid_exe(&template_path) {
            return Some(template_path);
        }
    }

    // 4. 실행 파일 기준 상위 폴더 탐색 (target/debug 또는 target/release에서 실행된 경우)
    if let Ok(exe_path) = std::env::current_exe() {
        let mut current = exe_path.as_path();
        for _ in 0..5 {
            if let Some(parent) = current.parent() {
                let template_path = parent.join("src-tauri").join("resources").join("product-template.exe");
                if template_path.exists() && is_valid_exe(&template_path) {
                    return Some(template_path);
                }
                current = parent;
            } else {
                break;
            }
        }
    }

    None
}

// 개발 환경에서 빌드
fn build_from_source(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let current_dir = env::current_dir().map_err(|e| e.to_string())?;

    // 프로젝트 루트 찾기 - 여러 경로 시도
    let mut candidates: Vec<PathBuf> = vec![
        current_dir.clone(),
        current_dir.join("..").canonicalize().unwrap_or_default(),
    ];

    // 실행 파일 위치 기준
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.to_path_buf());
            if let Some(parent) = exe_dir.parent() {
                candidates.push(parent.to_path_buf());
                // target/debug 에서 실행될 경우: target/debug -> target -> src-tauri -> project_root
                if let Some(grandparent) = parent.parent() {
                    candidates.push(grandparent.to_path_buf());
                    if let Some(greatgrandparent) = grandparent.parent() {
                        candidates.push(greatgrandparent.to_path_buf());
                    }
                }
            }
        }
    }

    // src-tauri와 package.json이 있는 프로젝트 루트 찾기
    let project_root = candidates.iter()
        .find(|p| p.join("src-tauri").exists() && p.join("package.json").exists())
        .cloned()
        .ok_or_else(|| {
            let tried = candidates.iter()
                .map(|p| format!("  - {}", p.display()))
                .collect::<Vec<_>>()
                .join("\n");
            format!("개발 환경을 찾을 수 없습니다.\n\n시도한 경로:\n{}", tried)
        })?;

    let _ = app.emit("build-progress", "프로젝트 빌드 중... (몇 분 소요될 수 있습니다)");

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

    let target_dir = project_root.join("src-tauri").join("target").join("release");
    let built_exe = target_dir.join("app.exe");

    if !built_exe.exists() {
        return Err(format!("빌드된 실행 파일을 찾을 수 없습니다: {}", built_exe.display()));
    }

    Ok(built_exe)
}

// V2: 바이너리 미디어를 exe에 직접 append하는 새 빌드 함수
#[tauri::command]
async fn build_standalone_executable_v2(
    app: tauri::AppHandle,
    project_json: String,
    media_info_json: String,
    output_file: String,
    app_icon_path: Option<String>,
    temp_dir: String,
) -> Result<String, String> {
    let output_path = PathBuf::from(&output_file);
    let output_dir = output_path.parent()
        .ok_or_else(|| "출력 디렉토리를 찾을 수 없습니다.".to_string())?;
    let temp_build_dir = PathBuf::from(&temp_dir);

    // 출력 디렉토리 생성
    fs::create_dir_all(output_dir).map_err(|e| e.to_string())?;

    let _ = app.emit("build-progress", "프로젝트 빌드 준비 중...");

    // 미디어 정보 파싱
    let media_files: Vec<MediaBuildInfo> = serde_json::from_str(&media_info_json)
        .map_err(|e| format!("미디어 정보 파싱 실패: {}", e))?;

    // 앱 아이콘 ICO 파일 생성 (임시 폴더에)
    let mut custom_icon_path: Option<PathBuf> = None;

    if let Some(icon_path) = &app_icon_path {
        let source_icon = PathBuf::from(icon_path);
        if source_icon.exists() {
            let _ = app.emit("build-progress", "앱 아이콘 변환 중...");

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

    // 1. 먼저 번들된 템플릿 exe 찾기
    // 2. 없으면 개발 환경에서 빌드
    let source_exe = if let Some(template_path) = find_bundled_template(&app) {
        let msg = format!("템플릿 실행 파일 발견: {}", template_path.display());
        let _ = app.emit("build-progress", &msg);
        template_path
    } else {
        let _ = app.emit("build-progress", "템플릿을 찾을 수 없어 개발 환경에서 빌드합니다...");
        build_from_source(&app)?
    };

    // 템플릿 exe 복사
    fs::copy(&source_exe, &output_path).map_err(|e| e.to_string())?;

    // 커스텀 아이콘 적용
    if let Some(ico_path) = &custom_icon_path {
        let _ = app.emit("build-progress", "앱 아이콘 적용 중...");
        match change_exe_icon(&output_path, ico_path) {
            Ok(_) => {
                let _ = app.emit("build-progress", "앱 아이콘 적용 완료!");
            }
            Err(e) => {
                let _ = app.emit("build-progress", &format!("아이콘 적용 실패 (기본 아이콘 사용): {}", e));
            }
        }
    }

    // V2 데이터 append: 미디어 바이너리 + project.json + manifest
    let _ = app.emit("build-progress", "프로젝트 데이터 내장 중...");

    append_binary_data_v2(&output_path, &project_json, &media_files)?;

    // 임시 빌드 디렉토리 삭제
    let _ = fs::remove_dir_all(&temp_build_dir);

    let _ = app.emit("build-progress", "빌드 완료!");

    Ok(output_file)
}

// V2: 바이너리 데이터를 exe에 append
fn append_binary_data_v2(
    exe_path: &Path,
    project_json: &str,
    media_files: &[MediaBuildInfo],
) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(exe_path)
        .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

    // 현재 파일 끝 위치 (데이터 시작점)
    let data_start = file.seek(SeekFrom::End(0))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut manifest = BuildManifest {
        project_json_offset: 0,
        project_json_size: 0,
        media: Vec::new(),
        app_icon_offset: None,
        app_icon_size: None,
    };

    let mut current_offset = data_start;

    // 1. 미디어 파일들을 바이너리로 append
    for media_info in media_files {
        let media_path = PathBuf::from(&media_info.file_path);
        if media_path.exists() {
            let media_data = fs::read(&media_path)
                .map_err(|e| format!("미디어 파일 읽기 실패 ({}): {}", media_info.id, e))?;

            let media_size = media_data.len() as u64;

            file.write_all(&media_data)
                .map_err(|e| format!("미디어 데이터 쓰기 실패: {}", e))?;

            manifest.media.push(MediaManifestEntry {
                id: media_info.id.clone(),
                name: media_info.name.clone(),
                mime_type: media_info.mime_type.clone(),
                offset: current_offset,
                size: media_size,
            });

            current_offset += media_size;
        }
    }

    // 2. project.json append
    let project_bytes = project_json.as_bytes();
    manifest.project_json_offset = current_offset;
    manifest.project_json_size = project_bytes.len() as u64;

    file.write_all(project_bytes)
        .map_err(|e| format!("프로젝트 데이터 쓰기 실패: {}", e))?;

    // 3. manifest JSON append
    let manifest_json = serde_json::to_string(&manifest)
        .map_err(|e| format!("매니페스트 직렬화 실패: {}", e))?;
    let manifest_bytes = manifest_json.as_bytes();
    let manifest_size = manifest_bytes.len() as u64;

    file.write_all(manifest_bytes)
        .map_err(|e| format!("매니페스트 쓰기 실패: {}", e))?;

    // 4. manifest 크기 (8바이트, little endian)
    file.write_all(&manifest_size.to_le_bytes())
        .map_err(|e| format!("매니페스트 크기 쓰기 실패: {}", e))?;

    // 5. 매직 바이트 V2
    file.write_all(MAGIC_BYTES_V2)
        .map_err(|e| format!("매직 바이트 쓰기 실패: {}", e))?;

    Ok(())
}

// V2: exe 파일에서 매니페스트 읽기
fn read_manifest_from_exe(exe_path: &Path) -> Result<BuildManifest, String> {
    let mut file = fs::File::open(exe_path)
        .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

    // 매직 바이트 V2 확인
    let magic_len = MAGIC_BYTES_V2.len() as i64;
    file.seek(SeekFrom::End(-magic_len))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut magic_buf = vec![0u8; MAGIC_BYTES_V2.len()];
    file.read_exact(&mut magic_buf)
        .map_err(|e| format!("매직 바이트 읽기 실패: {}", e))?;

    if magic_buf != MAGIC_BYTES_V2 {
        return Err("V2 데이터 포맷이 아닙니다.".to_string());
    }

    // 매니페스트 크기 읽기
    file.seek(SeekFrom::End(-magic_len - 8))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut len_buf = [0u8; 8];
    file.read_exact(&mut len_buf)
        .map_err(|e| format!("매니페스트 크기 읽기 실패: {}", e))?;

    let manifest_size = u64::from_le_bytes(len_buf);

    // 매니페스트 읽기
    file.seek(SeekFrom::End(-magic_len - 8 - manifest_size as i64))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut manifest_buf = vec![0u8; manifest_size as usize];
    file.read_exact(&mut manifest_buf)
        .map_err(|e| format!("매니페스트 읽기 실패: {}", e))?;

    let manifest: BuildManifest = serde_json::from_slice(&manifest_buf)
        .map_err(|e| format!("매니페스트 파싱 실패: {}", e))?;

    Ok(manifest)
}

// V2: exe 파일에서 프로젝트 JSON 읽기
#[tauri::command]
fn read_project_file_v2() -> Result<String, String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    // V2 매니페스트 읽기 시도
    match read_manifest_from_exe(&current_exe) {
        Ok(manifest) => {
            let mut file = fs::File::open(&current_exe)
                .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

            file.seek(SeekFrom::Start(manifest.project_json_offset))
                .map_err(|e| format!("파일 탐색 실패: {}", e))?;

            let mut project_buf = vec![0u8; manifest.project_json_size as usize];
            file.read_exact(&mut project_buf)
                .map_err(|e| format!("프로젝트 데이터 읽기 실패: {}", e))?;

            String::from_utf8(project_buf)
                .map_err(|e| format!("프로젝트 데이터 디코딩 실패: {}", e))
        }
        Err(_) => {
            // V2 실패시 V1 또는 파일 시도
            read_project_file()
        }
    }
}

// V2: exe 파일에서 미디어 데이터 읽기
#[tauri::command]
fn read_embedded_media(media_id: String) -> Result<Vec<u8>, String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    let manifest = read_manifest_from_exe(&current_exe)?;

    // 해당 미디어 찾기
    let media_entry = manifest.media.iter()
        .find(|m| m.id == media_id)
        .ok_or_else(|| format!("미디어를 찾을 수 없습니다: {}", media_id))?;

    let mut file = fs::File::open(&current_exe)
        .map_err(|e| format!("exe 파일 열기 실패: {}", e))?;

    file.seek(SeekFrom::Start(media_entry.offset))
        .map_err(|e| format!("파일 탐색 실패: {}", e))?;

    let mut media_buf = vec![0u8; media_entry.size as usize];
    file.read_exact(&mut media_buf)
        .map_err(|e| format!("미디어 데이터 읽기 실패: {}", e))?;

    Ok(media_buf)
}

// V2: 미디어 매니페스트 가져오기
#[tauri::command]
fn get_media_manifest() -> Result<String, String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;

    let manifest = read_manifest_from_exe(&current_exe)?;

    serde_json::to_string(&manifest.media)
        .map_err(|e| format!("매니페스트 직렬화 실패: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_cli::init())
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
    .invoke_handler(tauri::generate_handler![build_project, get_temp_path, build_standalone_executable, build_standalone_executable_v2, read_project_file, read_project_file_v2, get_media_path, read_media_file, read_embedded_media, get_media_manifest]);

  #[cfg(debug_assertions)]
  {
    builder = builder.plugin(tauri_plugin_mcp_bridge::init());
  }

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
