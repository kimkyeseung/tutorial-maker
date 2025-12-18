import React, { useCallback } from 'react'
import { ProductPageContent } from './ProductPage'
import LoadingScreen from '../components/product/LoadingScreen'
import ErrorScreen from '../components/product/ErrorScreen'
import { useTutorialViewer } from '../hooks/useTutorialViewer'
import { getRecentFiles, addRecentFile, removeRecentFile, type RecentFile } from '../utils/recentFiles'

interface ViewerPageProps {
  filePath: string | null
  onFileSelect: (path: string) => void
}

const ViewerPage: React.FC<ViewerPageProps> = ({ filePath, onFileSelect }) => {
  const { project, mediaUrls, buttonImageUrls, isLoading, error } =
    useTutorialViewer(filePath)

  const [recentFiles, setRecentFiles] = React.useState<RecentFile[]>([])

  // 최근 파일 목록 로드
  React.useEffect(() => {
    setRecentFiles(getRecentFiles())
  }, [])

  // 파일 로드 성공 - 최근 파일에 추가
  React.useEffect(() => {
    if (filePath && project) {
      addRecentFile(filePath)
    }
  }, [filePath, project])

  // 파일 선택 다이얼로그
  const handleOpenFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        filters: [
          { name: 'Tutorial', extensions: ['tutorial', 'zip'] }
        ],
        multiple: false,
      })

      if (selected && typeof selected === 'string') {
        // 최근 파일에 추가
        addRecentFile(selected)
        setRecentFiles(getRecentFiles())
        onFileSelect(selected)
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err)
    }
  }, [onFileSelect])

  // 최근 파일 클릭
  const handleRecentFileClick = useCallback((file: RecentFile) => {
    onFileSelect(file.path)
  }, [onFileSelect])

  // 최근 파일 삭제
  const handleRemoveRecentFile = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeRecentFile(path)
    setRecentFiles(getRecentFiles())
  }, [])

  // 파일이 선택되지 않은 상태 - 파일 선택 UI
  if (!filePath) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="mb-8 text-3xl font-bold">튜토리얼 뷰어</h1>

        <button
          onClick={handleOpenFile}
          className="mb-8 rounded-lg bg-purple-600 px-8 py-4 text-lg font-semibold transition-colors hover:bg-purple-700"
        >
          .tutorial 파일 열기
        </button>

        {/* 최근 파일 목록 */}
        {recentFiles.length > 0 && (
          <div className="w-full max-w-md">
            <h2 className="mb-4 text-center text-sm font-medium text-gray-400">
              최근 열어본 파일
            </h2>
            <div className="space-y-2">
              {recentFiles.map((file) => (
                <div
                  key={file.path}
                  onClick={() => handleRecentFileClick(file)}
                  className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-800 px-4 py-3 transition-colors hover:bg-gray-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="truncate text-xs text-gray-500">{file.path}</p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecentFile(file.path, e)}
                    className="ml-3 flex-shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-600 hover:text-white"
                    title="목록에서 제거"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mt-12 text-xs text-gray-500">
          .tutorial 또는 .zip 파일을 열 수 있습니다
        </p>
      </div>
    )
  }

  // 로딩 중
  if (isLoading) {
    return <LoadingScreen />
  }

  // 에러 발생
  if (error) {
    return (
      <ErrorScreen
        title="파일을 열 수 없습니다"
        message={error}
      />
    )
  }

  // 프로젝트 없음
  if (!project) {
    return (
      <ErrorScreen
        title="프로젝트를 로드할 수 없습니다"
        message="파일이 손상되었거나 올바른 형식이 아닙니다"
      />
    )
  }

  // 튜토리얼 재생
  return (
    <ProductPageContent
      project={project}
      mediaUrls={mediaUrls}
      buttonImageUrls={buttonImageUrls}
    />
  )
}

export default ViewerPage
