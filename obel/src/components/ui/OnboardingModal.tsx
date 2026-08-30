import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  X,
  Target,
  Sparkles,
  Timer,
  FileText,
  Trophy
} from 'lucide-react'
import { Button } from './button'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { useTimerStore } from '@/stores/timerStore'
import { useNoteStore } from '@/stores/noteStore'
import { useNavigate } from 'react-router-dom'
import { haptics } from '@/lib/haptics'
import confetti from 'canvas-confetti'

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('obel_onboarding_dismissed') === 'true')
  const navigate = useNavigate()

  const tasks = useTaskStore(s => s.tasks)
  const habits = useHabitStore(s => s.habits)
  const sessions = useTimerStore(s => s.sessionHistory)
  const notes = useNoteStore(s => s.notes)

  const hasTask = tasks.length > 0
  const hasHabit = habits.length > 0
  const hasFocus = sessions.some(s => s.mode === 'focus')
  const hasNote = notes.length > 0

  const totalCompleted = [hasTask, hasHabit, hasFocus, hasNote].filter(Boolean).length
  const isAllComplete = totalCompleted === 4

  const handleDismiss = () => {
    setIsOpen(false)
    setDismissed(true)
    localStorage.setItem('obel_onboarding_dismissed', 'true')
  }

  useEffect(() => {
    // Show modal if not all complete and not dismissed
    if (!isAllComplete && !dismissed) {
      // Delay showing the modal slightly to let the page load
      const timer = setTimeout(() => setIsOpen(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [isAllComplete, dismissed])

  useEffect(() => {
    if (isAllComplete && isOpen) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#3b82f6', '#10b981', '#f97316']
      })
      haptics.success()
      // Auto close after a bit
      const timer = setTimeout(() => handleDismiss(), 3000)
      return () => clearTimeout(timer)
    }
  }, [isAllComplete, isOpen])

  const steps = [
    {
      id: 'task',
      title: 'Create a Task',
      description: 'Add your first to-do item to start organizing your day.',
      icon: <Target className="w-5 h-5 text-blue-500" />,
      done: hasTask,
      path: '/tasks'
    },
    {
      id: 'habit',
      title: 'Start a Habit',
      description: 'Forge a new daily routine to build momentum.',
      icon: <Sparkles className="w-5 h-5 text-orange-500" />,
      done: hasHabit,
      path: '/habits'
    },
    {
      id: 'focus',
      title: 'Complete a Focus Session',
      description: 'Run the Pomodoro timer and stay focused.',
      icon: <Timer className="w-5 h-5 text-primary" />,
      done: hasFocus,
      path: '/pomodoro'
    },
    {
      id: 'note',
      title: 'Write a Note',
      description: 'Capture your thoughts in your personal vault.',
      icon: <FileText className="w-5 h-5 text-emerald-500" />,
      done: hasNote,
      path: '/notes'
    }
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={handleDismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-card/95 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl overflow-hidden premium-shadow"
          >
            {isAllComplete && (
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-emerald-400 to-primary" />
            )}
            
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">Welcome to Obel</h2>
                    <p className="text-sm font-medium text-muted-foreground mt-0.5">Let&apos;s get you set up ({totalCompleted}/4)</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-8 w-8 -mr-2 -mt-2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => {
                      if (!step.done) {
                        setIsOpen(false)
                        navigate(step.path)
                      }
                    }}
                    className={`flex items-start gap-4 p-3 rounded-2xl border transition-all ${
                      step.done 
                        ? 'bg-muted/30 border-transparent opacity-60'
                        : 'bg-background/50 border-border/50 hover:bg-muted/50 hover:border-primary/30 cursor-pointer'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {step.done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/30" />
                      )}
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {step.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {step.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {isAllComplete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center"
                >
                  <p className="text-emerald-500 font-bold text-sm">
                    You&apos;re all set! Enjoy using Obel.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
