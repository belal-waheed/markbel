'use client'

import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Info, AlertTriangle, Lightbulb, AlertCircle, HelpCircle, 
  CheckCircle2, XCircle, Sparkles, Quote, Bug
} from 'lucide-react'
import 'katex/dist/katex.min.css'

import { useNoteStore } from '@/stores/noteStore'
import { parseSections, MarkdownSection } from './utils'
import { CodeBlock } from './CodeBlock'
import { SectionComponent } from './SectionComponent'
import { CollapsibleListItem } from './CollapsibleListItem'

// ─────────────────────────────────────────────────────────────────────────────
// Callout / Admonition Rendering Configuration
// ─────────────────────────────────────────────────────────────────────────────
interface CalloutConfig {
  icon: React.ComponentType<any>
  title: string
  bgClass: string
  borderClass: string
  textClass: string
  iconClass: string
}

const calloutConfigs: Record<string, CalloutConfig> = {
  note: {
    icon: Info,
    title: 'Note',
    bgClass: 'bg-primary/5 dark:bg-primary/10',
    borderClass: 'border-primary',
    textClass: 'text-primary dark:text-primary-foreground',
    iconClass: 'text-primary'
  },
  info: {
    icon: Info,
    title: 'Info',
    bgClass: 'bg-blue-500/5 dark:bg-blue-500/10',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-600 dark:text-blue-400',
    iconClass: 'text-blue-500'
  },
  todo: {
    icon: Info,
    title: 'Todo',
    bgClass: 'bg-primary/5 dark:bg-primary/10',
    borderClass: 'border-primary',
    textClass: 'text-primary dark:text-primary-foreground',
    iconClass: 'text-primary'
  },
  warning: {
    icon: AlertTriangle,
    title: 'Warning',
    bgClass: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
    iconClass: 'text-amber-500'
  },
  danger: {
    icon: XCircle,
    title: 'Danger',
    bgClass: 'bg-red-500/5 dark:bg-red-500/10',
    borderClass: 'border-red-500',
    textClass: 'text-red-600 dark:text-red-400',
    iconClass: 'text-red-500'
  },
  bug: {
    icon: Bug,
    title: 'Bug',
    bgClass: 'bg-red-500/5 dark:bg-red-500/10',
    borderClass: 'border-red-500',
    textClass: 'text-red-600 dark:text-red-400',
    iconClass: 'text-red-500'
  },
  tip: {
    icon: Lightbulb,
    title: 'Tip',
    bgClass: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    iconClass: 'text-emerald-500'
  },
  success: {
    icon: CheckCircle2,
    title: 'Success',
    bgClass: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    iconClass: 'text-emerald-500'
  },
  important: {
    icon: Sparkles,
    title: 'Important',
    bgClass: 'bg-purple-500/5 dark:bg-purple-500/10',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-600 dark:text-purple-400',
    iconClass: 'text-purple-500'
  },
  caution: {
    icon: AlertCircle,
    title: 'Caution',
    bgClass: 'bg-orange-500/5 dark:bg-orange-500/10',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-600 dark:text-orange-400',
    iconClass: 'text-orange-500'
  },
  quote: {
    icon: Quote,
    title: 'Quote',
    bgClass: 'bg-muted/30',
    borderClass: 'border-muted-foreground/30',
    textClass: 'text-muted-foreground',
    iconClass: 'text-muted-foreground/60'
  },
  example: {
    icon: HelpCircle,
    title: 'Example',
    bgClass: 'bg-cyan-500/5 dark:bg-cyan-500/10',
    borderClass: 'border-cyan-500',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    iconClass: 'text-cyan-500'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Abstract React Node Tree Parsing Utilities (Highlights & Callouts)
// ─────────────────────────────────────────────────────────────────────────────
function getReactNodeText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getReactNodeText).join('')
  if (node.props && node.props.children) return getReactNodeText(node.props.children)
  return ''
}

