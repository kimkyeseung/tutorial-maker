import { useState, useEffect } from 'react'
import BuilderPage from './pages/BuilderPage'
import ProductPage from './pages/ProductPage'
import LoadingScreen from './components/product/LoadingScreen'

type AppMode = 'maker' | 'viewer' | 'loading'

function App() {
  const [appMode, setAppMode] = useState<AppMode>('loading')

  // 미리보기 상태 (메이커 모드에서 사용)
  const [showPreview, setShowPreview] = useState(false)
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  // 앱 시작 시 내장 프로젝트 데이터 확인
  useEffect(() => {
    const checkEmbeddedProject = async () => {
      try {
        // Tauri 환경인지 확인
        if (!('__TAURI_INTERNALS__' in window)) {
          // 웹 환경에서는 메이커 모드
          setAppMode('maker')
          return
        }

        // 내장 프로젝트 데이터 확인
        const { invoke } = await import('@tauri-apps/api/core')
        const hasEmbedded = await invoke<boolean>('has_embedded_project')

        if (hasEmbedded) {
          // 내장 데이터가 있으면 뷰어 모드 (빌드된 exe)
          setAppMode('viewer')
        } else {
          // 내장 데이터가 없으면 메이커 모드 (Tutorial Maker 앱)
          setAppMode('maker')
        }
      } catch (e) {
        console.log('Failed to check embedded project:', e)
        // 에러 시 메이커 모드로 기본 설정
        setAppMode('maker')
      }
    }

    checkEmbeddedProject()
  }, [])

  // 미리보기 핸들러 (메이커 모드)
  const handlePreview = (projectId: string) => {
    setPreviewProjectId(projectId)
    setShowPreview(true)
  }

  // 미리보기에서 돌아가기
  const handleBackFromPreview = () => {
    setShowPreview(false)
    setPreviewProjectId(null)
  }

  // 로딩 중
  if (appMode === 'loading') {
    return <LoadingScreen />
  }

  // 뷰어 모드 (빌드된 exe)
  if (appMode === 'viewer') {
    return <ProductPage />
  }

  // 메이커 모드
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

  // 빌더 페이지 (메이커 모드)
  return <BuilderPage onPreview={handlePreview} />
}

export default App
