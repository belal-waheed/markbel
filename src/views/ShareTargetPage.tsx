import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Link as LinkIcon, ExternalLink, X } from 'lucide-react'
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
  const [canAutoClose, setCanAutoClose] = useState(false)

  const isProcessedRef = useRef(false)

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
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))

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
        // Save bookmark directly with rich metadata
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

        // Queue sync to Cloudflare D1
        syncManager.sync(true)
        setStatus('saved')
        setCanAutoClose(true)
      } catch (err) {
        console.error('[Share Target] Error saving bookmark:', err)
        setStatus('error')
      }
    }

    processSharedLink()
  }, [searchParams, user])

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close()
      // Fallback if window.close() is prevented by browser
      setTimeout(() => {
        navigate('/', { replace: true })
      }, 200)
    }
  }

  const handleOpenVault = () => {
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] p-4 text-[#e1e4ea] font-sans antialiased">
      <div className="w-full max-w-sm bg-[#111622] border border-[#232b3e] rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#232b3e]/60">
          <div className="flex items-center gap-2.5">
            <MarkbelLogo size={24} />
            <span className="text-xs font-bold tracking-wider uppercase text-[#94a3b8]">
              Markbel Vault
            </span>
          </div>
          {status === 'saved' && (
            <button
              onClick={handleClose}
              className="text-[#94a3b8] hover:text-[#e1e4ea] p-1 rounded-lg hover:bg-[#1a2234] transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Saving State */}
        {status === 'saving' && (
          <div className="py-6 text-center space-y-4">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-[#0284c7]/10 border border-[#0284c7]/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#0284c7]" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[#f1f5f9]">Saving to Markbel...</h2>
              {savedTitle && (
                <p className="text-xs text-[#94a3b8] truncate max-w-[260px] mx-auto">
                  {savedTitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Saved Success HUD */}
        {status === 'saved' && (
          <div className="space-y-4">
            {/* Status confirmation badge */}
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold">Saved to Vault</span>
              {resolvedGroup && resolvedGroup !== 'Unsorted' && (
                <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#1e293b] text-[#cbd5e1] border border-[#334155]">
                  {resolvedGroup}
                </span>
              )}
            </div>

            {/* Rich Preview Card */}
            <div className="bg-[#0b101b] border border-[#1e293b] rounded-xl overflow-hidden">
              {savedImage && (
                <div className="relative aspect-video w-full bg-[#05080f] overflow-hidden border-b border-[#1e293b]">
                  <img
                    src={savedImage}
                    alt={savedTitle}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
              <div className="p-3 space-y-1">
                <h3 className="text-xs font-bold text-[#f1f5f9] line-clamp-2 leading-snug">
                  {savedTitle || 'Saved Link'}
                </h3>
                {savedDescription && (
                  <p className="text-[11px] text-[#94a3b8] line-clamp-2 leading-relaxed">
                    {savedDescription}
                  </p>
                )}
                <div className="pt-1 flex items-center gap-1 text-[10px] text-[#64748b] truncate">
                  <LinkIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{targetUrl}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                Done
              </button>
              <button
                onClick={handleOpenVault}
                className="w-full py-2 px-4 rounded-xl text-xs font-medium text-[#94a3b8] hover:text-[#e1e4ea] hover:bg-[#1a2234] transition-all flex items-center justify-center gap-1"
              >
                <span>Open Markbel Vault</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="py-4 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#f1f5f9]">No Link Detected</h3>
              <p className="text-xs text-[#94a3b8]">Could not parse a valid URL from the share data.</p>
            </div>
            <button
              onClick={handleOpenVault}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-[#1a2234] text-[#e1e4ea] hover:bg-[#232b3e] transition-colors"
            >
              Go to Markbel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
