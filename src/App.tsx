import { useState, useEffect } from 'react'
import ModeSelectionPage from './pages/ModeSelectionPage'
import BuilderPage from './pages/BuilderPage'
import ViewerPage from './pages/ViewerPage'
import ProductPage from './pages/ProductPage'
import { addRecentFile } from './utils/recentFiles'

type AppMode = 'maker' | 'viewer' | null

function App() {
  const [appMode, setAppMode] = useState<AppMode>(null)
  const [tutorialFilePath, setTutorialFilePath] = useState<string | null>(null)

  // 미리보기 상태 (메이크 모드에서 사용)
  const [showPreview, setShowPreview] = useState(false)
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  // 앱 시작 시 CLI 인자 확인 (파일 연결로 실행된 경우)
  useEffect(() => {
    const checkCliArgs = async () => {
      try {
        // Tauri 환경인지 확인
        if (!('__TAURI_INTERNALS__' in window)) return

        // CLI 플러그인이 있는 경우
        try {
          const { getMatches } = await import('@tauri-apps/plugin-cli')
          const matches = await getMatches()

          // 파일 경로가 인자로 전달된 경우
          if (matches.args.file?.value) {
            const filePath = matches.args.file.value as string
            if (filePath.endsWith('.tutorial') || filePath.endsWith('.zip')) {
              addRecentFile(filePath)
              setTutorialFilePath(filePath)
              setAppMode('viewer')
            }
          }
        } catch (cliError) {
          // CLI 플러그인이 없거나 인자가 없는 경우 - 정상 동작
          console.log('No CLI args or CLI plugin not available')
        }
      } catch (e) {
        console.log('Not in Tauri environment or CLI check failed:', e)
      }
    }

    checkCliArgs()
  }, [])

  // 모드 선택 핸들러
  const handleSelectMode = (mode: 'maker' | 'viewer') => {
    setAppMode(mode)
  }

  // 파일 선택 핸들러 (뷰어 모드)
  const handleFileSelect = (path: string) => {
    setTutorialFilePath(path)
  }

  // 미리보기 핸들러 (메이크 모드)
  const handlePreview = (projectId: string) => {
    setPreviewProjectId(projectId)
    setShowPreview(true)
  }

  // 미리보기에서 돌아가기
  const handleBackFromPreview = () => {
    setShowPreview(false)
    setPreviewProjectId(null)
  }

  // 메이크 모드에서 모드 선택으로 돌아가기
  const handleBackToModeSelection = () => {
    setAppMode(null)
    setShowPreview(false)
    setPreviewProjectId(null)
    setTutorialFilePath(null)
  }

  // 모드 미선택 시 선택 화면
  if (appMode === null) {
    return <ModeSelectionPage onSelectMode={handleSelectMode} />
  }

  // 메이크 모드
  if (appMode === 'maker') {
    // 미리보기 중
    if (showPreview && previewProjectId) {
      return (
        <div className="relative">
          <button
            onClick={handleBackFromPreview}
            className="absolute left-4 top-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-white shadow-lg hover:bg-red-700"
          >
            ← 빌더로 돌아가기
          </button>
          <ProductPage projectId={previewProjectId} />
        </div>
      )
    }

    // 빌더 페이지
    return (
      <BuilderPage
        onPreview={handlePreview}
        onBackToModeSelection={handleBackToModeSelection}
      />
    )
  }

  // 뷰어 모드
  return (
    <ViewerPage
      filePath={tutorialFilePath}
      onFileSelect={handleFileSelect}
    />
  )
}

export default App
