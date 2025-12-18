import React from 'react'

interface FooterProps {
  className?: string
}

const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer className={`py-4 text-center text-xs text-gray-400 ${className}`}>
      <p>© 2025 Viswave. All rights reserved.</p>
    </footer>
  )
}

export default Footer
