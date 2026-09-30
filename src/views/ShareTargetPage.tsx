import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { bookmarkRepository } from '../db/SyncRepository.js'
import { syncManager } from '../db/SyncManager.js'
import { resolveSmartGroup } from '../lib/smartGroups.js'
import { extractSharePayload } from '../lib/shareTarget.js'
import { useAuth } from '../lib/auth.js'

export default function ShareTargetPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isProcessedRef = useRef(false)

  useEffect(() => {
    // Force complete transparency immediately
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    document.documentElement.style.display = 'none' // totally hide

    const cleanup = () => {
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
      document.documentElement.style.display = ''
    }

    if (isProcessedRef.current) return cleanup
    isProcessedRef.current = true

    async function processSharedLink() {
      const rawTitle = searchParams.get('title')
      const rawText = searchParams.get('text')
      const rawUrl = searchParams.get('url')

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

      const smartGroup = resolveSmartGroup(cleanUrl)
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

        // Queue sync and exit immediately (<50ms total footprint)
        syncManager.sync(true)
        
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

  // Headless component - return nothing so there is zero UI overlay
  return null
}
