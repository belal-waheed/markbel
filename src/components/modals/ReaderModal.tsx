import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  BookOpen,
  ExternalLink,
  Copy,
  Check,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  Calendar,
  User,
  Globe,
  Type,
  History,
  Columns2,
} from 'lucide-react'
import { LocalBookmark } from '../../db/db'
import { api } from '../../lib/api'
import { bookmarkRepository } from '../../db/SyncRepository'
import { syncManager } from '../../db/SyncManager'
import { useModalBackNavigation } from '../../lib/useModalBackNavigation'

export interface ReaderModalProps {
  isOpen: boolean
  bookmark: LocalBookmark | null
  onClose: () => void
  onToggleRead?: (b: LocalBookmark) => void
}

type FontFamily = 'sans' | 'serif' | 'mono'
type FontSize = 'sm' | 'base' | 'lg' | 'xl'
type ColumnWidth = 'narrow' | 'standard' | 'wide'

export const ReaderModal: React.FC<ReaderModalProps> = ({
  isOpen,
  bookmark,
  onClose,
  onToggleRead,
}) => {
  // Modal Back Navigation Trap
  useModalBackNavigation([
    {
      isOpen,
      close: onClose,
    },
  ])

  // Typography Preferences
  const [fontFamily, setFontFamily] = useState<FontFamily>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('markbel_reader_font') as FontFamily
      if (saved === 'serif' || saved === 'sans' || saved === 'mono') return saved
    }
    return 'sans'
  })

  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('markbel_reader_fontsize') as FontSize
      if (saved === 'sm' || saved === 'base' || saved === 'lg' || saved === 'xl') return saved
    }
    return 'base'
  })

  const [columnWidth, setColumnWidth] = useState<ColumnWidth>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('markbel_reader_width') as ColumnWidth
      if (saved === 'narrow' || saved === 'standard' || saved === 'wide') return saved
    }
    return 'standard'
  })

  const [scrollProgress, setScrollProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [localArticleContent, setLocalArticleContent] = useState<string | null>(null)
  const [localStats, setLocalStats] = useState<{
    readingTime?: number
    wordCount?: number
    author?: string
    publishedAt?: string
  }>({})

  const contentScrollRef = useRef<HTMLDivElement>(null)

  // Reset or initialize state when bookmark changes or modal opens
  useEffect(() => {
    if (bookmark) {
      setLocalArticleContent(bookmark.articleContent || null)
      setLocalStats({
        readingTime: bookmark.readingTime,
        wordCount: bookmark.wordCount,
        author: bookmark.author,
        publishedAt: bookmark.publishedAt,
      })
      setDownloadError(null)
      setScrollProgress(0)
      if (contentScrollRef.current) {
        contentScrollRef.current.scrollTop = 0
      }
    }
  }, [bookmark, isOpen])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Persist typography choices
  const handleFontFamilyChange = (font: FontFamily) => {
    setFontFamily(font)
    if (typeof window !== 'undefined') {
      localStorage.setItem('markbel_reader_font', font)
    }
  }

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size)
    if (typeof window !== 'undefined') {
      localStorage.setItem('markbel_reader_fontsize', size)
    }
  }

  const handleColumnWidthChange = (w: ColumnWidth) => {
    setColumnWidth(w)
    if (typeof window !== 'undefined') {
      localStorage.setItem('markbel_reader_width', w)
    }
  }

  // Scroll depth tracking
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight - target.clientHeight
    if (scrollHeight > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)))
      setScrollProgress(pct)
    } else {
      setScrollProgress(0)
    }
  }

  // Copy link
  const handleCopyLink = async () => {
    if (!bookmark?.url) return
    try {
      await navigator.clipboard.writeText(bookmark.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // Download Article Content on-demand
  const handleDownloadContent = async () => {
    if (!bookmark) return
    setIsDownloading(true)
    setDownloadError(null)

    try {
      const data = await api.extractArticle(bookmark.url, true)
      if (!data || !data.content) {
        throw new Error('No article content returned from extractor')
      }

      setLocalArticleContent(data.content)
      setLocalStats({
        readingTime: data.readingTime,
        wordCount: data.wordCount,
        author: data.author || bookmark.author,
        publishedAt: data.publishedAt || bookmark.publishedAt,
      })

      // Persist to Dexie and sync
      await bookmarkRepository.update(bookmark.id, {
        articleContent: data.content,
        readingTime: data.readingTime || bookmark.readingTime,
        wordCount: data.wordCount || bookmark.wordCount,
        author: data.author || bookmark.author,
        publishedAt: data.publishedAt || bookmark.publishedAt,
      })
      syncManager.sync(true)
    } catch (err: any) {
      console.error('Failed to download article content:', err)
      setDownloadError(err?.message || 'Failed to download article content. Please check the URL.')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen || !bookmark) return null

  const domain = (() => {
    try {
      return new URL(bookmark.url).hostname.replace(/^www\./, '')
    } catch {
      return bookmark.url
    }
  })()

  const currentContent = localArticleContent || bookmark.articleContent
  const readingTime = localStats.readingTime || bookmark.readingTime
  const wordCount = localStats.wordCount || bookmark.wordCount
  const author = localStats.author || bookmark.author
  const publishedAt = localStats.publishedAt || bookmark.publishedAt

  const fontSizeClass =
    fontSize === 'sm'
      ? 'text-sm leading-relaxed'
      : fontSize === 'base'
      ? 'text-base leading-relaxed'
      : fontSize === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-xl leading-relaxed'

  const fontFamilyClass =
    fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans'

  const columnWidthClass =
    columnWidth === 'narrow' ? 'max-w-xl' : columnWidth === 'wide' ? 'max-w-4xl' : 'max-w-2xl'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Distraction-free Reader View"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-2xl w-full max-w-5xl h-[92vh] sm:h-[90vh] shadow-2xl flex flex-col relative overflow-hidden">
        {/* Dynamic 2px Reading Progress Bar Tracking Scroll Depth */}
        <div className="w-full bg-[var(--color-bg-muted)] h-[2px] shrink-0 relative overflow-hidden">
          <div
            className="bg-[var(--color-accent)] h-full transition-[width] duration-150 ease-out"
            style={{ width: `${scrollProgress}%` }}
            role="progressbar"
            aria-valuenow={scrollProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Modal Toolbar Header */}
        <div className="px-4 py-3 sm:px-6 border-b border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-bg-surface)] shrink-0">
          {/* Left: Domain & Reader Tag */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-subtle)] border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)] shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate block">
                {bookmark.siteName || domain}
              </span>
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)] flex items-center gap-1 truncate">
                <Globe className="w-3 h-3 shrink-0" />
                {domain}
              </span>
            </div>
          </div>

          {/* Right: Typography Controls & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Font Family Switcher: Sans, Serif, Mono */}
            <div className="flex items-center rounded-lg bg-[var(--color-bg-muted)] p-0.5 border border-[var(--color-border-subtle)]">
              <button
                type="button"
                onClick={() => handleFontFamilyChange('sans')}
                className={`px-2 py-1 text-xs rounded font-sans transition-colors cursor-pointer ${
                  fontFamily === 'sans'
                    ? 'bg-[var(--color-accent)] text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Sans-serif font"
              >
                Sans
              </button>
              <button
                type="button"
                onClick={() => handleFontFamilyChange('serif')}
                className={`px-2 py-1 text-xs rounded font-serif transition-colors cursor-pointer ${
                  fontFamily === 'serif'
                    ? 'bg-[var(--color-accent)] text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Serif font"
              >
                Serif
              </button>
              <button
                type="button"
                onClick={() => handleFontFamilyChange('mono')}
                className={`px-2 py-1 text-xs rounded font-mono transition-colors cursor-pointer ${
                  fontFamily === 'mono'
                    ? 'bg-[var(--color-accent)] text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
                title="Monospace font"
              >
                Mono
              </button>
            </div>

            {/* Font Size Steppers: SM, BASE, LG, XL */}
            <div className="flex items-center rounded-lg bg-[var(--color-bg-muted)] p-0.5 border border-[var(--color-border-subtle)]">
              {(['sm', 'base', 'lg', 'xl'] as FontSize[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleFontSizeChange(size)}
                  className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                    fontSize === size
                      ? 'bg-[var(--color-accent)] text-white font-bold'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                  title={`Font size ${size}`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Column Width Selector: Narrow, Standard, Wide */}
            <div className="hidden sm:flex items-center rounded-lg bg-[var(--color-bg-muted)] p-0.5 border border-[var(--color-border-subtle)]">
              {(['narrow', 'standard', 'wide'] as ColumnWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => handleColumnWidthChange(w)}
                  className={`px-2 py-1 text-[11px] capitalize rounded transition-colors cursor-pointer ${
                    columnWidth === w
                      ? 'bg-[var(--color-accent)] text-white font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                  title={`${w} column width`}
                >
                  {w === 'standard' ? 'Normal' : w}
                </button>
              ))}
            </div>

            {/* Mark as Read Toggle */}
            {onToggleRead && (
              <button
                type="button"
                onClick={() => onToggleRead(bookmark)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  bookmark.isRead
                    ? 'bg-[var(--color-bg-muted)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                    : 'bg-[var(--color-brand-subtle)] border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:opacity-90'
                }`}
                title={bookmark.isRead ? 'Mark unread' : 'Mark read'}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {bookmark.isRead ? 'Read' : 'Mark Read'}
                </span>
              </button>
            )}

            {/* Wayback Machine Button */}
            <button
              type="button"
              onClick={() =>
                window.open(`https://web.archive.org/web/*/${bookmark.url}`, '_blank', 'noopener,noreferrer')
              }
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-amber-500 hover:bg-amber-500/10 border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
              title="Open archived snapshot on Wayback Machine"
              aria-label="Wayback Machine Snapshot"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
              title={copied ? 'Copied URL!' : 'Copy article URL'}
              aria-label="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Open Original Webpage */}
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
              title="Open original webpage"
              aria-label="Open original webpage"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer"
              title="Close reader view (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Article Body */}
        <div
          ref={contentScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 md:px-12 py-6 sm:py-8 space-y-6"
        >
          {/* Article Header Metadata */}
          <div className={`${columnWidthClass} mx-auto space-y-3 pb-6 border-b border-[var(--color-border-subtle)] transition-all`}>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight leading-tight">
              {bookmark.title || 'Untitled Article'}
            </h1>

            {/* Metadata Badges Strip */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              {author && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{author}</span>
                </span>
              )}
              {publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(publishedAt).toLocaleDateString()}</span>
                </span>
              )}
              {readingTime ? (
                <span className="flex items-center gap-1 bg-[var(--color-bg-muted)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)] font-mono">
                  <Clock className="w-3 h-3 text-[var(--color-accent)] shrink-0" />
                  <span>{readingTime} min read</span>
                </span>
              ) : null}
              {wordCount ? (
                <span className="flex items-center gap-1 bg-[var(--color-bg-muted)] px-2 py-0.5 rounded border border-[var(--color-border-subtle)] font-mono">
                  <Type className="w-3 h-3 shrink-0" />
                  <span>{wordCount} words</span>
                </span>
              ) : null}
            </div>

            {bookmark.description && (
              <p className="text-sm italic text-[var(--color-text-secondary)] pt-1">
                {bookmark.description}
              </p>
            )}
          </div>

          {/* Article Content or Empty / Download State */}
          <div className={`${columnWidthClass} mx-auto pb-12 transition-all`}>
            {currentContent ? (
              <article
                className={`prose prose-invert max-w-none ${fontFamilyClass} ${fontSizeClass} space-y-4 text-[var(--color-text-primary)] [&>p]:leading-relaxed [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:text-xl [&>h2]:font-bold [&>h3]:text-lg [&>h3]:font-bold [&>blockquote]:border-l-4 [&>blockquote]:border-[var(--color-accent)] [&>blockquote]:pl-4 [&>blockquote]:italic [&>pre]:bg-[var(--color-bg-muted)] [&>pre]:p-4 [&>pre]:rounded-xl [&>pre]:overflow-x-auto [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>img]:rounded-xl [&>img]:shadow-md`}
                dangerouslySetInnerHTML={{ __html: currentContent }}
              />
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-[var(--color-bg-muted)]/40 border border-dashed border-[var(--color-border-subtle)] rounded-2xl p-6 sm:p-10">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-subtle)] border border-[var(--color-accent)]/20 flex items-center justify-center text-[var(--color-accent)]">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    No Offline Article Content Saved
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Download clean, distraction-free reader text directly from the edge article extraction service.
                  </p>
                </div>

                {downloadError && (
                  <div className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg max-w-md">
                    {downloadError}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadContent}
                    disabled={isDownloading}
                    className="btn-primary px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Extracting Article...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download Article Content</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      window.open(`https://web.archive.org/web/*/${bookmark.url}`, '_blank', 'noopener,noreferrer')
                    }
                    className="btn-secondary px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Wayback Snapshot</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReaderModal
