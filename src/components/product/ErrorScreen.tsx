import React from 'react'

type ErrorScreenProps = {
  title: string
  message: string
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ title, message }) => {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-900 text-white'>
      <div className='text-center'>
        <p className='mb-4 text-xl'>{title}</p>
        <p className='text-sm text-gray-400'>{message}</p>
      </div>
    </div>
  )
}

export default ErrorScreen
