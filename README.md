# Tutorial Maker

터치스크린 교육용 인터렉티브 튜토리얼 제작 도구

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Rust](https://img.shields.io/badge/Rust-Backend-orange?logo=rust)

## 프로젝트 소개

Tutorial Maker는 비디오/이미지 기반의 인터렉티브 튜토리얼을 제작하고, **단일 실행 파일(exe)로 배포**할 수 있는 데스크톱 애플리케이션입니다.

키오스크, 전시관, 교육 현장 등에서 사용자가 터치나 클릭으로 콘텐츠를 탐색할 수 있는 튜토리얼을 쉽게 만들 수 있습니다.

### 주요 기능

- **페이지 기반 튜토리얼 제작**: 비디오/이미지를 페이지 단위로 구성
- **인터렉티브 요소**: 버튼, 터치 영역을 자유롭게 배치하여 페이지 간 이동
- **플로우맵 시각화**: 페이지 흐름을 한눈에 파악
- **단일 exe 빌드**: 모든 미디어를 포함한 독립 실행 파일 생성
- **커스텀 앱 아이콘**: 프로젝트별 아이콘 설정

---

## 아키텍처

### 듀얼 모드 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Tutorial Maker                          │
├─────────────────────────────┬───────────────────────────────┤
│      Builder Mode           │        Product Mode            │
│   (VITE_APP_MODE=dev)       │    (VITE_APP_MODE=product)     │
├─────────────────────────────┼───────────────────────────────┤
│  - 프로젝트 생성/편집        │  - 튜토리얼 재생 전용          │
│  - 페이지 관리               │  - exe 내장 데이터 로드        │
│  - 미디어 업로드             │  - 전체화면 지원               │
│  - exe 빌드                  │  - 키보드/터치 네비게이션      │
│  - ZIP 내보내기/가져오기     │                               │
└─────────────────────────────┴───────────────────────────────┘
```

하나의 코드베이스에서 **제작 도구**와 **재생 뷰어**를 환경 변수로 분리하여, 빌드된 exe는 재생 기능만 포함됩니다.

### 기술 스택

| 영역 | 기술 | 선택 이유 |
|------|------|----------|
| Frontend | React 19 + TypeScript | 컴포넌트 기반 UI, 타입 안정성 |
| Styling | Tailwind CSS | 빠른 UI 개발, 일관된 디자인 시스템 |
| Desktop | Tauri 2.0 (Rust) | 경량 번들 크기, 네이티브 성능 |
| Storage | IndexedDB | 대용량 미디어 클라이언트 저장 |
| Build | Vite | 빠른 HMR, 최적화된 프로덕션 빌드 |

---

## 핵심 설계

### 1. 바이너리 임베딩 시스템

빌드된 exe 파일에 프로젝트 데이터와 미디어를 직접 임베딩하여 **단일 파일 배포**를 구현했습니다.

```
┌────────────────────────────────────────┐
│            Built exe File              │
├────────────────────────────────────────┤
│  [Original exe binary]                 │
│  [Media files (video/image blobs)]     │
│  [Project JSON]                        │
│  [Build Manifest JSON]                 │
│  [Manifest size: 8 bytes]              │
│  [Magic bytes: "TUTORIALMAKER_DATA_V2"]│
└────────────────────────────────────────┘
```

**Rust 백엔드**에서 파일 끝에 데이터를 append하고, 매직 바이트로 데이터 영역을 식별합니다.

```rust
// 매니페스트 구조
struct BuildManifest {
    project_json_offset: u64,
    project_json_size: u64,
    media: Vec<MediaManifestEntry>,  // 각 미디어의 offset/size
}
```

이 방식으로:
- 별도 설치 과정 없이 exe 하나로 배포
- 미디어 파일 유실 위험 제거
- 오프라인 환경에서 완전한 동작

### 2. 페이지 네비게이션 시스템

```typescript
// 재생 타입에 따른 동작
type PlayType = 'loop' | 'single';

// loop: 무한 반복, 버튼/터치로만 이동
// single: N회 재생 후 자동으로 다음 페이지

// 네비게이션 액션
type NavigationAction = {
  type: 'next' | 'goto';
  targetPageId?: string;  // goto 시 대상 페이지
};
```

페이지 간 이동은 선형(next)과 비선형(goto) 모두 지원하여 복잡한 분기 구조도 구현 가능합니다.

### 3. 미디어 프리로딩 전략

```typescript
// usePageNavigation.ts
const connectedPageIds = useMemo(() => {
  const ids = new Set<string>();

  // 다음 페이지
  if (nextPage) ids.add(nextPage.id);

  // 버튼/터치로 연결된 모든 페이지
  currentPage.buttons.forEach(btn => {
    if (btn.action.targetPageId) ids.add(btn.action.targetPageId);
  });
  currentPage.touchAreas.forEach(area => {
    if (area.action.targetPageId) ids.add(area.action.targetPageId);
  });

  return ids;
}, [currentPage, nextPage]);
```

현재 페이지에서 이동 가능한 모든 페이지를 미리 로드하여 끊김 없는 전환을 구현했습니다.

### 4. 반응형 좌표 시스템

버튼과 터치 영역의 위치/크기를 **백분율(%)** 로 저장하여 다양한 해상도에서 일관된 레이아웃을 유지합니다.

```typescript
interface PageButton {
  position: { x: number; y: number };  // 0-100%
  size: { width: number; height: number };  // 0-100%
}
```

---

## 프로젝트 구조

```
tutorial-maker/
├── src/
│   ├── pages/
│   │   ├── BuilderPage.tsx      # 제작 도구 메인
│   │   └── ProductPage.tsx      # 재생 뷰어 메인
│   │
│   ├── components/
│   │   ├── builder/             # 제작 도구 컴포넌트
│   │   │   ├── PageList.tsx     # 페이지 목록 (드래그 정렬)
│   │   │   ├── PageEditor.tsx   # 페이지 편집기
│   │   │   ├── FlowMap.tsx      # 플로우맵 시각화
│   │   │   ├── ButtonEditor.tsx # 버튼 편집기
│   │   │   └── TouchAreaEditor.tsx
│   │   │
│   │   └── product/             # 재생 뷰어 컴포넌트
│   │       ├── VideoPlayer.tsx  # 미디어 재생기
│   │       ├── PageButton.tsx   # 인터렉티브 버튼
│   │       └── TouchAreaComponent.tsx
│   │
│   ├── hooks/
│   │   ├── usePageNavigation.ts # 페이지 이동 로직
│   │   └── useProductProject.ts # 프로젝트 데이터 로드
│   │
│   ├── utils/
│   │   ├── mediaStorage.ts      # IndexedDB 래퍼
│   │   ├── projectBuilder.ts    # exe 빌드 로직
│   │   └── projectExporter.ts   # ZIP 내보내기
│   │
│   └── types/
│       └── project.ts           # 타입 정의
│
└── src-tauri/
    └── src/
        └── lib.rs               # Rust 백엔드 (빌드, 미디어 읽기)
```

---

## 데이터 모델

```typescript
interface Project {
  id: string;
  name: string;
  pages: Page[];
  settings: ProjectSettings;
}

interface Page {
  id: string;
  order: number;
  mediaType: 'video' | 'image';
  mediaId: string;              // IndexedDB blob ID
  playType: 'loop' | 'single';
  playCount?: number;           // single 모드 재생 횟수
  buttons: PageButton[];
  touchAreas: TouchArea[];
}

interface ProjectSettings {
  windowWidth: number;
  windowHeight: number;
  fullscreen: boolean;
  exitKey?: string;
  showProgress: boolean;
  loopAtEnd: boolean;
}
```

---

## 실행 방법

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (Builder Mode)
npm run dev

# 프로덕션 빌드
npm run build
npm run tauri:build
```

### 요구사항

- Node.js 18+
- Rust 1.77+
- Tauri CLI 2.0+

---

## 주요 구현 포인트

### 브라우저 자동재생 정책 대응

```typescript
// VideoPlayer.tsx
const playVideo = async () => {
  try {
    await videoRef.current.play();
  } catch (error) {
    // 자동재생 차단 시 사용자 인터랙션 후 재시도
    setNeedsInteraction(true);
  }
};
```

### 페이지 유효성 검사

빌드 전 모든 페이지가 올바르게 구성되었는지 검증합니다.

```typescript
// pageValidation.ts
- 모든 페이지에 미디어 필수
- loop 모드 페이지는 버튼/터치 영역 필수 (탈출 경로)
- goto 액션의 대상 페이지 존재 여부
```

### V1/V2 호환성

기존 프로젝트 형식(V1)과 새로운 바이너리 형식(V2) 모두 지원합니다.

```typescript
// useProductProject.ts
const loadProject = async () => {
  // V2 매니페스트 시도
  const manifest = await invoke('get_media_manifest');
  if (manifest) return loadV2Project();

  // V1 폴백
  return loadV1Project();
};
```

---

## 라이선스

MIT License
