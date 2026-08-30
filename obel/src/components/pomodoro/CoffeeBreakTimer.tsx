import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useTimerStore } from '@/stores/timerStore'
import { Coffee, Play, Pause, RotateCcw, Link2 } from 'lucide-react'
import { useState } from 'react'
import { type Task } from '@/stores/taskStore'

interface CoffeeBreakTimerProps {
  activeTask?: Task
}

export function CoffeeBreakTimer({ activeTask }: CoffeeBreakTimerProps) {
  const timeRemaining = useTimerStore((s) => s.timeRemaining)
  const isRunning = useTimerStore((s) => s.isRunning)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const reset = useTimerStore((s) => s.reset)
  
  const presets = [5, 10, 15]
  const [selectedMins, setSelectedMins] = useState(5)
  
  const setDuration = (mins: number) => {
    setSelectedMins(mins)
    useTimerStore.setState({ 
      timeRemaining: mins * 60,
      expectedEndTime: null,
      isRunning: false
    })
  }

  const fillProgress = Math.min(100, Math.max(0, 100 - (timeRemaining / (selectedMins * 60)) * 100))

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      {/* Animated Coffee Cup SVG */}
      <div className="relative w-72 h-72 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          {/* Steam Animation */}
          <AnimatePresence>
            {isRunning && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.path
                    key={i}
                    d={`M ${85 + i * 15} 60 Q ${90 + i * 15} 45 ${85 + i * 15} 30`}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    animate={{
                      d: [
                        `M ${85 + i * 15} 60 Q ${90 + i * 15} 45 ${85 + i * 15} 30`,
                        `M ${90 + i * 15} 60 Q ${85 + i * 15} 45 ${90 + i * 15} 30`,
                        `M ${85 + i * 15} 60 Q ${90 + i * 15} 45 ${85 + i * 15} 30`,
                      ],
                      opacity: [0.3, 0.7, 0.3],
                      y: [0, -15, 0],
                    }}
                    transition={{
                      duration: 2 + i,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </motion.g>
            )}
          </AnimatePresence>

          {/* Cup Body Outline */}
          <path
            d="M 50 80 L 150 80 L 140 160 Q 140 175 125 175 L 75 175 Q 60 175 60 160 L 50 80 Z"
            fill="rgba(255, 255, 255, 0.05)"
            stroke="currentColor"
            strokeWidth="5"
            className="text-primary/20"
          />
          
          {/* Handle */}
          <path
            d="M 150 100 Q 185 100 185 127.5 Q 185 155 150 155"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-primary/20"
          />

          {/* Liquid Fill */}
          <mask id="cup-mask">
            <path d="M 50 80 L 150 80 L 140 160 Q 140 175 125 175 L 75 175 Q 60 175 60 160 L 50 80 Z" fill="white" />
          </mask>
          
          <motion.rect
            x="40"
            y={175 - (fillProgress * 0.95)}
            width="120"
            height="110"
            fill="url(#coffee-gradient)"
            mask="url(#cup-mask)"
            animate={{
               y: isRunning ? [175 - (fillProgress * 0.95), 173 - (fillProgress * 0.95), 175 - (fillProgress * 0.95)] : 175 - (fillProgress * 0.95)
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          <defs>
            <linearGradient id="coffee-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6F4E37" />
              <stop offset="100%" stopColor="#2D1B13" />
            </linearGradient>
          </defs>
        </svg>

        {/* Floating Timer Text */}
        <div className="absolute inset-x-0 bottom-12 flex flex-col items-center justify-center">
           <div className="text-5xl font-bold tracking-tighter tabular-nums drop-shadow-xl text-white">
              {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
           </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mt-1">Coffee Break</div>
            
            {activeTask && (
              <div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] text-white/80 max-w-[180px]">
                <Link2 className="w-3 h-3 shrink-0" />
                <span className="truncate font-bold uppercase tracking-tight">{activeTask.title}</span>
              </div>
            )}
        </div>
      </div>

      {/* Preset Selectors & Stats */}
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="flex gap-2 w-full justify-center">
          {presets.map((p) => (
            <Button
              key={p}
              variant="outline"
              size="sm"
              className={`flex-1 rounded-xl h-11 transition-all border-border/50 ${
                selectedMins === p ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/20' : 'bg-background/40 hover:bg-muted'
              }`}
              onClick={() => setDuration(p)}
              disabled={isRunning}
            >
              <Coffee className="w-4 h-4 mr-2" />
              {p}m
            </Button>
          ))}
        </div>

        {/* Custom Coffee Mode Controls */}
        <div className="flex gap-4 items-center">
           <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-border/50" onClick={reset}>
             <RotateCcw className="w-5 h-5" />
           </Button>
           <Button 
            size="lg" 
            className="h-16 w-16 rounded-2xl shadow-xl shadow-primary/30"
            onClick={() => isRunning ? pause() : start()}
           >
             {isRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
           </Button>
        </div>
      </div>
    </div>
  )
}
