import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Link as LinkIcon } from 'lucide-react'
import { bookmarkRepository } from '../db/SyncRepository.js'
import { syncManager } from '../db/SyncManager.js'
import { api } from '../lib/api.js'
import MarkbelLogo from '../components/MarkbelLogo.js'

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving')
  const [savedTitle, setSavedTitle] = useState('')

  useEffect(() => {
    async function processSharedLink() {
      const rawTitle = searchParams.get('title') || ''
      const rawText = searchParams.get('text') || ''
      const rawUrl = searchParams.get('url') || ''

      // Extract URL from url parameter or text parameter
      let targetUrl = rawUrl
      if (!targetUrl && rawText) {
        const urlMatch = rawText.match(/(https?:\/\/[^\s]+)/)
        if (urlMatch) {
          targetUrl = urlMatch[0]
        }
      }

      if (!targetUrl) {
        setStatus('error')
        setTimeout(() => navigate('/', { replace: true }), 2500)
        return
      }

      try {
        let initialTitle = rawTitle || rawText.replace(targetUrl, '').trim()
        if (!initialTitle) {
          try {
            initialTitle = new URL(targetUrl).hostname
          } catch {
            initialTitle = targetUrl
          }
        }

        setSavedTitle(initialTitle)

        // Save immediately to local IndexedDB for zero latency
        const bookmarkId = crypto.randomUUID()
        const createdBookmark = await bookmarkRepository.create({
          id: bookmarkId,
          userId: 'local-user',
          url: targetUrl,
          title: initialTitle,
          description: '',
          image: '',
          group: 'Unsorted',
          isRead: false,
          isPinned: false,
        })

        // Background metadata scrape
        api
          .get<{ title?: string; description?: string; image?: string }>(
            `/metadata?url=${encodeURIComponent(targetUrl)}`
          )
          .then(async (meta) => {
            if (meta.title || meta.image || meta.description) {
              await bookmarkRepository.update(bookmarkId, {
                title: meta.title || initialTitle,
                description: meta.description || '',
                image: meta.image || '',
              })
              syncManager.sync()
            }
          })
          .catch(() => {})

        syncManager.sync()
        setStatus('saved')

        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1200)
      } catch (err) {
        console.error('[Share Target] Error saving shared link:', err)
        setStatus('error')
        setTimeout(() => navigate('/', { replace: true }), 2000)
      }
    }

    processSharedLink()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-default)] p-4 text-[var(--color-text-primary)] font-sans">
      <div className="studio-card p-8 max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          <MarkbelLogo size={48} />
        </div>

        {status === 'saving' && (
          <div className="space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mx-auto" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Saving to Markbel...</h2>
            {savedTitle && (
              <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">{savedTitle}</p>
            )}
          </div>
        )}

        {status === 'saved' && (
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Saved to Vault</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Redirecting to bookmarks...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <LinkIcon className="w-8 h-8 text-[var(--color-status-error)] mx-auto" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">No Link Detected</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Redirecting to home...</p>
          </div>
        )}
      </div>
    </div>
  )
}
