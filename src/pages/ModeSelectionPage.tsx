import React from 'react'
import Footer from '../components/common/Footer'

interface ModeSelectionPageProps {
  onSelectMode: (mode: 'maker' | 'viewer') => void
}

const ModeSelectionPage: React.FC<ModeSelectionPageProps> = ({ onSelectMode }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-gray-800">Tutorial Maker</h1>
        <p className="mb-12 text-gray-600">모드를 선택하세요</p>

        <div className="flex gap-8">
          {/* 메이크 모드 카드 */}
          <button
            onClick={() => onSelectMode('maker')}
            className="flex h-80 w-64 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-transparent bg-white shadow-lg transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl"
          >
            <div className="text-6xl">🎬</div>
            <h2 className="text-xl font-semibold text-gray-800">튜토리얼 만들기</h2>
            <p className="px-4 text-sm text-gray-500">
              새로운 튜토리얼을 제작하거나
              <br />
              기존 프로젝트를 편집합니다
            </p>
          </button>

          {/* 뷰어 모드 카드 */}
          <button
            onClick={() => onSelectMode('viewer')}
            className="flex h-80 w-64 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-transparent bg-white shadow-lg transition-all hover:-translate-y-1 hover:border-purple-500 hover:shadow-xl"
          >
            <div className="text-6xl">▶️</div>
            <h2 className="text-xl font-semibold text-gray-800">튜토리얼 열기</h2>
            <p className="px-4 text-sm text-gray-500">
              .tutorial 파일을 열어
              <br />
              재생합니다
            </p>
          </button>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Tutorial Maker v0.1.0
        </p>

        <Footer className="mt-4" />
      </div>
    </div>
  )
}

export default ModeSelectionPage
