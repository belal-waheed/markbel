import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'

interface LevelBadgeProps {
  level: number
  xp: number
  size?: 'sm' | 'md' | 'lg'
}

export function LevelBadge({ level, xp, size = 'md' }: LevelBadgeProps) {
  const xpInLevel = xp % 500
  const progress = (xpInLevel / 500) * 100

  const sizes = {
    sm: {
      container: 'h-8 px-2 min-w-[60px]',
      icon: 'w-3 h-3',
      text: 'text-[10px]',
      progress: 'h-0.5'
    },
    md: {
      container: 'h-10 px-3 min-w-[80px]',
      icon: 'w-4 h-4',
      text: 'text-xs',
      progress: 'h-1'
    },
    lg: {
      container: 'h-16 px-6 min-w-[140px]',
      icon: 'w-6 h-6',
      text: 'text-lg',
      progress: 'h-2'
    }
  }

  const currentSize = sizes[size]

  return (
    <div className={`relative flex flex-col justify-center rounded-xl bg-white/5 border border-white/10 overflow-hidden ${currentSize.container}`}>
      <div className="flex items-center justify-between mb-1 gap-2 relative z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-black uppercase tracking-tighter text-foreground ${currentSize.text}`}>
            LVL {level}
          </span>
        </div>
        {size !== 'sm' && (
          <div className="flex items-center gap-1 text-muted-foreground tabular-nums">
             <Zap className="w-3 h-3 text-primary fill-primary" />
             <span className="text-[10px] font-bold text-foreground/50">{xpInLevel}/500</span>
          </div>
        )}
      </div>

      <div className={`w-full bg-white/10 rounded-full overflow-hidden relative ${currentSize.progress}`}>
         <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1] }}
            className="absolute inset-y-0 left-0 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]"
         />
      </div>
    </div>
  )
}
