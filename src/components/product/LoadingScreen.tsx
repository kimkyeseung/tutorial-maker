import React from 'react'

const LoadingScreen: React.FC = () => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-900 text-white'>
      <div className='text-center'>
        <div className='mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-white'></div>
        <p>프로젝트 로딩 중...</p>
      </div>
    </div>
  )
}

export default LoadingScreen
