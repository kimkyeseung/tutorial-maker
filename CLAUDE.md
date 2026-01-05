# Tutorial Maker

데스크톱 튜토리얼 애플리케이션을 만들기 위한 도구입니다.

## 프로젝트 개요

Tutorial Maker는 두 가지 모드로 동작합니다:

### 1. Maker 모드 (Tutorial Maker 앱)
- 튜토리얼 프로젝트를 생성, 편집, 관리
- 비디오/이미지 페이지 구성
- 버튼, 터치 영역 설정
- 단독 실행 파일(exe)로 빌드

### 2. Viewer 모드 (빌드된 exe)
- Maker에서 빌드한 exe 파일 실행 시 자동으로 뷰어 모드
- 내장된 튜토리얼 데이터를 즉시 재생
- 별도의 모드 선택 없이 바로 콘텐츠 표시

## 아키텍처

### 모드 자동 감지
```
앱 시작
  ├─ 웹 환경 → Maker 모드
  └─ Tauri 환경
       ├─ 내장 프로젝트 있음 → Viewer 모드
       └─ 내장 프로젝트 없음 → Maker 모드
```

- `has_embedded_project()` Rust 함수가 exe 파일 내 데이터 존재 여부 확인
- V2 매니페스트, V1 데이터, project.json 파일 순으로 검사

---

## ⚠️ 중요: product-template.exe 관리

### product-template.exe란?
- **Maker 앱에서 "단일 실행 파일 빌드" 시 사용되는 템플릿 exe**
- 위치: `src-tauri/resources/product-template.exe`
- 이 템플릿에 프로젝트 데이터가 내장되어 최종 Viewer exe가 생성됨

### 핵심 원리
```
[Maker 앱에서 빌드 클릭]
    ↓
[product-template.exe 복사]
    ↓
[프로젝트 데이터 + 미디어를 exe 끝에 append]
    ↓
[완성된 Viewer exe 생성]
```

### ⚠️ product-template.exe 업데이트가 필요한 경우
**App.tsx, lib.rs 등 모드 감지/데이터 로딩 로직을 수정한 후에는 반드시:**

```bash
# 1. Tauri 캐시 삭제 후 새로 빌드
cd src-tauri && cargo clean && cd ..
npm run tauri:build

# 2. 빌드된 app.exe를 product-template.exe로 복사
cp src-tauri/target/release/app.exe src-tauri/resources/product-template.exe
```

**업데이트하지 않으면:** 빌드된 exe가 여전히 이전 코드로 동작하여 Viewer 모드가 아닌 Maker 모드로 실행될 수 있음

### 체크리스트
- [ ] `has_embedded_project()` 함수 수정 시 → template 업데이트 필요
- [ ] `App.tsx` 모드 감지 로직 수정 시 → template 업데이트 필요
- [ ] `ProductPage.tsx` 수정 시 → template 업데이트 필요
- [ ] `read_project_file_v2()`, `read_embedded_media()` 수정 시 → template 업데이트 필요

---

### 주요 파일 구조
```
src/
├── App.tsx                    # 앱 진입점, 모드 자동 감지
├── pages/
│   ├── BuilderPage.tsx        # Maker 모드 메인 페이지
│   └── ProductPage.tsx        # Viewer 모드 메인 페이지
├── components/
│   ├── builder/               # 빌더 관련 컴포넌트
│   └── product/               # 뷰어 관련 컴포넌트
├── utils/
│   ├── mediaStorage.ts        # IndexedDB 미디어 저장소
│   ├── projectBuilder.ts      # exe 빌드 로직
│   └── videoCompressor.ts     # 비디오 압축 유틸리티
└── types/
    └── index.ts               # TypeScript 타입 정의

src-tauri/
├── src/
│   └── lib.rs                 # Rust 백엔드 (빌드, 데이터 처리)
├── resources/
│   └── product-template.exe   # ⚠️ Viewer 템플릿 (코드 변경 시 업데이트 필요!)
└── tauri.conf.json            # Tauri 설정
```

## 기술 스택

- **Frontend**: React 18, TypeScript, TailwindCSS
- **Desktop**: Tauri 2.x (Rust)
- **상태 관리**: React useState/useEffect
- **미디어 저장**: IndexedDB
- **비디오 압축**: Canvas + MediaRecorder API
- **테스트**: Vitest, Testing Library

## 주요 명령어

```bash
# 개발 서버
npm run dev

# Tauri 개발 모드
npm run tauri:dev

# 프로덕션 빌드
npm run tauri:build

# 테스트
npm test

# 타입 체크
npm run lint
```

## 빌드 프로세스

### Maker 앱 빌드 (개발자용)
```bash
npm run tauri:build
```

### Viewer exe 빌드 (사용자가 Maker 앱에서 수행)
1. **프로젝트 생성**: BuilderPage에서 페이지, 미디어, 설정 구성
2. **exe 빌드**: "단일 실행 파일 빌드" 버튼 클릭
   - `product-template.exe` 복사
   - 비디오 압축 (옵션)
   - 프로젝트 데이터 + 미디어를 exe에 append
   - 커스텀 아이콘 적용 (옵션)
3. **배포**: 생성된 exe 파일 배포 (단일 파일, 추가 설치 불필요)

## 데이터 형식

### V2 매니페스트 (권장)
```
[EXE 바이너리] + [미디어 바이너리들] + [프로젝트 JSON] + [매니페스트 JSON] + [매니페스트 길이 8바이트] + "TUTORIALMAKER_DATA_V2"
```

### V1 레거시
```
[EXE 바이너리] + [프로젝트 데이터] + [데이터 길이 8바이트] + "TUTORIALMAKER_DATA_V1"
```

## 테스트

- 총 101개 테스트 케이스
- App.tsx: 모드 자동 감지, 미리보기 기능
- BuilderPage: 프로젝트 관리, 빌드 옵션
- videoCompressor: 압축 로직
- projectBuilder: exe 빌드 로직
