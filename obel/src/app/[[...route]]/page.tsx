'use client'

import dynamic from 'next/dynamic'

// Dynamically load the client-only SPA application to bypass Next.js SSR globals mismatch
const App = dynamic(() => import('@/App'), { ssr: false })

export default function Page() {
  return <App />
}
