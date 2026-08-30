import { motion } from 'framer-motion'
import { Timer, Flame } from 'lucide-react'
import { useHabitStore } from '@/stores/habitStore'
import { useTimerStore } from '@/stores/timerStore'
import { useMemo } from 'react'
import dayjs from 'dayjs'

export function StatsRow() {
  const habits = useHabitStore((s) => s.habits)
  const sessionHistory = useTimerStore((s) => s.sessionHistory)

  const todayStr = dayjs().format('YYYY-MM-DD')

  const bestStreak = useMemo(() => {
    if (habits.length === 0) return 0
    return Math.max(...habits.map(h => h.currentStreak))
  }, [habits])

  const focusTimeToday = useMemo(() => {
    const todaySessions = sessionHistory.filter(s => 
      s.type === 'complete' && 
      s.mode === 'focus' && 
      dayjs(s.completedAt).format('YYYY-MM-DD') === todayStr
    )
    const totalSeconds = todaySessions.reduce((acc, s) => acc + s.duration, 0)
    return Math.round(totalSeconds / 60)
  }, [sessionHistory, todayStr])

  const stats = [
    {
      label: 'Focus Today',
      value: focusTimeToday > 0 ? `${focusTimeToday}m` : '0m',
      icon: <Timer className="w-5 h-5 text-primary" />,
      bg: 'bg-primary/10',
    },
    {
      label: 'Best Streak',
      value: `${bestStreak} 🔥`,
      icon: <Flame className="w-5 h-5 text-orange-500" />,
      bg: 'bg-orange-500/10',
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-4 rounded-[1.5rem] card-hover flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bg}`}>
              {stat.icon}
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground">{stat.value}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
