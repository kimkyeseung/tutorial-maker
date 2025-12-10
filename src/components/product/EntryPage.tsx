import React from 'react'

type EntryPageProps = {
  projectName: string
  onStart: () => void
}

const EntryPage: React.FC<EntryPageProps> = ({ projectName, onStart }) => {
  return (
    <div
      className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
      onClick={onStart}
    >
      <h1 className='mb-8 text-4xl font-bold text-white'>{projectName}</h1>
      <button
        onClick={onStart}
        className='rounded-xl bg-blue-600 px-12 py-4 text-xl font-semibold text-white shadow-lg transition-all hover:bg-blue-500 hover:shadow-xl active:scale-95'
      >
        시작하기
      </button>
      <p className='mt-6 text-sm text-gray-400'>
        화면을 터치하거나 버튼을 클릭하세요
      </p>
    </div>
  )
}

export default EntryPage
