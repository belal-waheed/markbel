import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, X, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToastStore } from '@/stores/toastStore'
import { Button } from './button'

export function UndoToast() {
  const isVisible = useToastStore((s) => s.isOpen)
  const message = useToastStore((s) => s.message)
  const undo = useToastStore((s) => s.undo)
  const hideToast = useToastStore((s) => s.hideToast)

  const [progress, setProgress] = useState(100)
  const DURATION = 3000 

  useEffect(() => {
    if (isVisible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(100)
      const startTime = Date.now()
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100)
        setProgress(remaining)
        
        if (elapsed >= DURATION) {
          hideToast()
          clearInterval(interval)
        }
      }, 50)

      return () => clearInterval(interval)
    }
  }, [isVisible, hideToast])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-100 w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="relative overflow-hidden bg-foreground text-background rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 border border-white/10 group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <p className="text-sm font-bold tracking-tight line-clamp-1">{message}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
                className="h-9 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] gap-1.5 shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                Redo
              </Button>
              <button 
                onClick={hideToast}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-4 h-4 opacity-50 hover:opacity-100" />
              </button>
            </div>

            {/* Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <motion.div 
                className="h-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
