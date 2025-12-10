import { useState } from 'react'
import BuilderPage from './pages/BuilderPage'
import ProductPage from './pages/ProductPage'

function App() {
  // 환경 변수로 모드 구분
  const isProductMode = import.meta.env.VITE_APP_MODE === 'product'

  // 개발 모드에서 테스트를 위한 상태
  const [showProduct, setShowProduct] = useState(false)
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null)

  if (isProductMode) {
    // 빌드된 실행 전용 앱: 프로덕트 페이지만 표시
    return <ProductPage />
  }

  // 개발 모드
  if (showProduct && previewProjectId) {
    return (
      <div className='relative'>
        <button
          onClick={() => {
            setShowProduct(false)
            setPreviewProjectId(null)
          }}
          className='absolute left-4 top-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-white shadow-lg hover:bg-red-700'
        >
          ← 빌더로 돌아가기
        </button>
        <ProductPage projectId={previewProjectId} />
      </div>
    )
  }

  // 빌더 앱: 제작 UI
  return (
    <BuilderPage
      onPreview={(projectId) => {
        setPreviewProjectId(projectId)
        setShowProduct(true)
      }}
    />
  )
}

export default App
