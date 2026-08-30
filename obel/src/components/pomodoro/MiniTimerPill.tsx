import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Pause, Play, X } from 'lucide-react'
import { useTimerStore } from '@/stores/timerStore'
import { useNavigate } from 'react-router-dom'
import { haptics } from '@/lib/haptics'
import { useState, useEffect } from 'react'

export function MiniTimerPill({ isMobile }: { isMobile?: boolean }) {
  const navigate = useNavigate()
  const isRunning = useTimerStore((s) => s.isRunning)
  const timeRemaining = useTimerStore((s) => s.timeRemaining)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const mode = useTimerStore((s) => s.mode)

  const [dismissed, setDismissed] = useState(false)

  // Re-show the pill whenever a new session starts (mode or running state changes)
  useEffect(() => {
    if (isRunning) setDismissed(false)
  }, [isRunning, mode])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.light()
    if (isRunning) pause()
    else start()
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.light()
    setDismissed(true)
  }

  const handleClick = () => {
    haptics.light()
    navigate('/pomodoro')
  }

  const isVisible = !dismissed && (isRunning || (timeRemaining > 0 && timeRemaining < 1500))

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: isMobile ? 20 : 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isMobile ? 20 : 10, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={handleClick}
          className={`glass-card p-1.5 pr-3 rounded-full flex items-center gap-3 cursor-pointer shadow-lg border-primary/20 ${
            isMobile 
              ? 'fixed left-4 right-4 z-40 mx-auto max-w-[200px]' 
              : 'w-full mb-4'
          }`}
          style={isMobile ? { bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' } : {}}
        >
          <button 
            onClick={handleToggle}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isRunning ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >
            {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          
          <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
            <Timer className={`w-3.5 h-3.5 shrink-0 ${isRunning ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <span className={`text-sm font-bold tracking-widest tabular-nums ${isRunning ? 'text-foreground' : 'text-muted-foreground'}`}>
              {displayTime}
            </span>
          </div>

          <button 
            onClick={handleDismiss}
            title="Hide pill (session keeps running)"
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