function stripHighlightMarkers(node: any, state: { strippedStart: boolean; strippedEnd: boolean }): any {
  if (!node) return node

  if (typeof node === 'string') {
    let text = node
    if (!state.strippedStart && text.startsWith('==')) {
      text = text.slice(2)
      state.strippedStart = true
    }
    if (!state.strippedEnd && text.endsWith('==')) {
      text = text.slice(0, -2)
      state.strippedEnd = true
    }
    return text
  }

  if (Array.isArray(node)) {
    const result = [...node]
    if (result.length > 0) {
      result[0] = stripHighlightMarkers(result[0], state)
      result[result.length - 1] = stripHighlightMarkers(result[result.length - 1], state)
    }
    return result
  }

  if (node.props && node.props.children) {
    return {
      ...node,
      props: {
        ...node.props,
        children: stripHighlightMarkers(node.props.children, state)
      }
    }
  }

  return node
}

function stripCalloutPrefix(node: any, state: { stripped: boolean }): any {
  if (state.stripped) return node
  if (!node) return node

  if (typeof node === 'string') {
    const match = node.match(/^\s*\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION|INFO|TODO|SUCCESS|FAILURE|DANGER|BUG|EXAMPLE|QUOTE)\]\s*([\s\S]*)$/i)
    if (match) {
      state.stripped = true
      const lines = match[2].split('\n')
      if (lines.length > 1) {
        return lines.slice(1).join('\n')
      }
      return ''
    }
    return node
  }

  if (Array.isArray(node)) {
    return node.map((n) => stripCalloutPrefix(n, state))
  }

  if (node.props && node.props.children) {
    return {
      ...node,
      props: {
        ...node.props,
        children: stripCalloutPrefix(node.props.children, state)
      }
    }
  }

  return node
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkdownRenderer Component
// ─────────────────────────────────────────────────────────────────────────────
interface MarkdownRendererProps {
  content: string
  className?: string
  audioMap?: Record<string, string>
  onNoteClick?: (title: string) => void
  style?: React.CSSProperties
}

