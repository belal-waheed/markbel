import { useState, useMemo } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { CheckCircle2, TrendingUp, Target, Clock, Trophy, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTaskStore } from '@/stores/taskStore'
import { useTimerStore } from '@/stores/timerStore'
import { useHabitStore } from '@/stores/habitStore'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
}
const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

export default function ReviewPage() {
  const [view, setView] = useState<'daily' | 'weekly'>('daily')
  const navigate = useNavigate()

  // Store queries
  const tasks = useTaskStore(s => s.tasks)
  const sessionHistory = useTimerStore(s => s.sessionHistory)
  const habits = useHabitStore(s => s.habits)

  // ─── DAILY STATS ───
  const todayDate = dayjs().format('YYYY-MM-DD')
  
  const dailyTasksCompleted = useMemo(() => {
    return tasks.filter(t => t.status === 'done' && t.completedAt?.startsWith(todayDate)).length
  }, [tasks, todayDate])

  const dailyFocusMinutes = useMemo(() => {
    return sessionHistory
      .filter(s => s.mode === 'focus' && s.completedAt.startsWith(todayDate))
      .reduce((acc, curr) => acc + curr.duration, 0) / 60
  }, [sessionHistory, todayDate])

  const dailyHabitsDone = useMemo(() => {
    return habits.filter(h => h.completedDates.includes(todayDate)).length
  }, [habits, todayDate])

  // ─── WEEKLY STATS ───
  const startOfWeek = dayjs().startOf('week')
  
  const weeklyTasksCompleted = useMemo(() => {
    return tasks.filter(t => t.status === 'done' && dayjs(t.completedAt).isAfter(startOfWeek)).length
  }, [tasks, startOfWeek])

  const weeklyFocusMinutes = useMemo(() => {
    return sessionHistory
      .filter(s => s.mode === 'focus' && dayjs(s.completedAt).isAfter(startOfWeek))
      .reduce((acc, curr) => acc + curr.duration, 0) / 60
  }, [sessionHistory, startOfWeek])

  const weeklyHabitCompletions = useMemo(() => {
    return habits.reduce((acc, curr) => {
      const completionsThisWeek = curr.completedDates.filter(d => dayjs(d).isAfter(startOfWeek)).length
      return acc + completionsThisWeek
    }, 0)
  }, [habits, startOfWeek])


  return (
    <div className="space-y-8 max-w-[1650px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute -left-4 top-0 bottom-0 w-1 bg-primary rounded-full"
            />
            <h1 className="text-4xl md:text-5xl font-black tracking-tight pb-2 leading-tight">
              Reflection
            </h1>
            <p className="text-muted-foreground font-medium">Review your progress and plan ahead.</p>
          </div>
        </div>
        
        {/* Toggle */}
        <div className="flex p-1 bg-muted/30 rounded-2xl border border-border/50 shrink-0 w-max">
          <button
            onClick={() => setView('daily')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              view === 'daily' ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              view === 'weekly' ? 'bg-background shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          variants={container}
          initial="hidden"
          animate="show"
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6"
        >
          {view === 'daily' ? (
            <>
              <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} title="Tasks Completed" value={dailyTasksCompleted.toString()} subtitle="Today" />
                <MetricCard icon={<Clock className="w-6 h-6 text-primary" />} title="Focus Time" value={`${Math.round(dailyFocusMinutes)}m`} subtitle="Today" />
                <MetricCard icon={<Target className="w-6 h-6 text-orange-500" />} title="Habits Crushed" value={dailyHabitsDone.toString()} subtitle="Today" />
              </motion.div>

              <motion.div variants={item}>
                <Card className="p-6 md:p-8 bg-card/40 backdrop-blur-xl border-primary/20 rounded-[2rem] overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Trophy className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Great job today! 🎉</h2>
                      <p className="text-muted-foreground leading-relaxed">
                        You&apos;ve made solid progress. Take a moment to write down any final thoughts or braindump tasks for tomorrow before signing off.
                      </p>
                    </div>
                    <Button onClick={() => navigate('/tasks')} className="rounded-xl font-bold shadow-lg shadow-primary/20 gap-2">
                      Plan Tomorrow <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </>
          ) : (
            <>
              <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />} title="Weekly Tasks" value={weeklyTasksCompleted.toString()} subtitle="This Week" />
                <MetricCard icon={<Clock className="w-6 h-6 text-primary" />} title="Weekly Focus" value={`${Math.round(weeklyFocusMinutes / 60)}h ${Math.round(weeklyFocusMinutes % 60)}m`} subtitle="This Week" />
                <MetricCard icon={<TrendingUp className="w-6 h-6 text-orange-500" />} title="Habit Actions" value={weeklyHabitCompletions.toString()} subtitle="This Week" />
              </motion.div>

              <motion.div variants={item}>
                <Card className="p-6 md:p-8 bg-linear-to-br from-primary/10 via-background to-background backdrop-blur-xl border-primary/30 rounded-[2rem] overflow-hidden relative">
                  <div className="relative z-10 max-w-xl space-y-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Weekly Review 📊</h2>
                      <p className="text-muted-foreground leading-relaxed">
                        A successful week is built on reflection. Did you accomplish your most important goals? Were there any bottlenecks?
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        "Review completed tasks and clear inbox",
                        "Review habit streaks and adjust goals",
                        "Plan top 3 priorities for next week",
                        "Clean up workspace and desktop"
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50 hover:border-primary/50 transition-colors">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function MetricCard({ icon, title, value, subtitle }: { icon: React.ReactNode, title: string, value: string, subtitle: string }) {
  return (
    <Card className="p-6 flex flex-col gap-4 rounded-3xl border-border/50 bg-card/40 hover:bg-card/60 transition-colors">
      <div className="flex items-center justify-between">
        <div className="p-3 bg-background rounded-2xl shadow-sm border border-border/50">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1 bg-muted/30 rounded-lg">
          {subtitle}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted-foreground mb-1">{title}</p>
        <p className="text-3xl font-black">{value}</p>
      </div>
    </Card>
  )
}
