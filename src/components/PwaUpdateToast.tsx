import { useRegisterSW } from 'virtual:pwa-register/react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

export function PwaUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Automatically check for SW updates every hour
        setInterval(() => {
          r.update().catch(() => {})
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.warn('SW registration error', error)
    },
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[100] sm:w-96 max-w-md overflow-hidden rounded-xl border border-blue-500/30 bg-[#090d16] text-[#e1e4ea] shadow-[0_8px_30px_rgb(0,0,0,0.4)] ring-1 ring-white/10"
        >
          <div className="flex items-start p-4">
            <div className="flex-shrink-0 pt-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <RefreshCw className="h-4 w-4" />
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Update Available</p>
              <p className="mt-1 text-sm text-[#8c91a0] leading-snug">
                A new version of Markbel is ready. Refresh to apply the latest features and bug fixes.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => updateServiceWorker(true)}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors touch-manipulation cursor-pointer"
                >
                  Refresh App
                </button>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  className="inline-flex items-center justify-center rounded-md bg-white/10 px-3.5 py-2 text-xs font-semibold text-[#e1e4ea] shadow-sm hover:bg-white/20 transition-colors touch-manipulation cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <div className="ml-3 flex flex-shrink-0">
              <button
                type="button"
                className="inline-flex rounded-md p-1 bg-transparent text-[#8c91a0] hover:text-[#e1e4ea] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#090d16] touch-manipulation cursor-pointer"
                onClick={() => setNeedRefresh(false)}
              >
                <span className="sr-only">Close</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