export function MarkdownRenderer({ content, className = '', audioMap, onNoteClick, style }: MarkdownRendererProps) {
  const [activeImage, setActiveImage] = useState<string | null>(null)
  const [activeAlt, setActiveAlt] = useState<string>('')
  
  const activeNoteId = useNoteStore((s) => s.activeNoteId)

  // 1. Pre-process WikiLinks: [[Title]] -> [Title](note:Title)
  let processedContent = (content || '').replace(/\[\[([^\]]+)\]\]/g, '[$1](note:$1)')
  
  // 2. Pre-process Highlight syntax: ==text== -> **==text==** so ReactMarkdown parses it as strong
  processedContent = processedContent.replace(/==([^=]+)==/g, '**==$1==**')

  // 3. Parse content into root sections and collapsible headings
  const parsed = useMemo(() => parseSections(processedContent), [processedContent])

  const renderMarkdown = (mdContent: string, isTitle = false) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        urlTransform={(uri: string) => uri}
        components={{
          // Unwrap paragraph tags for title rendering to keep them inline
          ...(isTitle ? { p: ({ children }: { children?: React.ReactNode }) => <>{children}</> } : {}),
          // Open links in new tab, but handle internal note links
          a: ({ href, children, ...props }) => {
            if (href?.startsWith('note:')) {
              const title = href.replace('note:', '')
              return (
                <a
                  {...props}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onNoteClick?.(title)
                  }}
                  className="text-primary font-bold decoration-primary/30 hover:underline"
                >
                  {children}
                </a>
              )
            }
            return <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="hover:underline" />
          },
          img: isTitle ? () => null : ({ src, alt, ...props }) => {
            const srcStr = typeof src === 'string' ? src : ''

            let resolvedSrc = srcStr
            if (srcStr.startsWith('audio:')) {
              const audioId = srcStr.replace('audio:', '')
              resolvedSrc = audioMap?.[audioId] || ''
            }

            if (resolvedSrc.startsWith('data:audio/') || srcStr.startsWith('audio:')) {
              return (
                <span className="my-6 p-4 rounded-2xl border border-border/30 bg-card/45 backdrop-blur-md shadow-lg flex flex-col gap-3 max-w-md mx-auto block">
                  <span className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex shrink-0">
                      <span className="text-lg">🎙️</span>
                    </span>
                    <span className="flex-1 min-w-0 block">
                      <span className="text-xs font-bold text-foreground/90 truncate block">{alt || 'Voice Note'}</span>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest block">Audio Recording</span>
                    </span>
                  </span>
                  {resolvedSrc && (
                    <audio
                      src={resolvedSrc}
                      controls
                      className="w-full h-8 accent-primary block"
                    />
                  )}
                </span>
              )
            }

            return (
              <img
                {...props}
                src={src}
                alt={alt}
                onClick={() => {
                  if (srcStr) {
                    setActiveImage(srcStr)
                    setActiveAlt(alt || '')
                  }
                }}
                className="rounded-2xl border border-border/40 shadow-xl max-w-full my-6 transition-transform hover:scale-[1.01] cursor-zoom-in mx-auto block hover:shadow-2xl"
                loading="lazy"
              />
            )
          },
          // Custom Code Block component wrapper for block-level code blocks
          pre: ({ children }) => {
            const codeElement = React.Children.toArray(children)[0] as any
            if (codeElement && codeElement.type === 'code') {
              const { className, children: codeChildren } = codeElement.props || {}
              return <CodeBlock className={className}>{codeChildren}</CodeBlock>
            }
            return <pre>{children}</pre>
          },
          // Native Custom Highlight tags
          strong: ({ children }) => {
            const fullText = getReactNodeText(children)
            if (fullText.startsWith('==') && fullText.endsWith('==')) {
              const state = { strippedStart: false, strippedEnd: false }
              const cleanedChildren = stripHighlightMarkers(children, state)
              return (
                <mark className="bg-yellow-500/30 text-foreground dark:bg-yellow-500/40 rounded px-1">
                  {cleanedChildren}
                </mark>
              )
            }
            return <strong>{children}</strong>
          },
          // Obsidian-style Callouts / Admonitions
          blockquote: ({ children }) => {
            const text = getReactNodeText(children)
            const calloutMatch = text.match(/^\s*\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION|INFO|TODO|SUCCESS|FAILURE|DANGER|BUG|EXAMPLE|QUOTE)\]\s*(.*)/i)
            
            if (calloutMatch) {
              const type = calloutMatch[1].toLowerCase()
              const rest = calloutMatch[2].trim()
              const titleLine = rest.split('\n')[0].trim()
              
              const config = calloutConfigs[type] || calloutConfigs.note
              const Icon = config.icon
              const displayTitle = titleLine || config.title

              const state = { stripped: false }
              const cleanedChildren = stripCalloutPrefix(children, state)

              return (
                <div className={`my-4 p-4 rounded-r-xl border-l-4 ${config.borderClass} ${config.bgClass} flex flex-col gap-2`}>
                  <div className={`flex items-center gap-2 font-bold ${config.textClass} text-sm select-none`}>
                    <Icon className={`w-4 h-4 ${config.iconClass} shrink-0`} />
                    <span className="capitalize">{displayTitle}</span>
                  </div>
                  <div className="text-foreground text-sm prose-p:my-1">
                    {cleanedChildren}
                  </div>
                </div>
              )
            }

            return <blockquote>{children}</blockquote>
          },
          li: CollapsibleListItem
        }}
      >
        {mdContent}
      </ReactMarkdown>
    )
  }

  const renderSection = (sec: MarkdownSection) => {
    return (
      <SectionComponent
        key={sec.id}
        noteId={activeNoteId || 'default'}
        section={sec}
        renderContent={renderMarkdown}
        renderSection={renderSection}
      />
    )
  }

  return (
    <div className={`prose-obel ${className}`} style={style}>
      {/* 1. Render Root Content */}
      {parsed.rootContent.trim().length > 0 && renderMarkdown(parsed.rootContent)}
      
      {/* 2. Render Hierarchical Collapsible Sections */}
      {parsed.sections.map(renderSection)}

      {/* Premium Cinematic Lightbox Overlay */}
      <AnimatePresence>
        {activeImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveImage(null)}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative max-w-full max-h-[85vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={activeImage}
                alt={activeAlt || 'Zoomed image'}
                className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain border border-white/5"
              />
              <button
                onClick={() => setActiveImage(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-white flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
            {activeAlt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 bg-black/60 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full border border-white/10 uppercase tracking-widest pointer-events-none"
              >
                {activeAlt}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
