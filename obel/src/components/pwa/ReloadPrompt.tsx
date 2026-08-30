import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ReloadPrompt() {
  const [offlineReady, setOfflineReady] = useState(false)
  const [needRefresh, setNeedRefresh] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((reg) => {
      setSwRegistration(reg)
      
      if (reg.waiting) {
        setNeedRefresh(true)
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                setNeedRefresh(true)
              } else {
                setOfflineReady(true)
              }
            }
          })
        }
      })
    })

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [])

  const updateServiceWorker = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
  }

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -track-x-1/2 z-100 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-card/70 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-3 pl-6 flex items-center gap-6 shadow-2xl shadow-primary/10 pointer-events-auto min-w-[320px]">
             <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  {needRefresh ? 'Update Available' : 'Ready for Offline'}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
                  {needRefresh ? 'A new version of Obel is ready' : 'Obel is now cached for offline focus'}
                </span>
             </div>

             <div className="flex items-center gap-2">
                {needRefresh && (
                  <Button 
                    size="sm" 
                    onClick={updateServiceWorker}
                    className="h-10 px-6 rounded-2xl font-black uppercase tracking-tight gap-2 shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:scale-[1.02] transition-transform"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={close}
                  className="h-10 w-10 rounded-full hover:bg-white/5 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
             </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
