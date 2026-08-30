import { motion } from 'framer-motion'
import { Trophy, Star, Sparkles, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
// import confetti from 'canvas-confetti'
import { Button } from './button'
import { Dialog, DialogContent } from './dialog'

interface LevelUpModalProps {
  isOpen: boolean
  onClose: () => void
  level: number
}

export function LevelUpModal({ isOpen, onClose, level }: LevelUpModalProps) {
  useEffect(() => {
    if (isOpen) {
      import('canvas-confetti').then((confetti) => {
        const duration = 3 * 1000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

        const interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now()

          if (timeLeft <= 0) {
            return clearInterval(interval)
          }

          const particleCount = 50 * (timeLeft / duration)
          confetti.default({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
          confetti.default({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
        }, 250)
      })
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none bg-transparent shadow-none outline-none z-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="relative bg-card/90 backdrop-blur-3xl border border-primary/20 rounded-[3rem] p-8 text-center shadow-2xl overflow-hidden"
        >
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-24 h-24 text-primary" />
          </div>
          <div className="absolute bottom-0 left-0 p-4 opacity-10">
            <Star className="w-16 h-16 text-primary" />
          </div>

          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className="w-24 h-24 bg-linear-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/30 relative"
          >
            <Trophy className="w-12 h-12 text-primary-foreground" />
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [1, 1.5, 1.2] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-primary/20 rounded-3xl"
            />
          </motion.div>

          <h2 className="text-4xl font-black tracking-tighter mb-2 bg-linear-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            LEVEL UP!
          </h2>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-xs mb-8">
            New Milestone Reached
          </p>

          <div className="bg-white/5 rounded-3xl p-6 border border-white/10 mb-8 relative group overflow-hidden">
             <div className="flex items-center justify-center gap-4 relative z-10">
                <div className="text-center">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">From</p>
                  <p className="text-2xl font-black text-muted-foreground opacity-50">{level - 1}</p>
                </div>
                <ArrowRight className="w-6 h-6 text-primary" />
                <div className="text-center">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">To</p>
                  <p className="text-5xl font-black text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]">{level}</p>
                </div>
             </div>
             
             {/* Animated background glow */}
             <div className="absolute inset-0 bg-linear-to-tr from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>

          <p className="text-sm font-medium text-muted-foreground mb-8 leading-relaxed">
            You&apos;re crushing it! Your productivity is soaring. <br/>Keep the momentum going.
          </p>

          <Button 
            onClick={onClose}
            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest shadow-xl shadow-primary/20 group overflow-hidden relative"
          >
            <span className="relative z-10">Continue Journey</span>
            <motion.div 
               className="absolute inset-0 bg-white/10"
               initial={{ x: '-100%' }}
               whileHover={{ x: '100%' }}
               transition={{ duration: 0.5 }}
            />
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
