import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Link as LinkIcon, ExternalLink, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { bookmarkRepository } from '../db/SyncRepository.js'
import { syncManager } from '../db/SyncManager.js'
import { resolveSmartGroup } from '../lib/smartGroups.js'
import { extractSharePayload } from '../lib/shareTarget.js'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving')
  const [savedTitle, setSavedTitle] = useState('')
  const [savedImage, setSavedImage] = useState('')
  const [savedDescription, setSavedDescription] = useState('')
  const [resolvedGroup, setResolvedGroup] = useState('')
  const [targetUrl, setTargetUrl] = useState('')

  const isProcessedRef = useRef(false)
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Configure transparent background on mount for HUD overlay
  useEffect(() => {
    const originalBodyBg = document.body.style.backgroundColor
    const originalHtmlBg = document.documentElement.style.backgroundColor

    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'

    return () => {
      document.body.style.backgroundColor = originalBodyBg
      document.documentElement.style.backgroundColor = originalHtmlBg
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current)
      }
    }
  }, [])

  const handleClose = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
    }

    if (Capacitor.isNativePlatform()) {
      CapApp.exitApp().catch(() => {
        navigate('/', { replace: true })
      })
    } else {
      if (typeof window !== 'undefined') {
        window.close()
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 150)
      }
    }
  }

  const handleOpenVault = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current)
    }
    navigate('/', { replace: true })
  }

  useEffect(() => {
    if (isProcessedRef.current) return
    isProcessedRef.current = true

    async function processSharedLink() {
      const rawTitle = searchParams.get('title')
      const rawText = searchParams.get('text')
      const rawUrl = searchParams.get('url')

      const { targetUrl: cleanUrl, title: fallbackTitle } = extractSharePayload({
        rawUrl,
        rawText,
        rawTitle,
      })

      if (!cleanUrl) {
        setStatus('error')
        return
      }

      setTargetUrl(cleanUrl)
      setSavedTitle(fallbackTitle)

      const smartGroup = resolveSmartGroup(cleanUrl)
      setResolvedGroup(smartGroup)

      const bookmarkId = crypto.randomUUID()
      const userId = user?.id || 'local-user'

      let finalTitle = fallbackTitle
      let finalDescription = ''
      let finalImage = ''

      // Eager metadata scrape with timeout for fast thumbnail extraction
      try {
        const metaPromise = api.get<{ title?: string; description?: string; image?: string }>(
          `/metadata?url=${encodeURIComponent(cleanUrl)}`
        )
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800))

        const meta = await Promise.race([metaPromise, timeoutPromise])

        if (meta) {
          if (meta.title && meta.title.trim()) finalTitle = meta.title.trim()
          if (meta.description && meta.description.trim()) finalDescription = meta.description.trim()
          if (meta.image && meta.image.trim()) finalImage = meta.image.trim()
        }
      } catch (scrapeErr) {
        console.warn('[Share Target] Eager scrape failed, using fallback:', scrapeErr)
      }

      setSavedTitle(finalTitle)
      setSavedImage(finalImage)
      setSavedDescription(finalDescription)

      try {
        // Save bookmark directly to local Dexie vault
        await bookmarkRepository.create({
          id: bookmarkId,
          userId,
          url: cleanUrl,
          title: finalTitle,
          description: finalDescription,
          image: finalImage,
          group: smartGroup,
          isRead: false,
          isPinned: false,
        })

        // Queue background sync to Cloudflare D1
        syncManager.sync(true)
        setStatus('saved')

        // Auto-dismiss HUD overlay after 1.5s
        autoCloseTimerRef.current = setTimeout(() => {
          handleClose()
        }, 1500)
      } catch (err) {
        console.error('[Share Target] Error saving bookmark:', err)
        setStatus('error')
      }
    }

    processSharedLink()
  }, [searchParams, user])

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300 font-sans antialiased text-[#e1e4ea]"
    >
      {/* Bottom Sheet Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#111622] border border-[#232b3e] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-300 mb-[env(safe-area-inset-bottom,0px)]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#232b3e]/60">
          <div className="flex items-center gap-2">
            <MarkbelLogo size={22} />
            <span className="text-xs font-bold tracking-wider uppercase text-[#94a3b8]">
              Markbel Quick-Save
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#94a3b8] hover:text-[#e1e4ea] p-1 rounded-lg hover:bg-[#1a2234] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Saving State */}
        {status === 'saving' && (
          <div className="py-4 text-center space-y-3">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-[#0284c7]/10 border border-[#0284c7]/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#0284c7]" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xs font-bold text-[#f1f5f9]">Saving to Vault...</h2>
              {savedTitle && (
                <p className="text-[11px] text-[#94a3b8] truncate max-w-[280px] mx-auto">
                  {savedTitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Saved Success State */}
        {status === 'saved' && (
          <div className="space-y-3">
            {/* Status confirmation badge */}
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Saved to Vault!</span>
              {resolvedGroup && (
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#1e293b] text-[#cbd5e1] border border-[#334155]">
                  {resolvedGroup}
                </span>
              )}
            </div>

            {/* Rich Thumbnail Preview */}
            <div className="bg-[#0b101b] border border-[#1e293b] rounded-xl overflow-hidden flex gap-3 p-2.5 items-center">
              {savedImage ? (
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-[#05080f] border border-[#1e293b]">
                  <img
                    src={savedImage}
                    alt={savedTitle}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 shrink-0 rounded-lg bg-[#05080f] border border-[#1e293b] flex items-center justify-center text-[#64748b]">
                  <LinkIcon className="w-5 h-5" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-xs font-bold text-[#f1f5f9] truncate">
                  {savedTitle || 'Saved Bookmark'}
                </h3>
                {savedDescription ? (
                  <p className="text-[11px] text-[#94a3b8] line-clamp-2 leading-tight">
                    {savedDescription}
                  </p>
                ) : (
                  <p className="text-[10px] text-[#64748b] truncate">{targetUrl}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] active:scale-[0.98] transition-all shadow-xs"
              >
                Done
              </button>
              <button
                onClick={handleOpenVault}
                className="py-2 px-3 rounded-lg text-xs font-medium text-[#94a3b8] hover:text-[#e1e4ea] hover:bg-[#1a2234] transition-all flex items-center gap-1 shrink-0"
              >
                <span>Open Vault</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="py-3 text-center space-y-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <LinkIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-[#f1f5f9]">No Valid Link Found</h3>
              <p className="text-[11px] text-[#94a3b8]">Could not parse a valid URL from the share data.</p>
            </div>
            <button
              onClick={handleClose}
              className="mt-1 w-full py-1.5 rounded-lg text-xs font-semibold bg-[#1a2234] text-[#e1e4ea] hover:bg-[#232b3e] transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
