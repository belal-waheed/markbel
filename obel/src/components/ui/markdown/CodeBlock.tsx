'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  className?: string
  children: React.ReactNode
}

export function CodeBlock({ className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  
  // Extract language from className (e.g. "language-javascript" -> "javascript")
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : 'code'
  
  // Extract clean code string
  const codeString = String(children).replace(/\n$/, '')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code: ', err)
    }
  }

  return (
    <div className="my-6 rounded-xl border border-border/30 bg-muted/40 overflow-hidden shadow-sm">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-muted/80 text-xs font-semibold text-muted-foreground select-none">
        <span className="uppercase tracking-wider font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer text-muted-foreground/80 hover:bg-muted-foreground/5 py-0.5 px-2 rounded-md"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      
      {/* Code Container */}
      <div className="p-4 overflow-x-auto">
        <pre className="m-0 p-0 bg-transparent border-none">
          <code className={className}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  )
}
