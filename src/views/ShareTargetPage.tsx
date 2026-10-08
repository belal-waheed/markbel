import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Loader2 } from 'lucide-react'
import { bookmarkRepository } from '../db/SyncRepository.js'
import { syncManager } from '../db/SyncManager.js'
import { resolveSmartGroup, getCustomSmartGroupRules } from '../lib/smartGroups.js'
import { extractSharePayload, reconstructUnencodedShareParams } from '../lib/shareTarget.js'
import { useAuth } from '../lib/auth.js'

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isProcessedRef = useRef(false)

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform()

    // Force transparency only on native mobile wrappers (e.g. Android Quick-Share sheet)
    if (isNative) {
      document.body.style.backgroundColor = 'transparent'
      document.documentElement.style.backgroundColor = 'transparent'
      document.documentElement.style.display = 'none'
    }

    const cleanup = () => {
      if (isNative) {
        document.body.style.backgroundColor = ''
        document.documentElement.style.backgroundColor = ''
        document.documentElement.style.display = ''
      }
    }

    if (isProcessedRef.current) return cleanup
    isProcessedRef.current = true

    async function processSharedLink() {
      const { rawTitle, rawText, rawUrl } = reconstructUnencodedShareParams(searchParams)

      const { targetUrl: cleanUrl, title: fallbackTitle, image: instantImage, contentType } = extractSharePayload({
        rawUrl,
        rawText,
        rawTitle,
      })

      if (!cleanUrl) {
        if (Capacitor.isNativePlatform()) {
          CapApp.exitApp()
        } else {
          navigate('/app', { replace: true })
        }
        return
      }

      const customRules = await getCustomSmartGroupRules().catch(() => [])
      const smartGroup = resolveSmartGroup(cleanUrl, undefined, customRules)
      const bookmarkId = crypto.randomUUID()
      const userId = user?.id || 'local-user'

      try {
        // Save immediately with basic heuristics. The Cloudflare Worker will scrape missing metadata.
        await bookmarkRepository.create({
          id: bookmarkId,
          userId,
          url: cleanUrl,
          title: fallbackTitle,
          description: '',
          image: instantImage || '',
          group: smartGroup,
          contentType: contentType as any,
          isRead: false,
          isPinned: false,
        })

        // Await sync before process termination with 1200ms timeout
        await Promise.race([
          syncManager.sync(true),
          new Promise((res) => setTimeout(res, 1200))
        ]).catch(() => {});
        
        if (Capacitor.isNativePlatform()) {
          CapApp.exitApp()
        } else {
          navigate('/app', { replace: true })
        }
      } catch (err) {
        console.error('[Share Target] Error saving bookmark:', err)
        if (Capacitor.isNativePlatform()) {
          CapApp.exitApp()
        } else {
          navigate('/app', { replace: true })
        }
      }
    }

    processSharedLink()
    return cleanup
  }, [searchParams, navigate, user])

  // Headless on native mobile to keep share intent instant
  if (Capacitor.isNativePlatform()) {
    return null
  }

  // Visual feedback HUD on Web and PWA browsers
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-default)] text-[var(--color-text-primary)] gap-3 font-sans">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
      <span className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
        Saving bookmark to vault...
      </span>
    </div>
  )
}
