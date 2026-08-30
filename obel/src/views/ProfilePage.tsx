import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Clock,
  CheckCircle2,
  CalendarDays,
  Target,
  Flame,
  TrendingUp,
  Trash2,
  Palette,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Bell,
  BellOff,
  BellRing,
  Star,
  Zap,
  Medal,
  Award,
  Crown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationSystem } from '@/lib/notifications'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuthStore } from '@/stores/authStore'
import { useTaskStore } from '@/stores/taskStore'
import { useTimerStore } from '@/stores/timerStore'
import { useThemeStore } from '@/stores/themeStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { BackupManager } from '@/components/profile/BackupManager'
import { getStorageStats, clearAllLocalData } from '@/lib/storage'
import { HardDrive, ShieldAlert, Cpu } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

dayjs.extend(relativeTime)

// Custom tooltips for charts (defined outside to avoid re-creation on render)
interface CustomBarTooltipProps {
  active?: boolean
  payload?: {
    value: number
    payload: {
      fullDate: string
    }
  }[]
}

const CustomBarTooltip = ({ active, payload }: CustomBarTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-popover text-popover-foreground border border-border p-3 rounded-lg shadow-xl">
        <p className="font-medium text-sm mb-1">{data.fullDate}</p>
        <p className="text-primary font-bold">{payload[0].value} minutes focused</p>
      </div>
    )
  }
  return null
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

const COLORS = {
  done: '#10b981', // emerald-500
  inProgress: '#3b82f6', // blue-500
  todo: '#64748b', // slate-500
}



export default function ProfilePage() {
  const isDark = useThemeStore((s) => s.isDark)
  const user = useAuthStore((s) => s.user)

  const tasks = useTaskStore((s) => s.tasks)
  const sessionHistory = useTimerStore((s) => s.sessionHistory)
  const sessionsCompleted = useTimerStore((s) => s.sessionsCompleted)
  const storedTotalFocusSeconds = useTimerStore((s) => s.totalFocusSeconds)
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)




  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  
  const [storageStats, setStorageStats] = useState<{
    lsBytes: number;
    idbAvailable: boolean;
    quota: number;
    usage: number;
    percentage: number;
  } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    getStorageStats().then(setStorageStats)
    if ('Notification' in window) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setNotificationPermission(Notification.permission)
    }
  }, [])

  const requestNotificationPermission = async () => {
    const granted = await notificationSystem.requestAndVerify()
    setNotificationPermission(granted ? 'granted' : 'denied')
    if (granted) {
      notificationSystem.send('Notifications Enabled!', {
        body: 'You will now receive reminders for your tasks and habits.',
      })
    }
  }

  const totalFocusHours = useMemo(() => {
    // Primary: use the persistent monotonic counter (never shrinks)
    if (storedTotalFocusSeconds > 0) {
      return storedTotalFocusSeconds / 3600
    }
    
    // Fallback for legacy users: max of task-level and history-level sums
    const taskFocusSeconds = tasks.reduce((acc, t) => acc + (t.focusTime || 0), 0)
    const sessionHistorySeconds = sessionHistory
      .filter((s) => s.mode === 'focus')
      .reduce((acc, s) => acc + s.duration, 0)
    return Math.max(taskFocusSeconds, sessionHistorySeconds) / 3600
  }, [storedTotalFocusSeconds, sessionHistory, tasks])


  // ---------------------------------------------------------
  // 1. Focus Time Analytics (Last 7 Days)
  // ---------------------------------------------------------
  const focusTimeChartData = useMemo(() => {
    const data = []
    // Go backwards 6 days to today, offset by weekOffset
    for (let i = 6; i >= 0; i--) {
      const targetDate = dayjs().subtract(i + weekOffset * 7, 'day').startOf('day')
      const targetDateString = targetDate.format('YYYY-MM-DD')
      
      // Sum durations (in seconds) for focus sessions on this day
      const dailySeconds = sessionHistory
        .filter(
          (s) =>
            s.mode === 'focus' &&
            dayjs(s.completedAt).format('YYYY-MM-DD') === targetDateString
        )
        .reduce((acc, s) => acc + s.duration, 0)

      data.push({
        name: targetDate.format('ddd'), // Short day name (e.g. 'Mon')
        minutes: Math.round(dailySeconds / 60),
        fullDate: targetDate.format('MMM D, YYYY'),
      })
    }
    return data
  }, [sessionHistory, weekOffset])

  // ---------------------------------------------------------
  // 2. Task Completion Analytics
  // ---------------------------------------------------------
  const { completedTasks, completionRate } = useMemo(() => {
    const completed = tasks.filter((t) => t.status === 'done').length
    const pending = tasks.length - completed
    const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
    return { completedTasks: completed, pendingTasks: pending, completionRate: rate }
  }, [tasks])

  const taskStatusData = [
    { name: 'Completed', value: completedTasks, color: COLORS.done },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length, color: COLORS.inProgress },
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: COLORS.todo },
  ].filter(d => d.value > 0)



  // ---------------------------------------------------------
  // 3. Fun Stats
  // ---------------------------------------------------------
  const mostProductiveDay = useMemo(() => {
    if (focusTimeChartData.length === 0) return 'N/A'
    const bestDay = [...focusTimeChartData].sort((a, b) => b.minutes - a.minutes)[0]
    return bestDay.minutes > 0 ? bestDay.name : 'N/A'
  }, [focusTimeChartData])


  const focusStreak = useMemo(() => {
    const focusDays = new Set(
      sessionHistory
        .filter((s) => s.mode === 'focus')
        .map((s) => dayjs(s.completedAt).startOf('day').format('YYYY-MM-DD'))
    )
    
    if (focusDays.size === 0) return 0

    let streak = 0
    let current = dayjs().startOf('day')
    
    // If no session today, check if there was one yesterday to keep the streak alive
    if (!focusDays.has(current.format('YYYY-MM-DD'))) {
      current = current.subtract(1, 'day')
    }

    while (focusDays.has(current.format('YYYY-MM-DD'))) {
      streak++
      current = current.subtract(1, 'day')
    }

    return streak
  }, [sessionHistory])

  const totalSessionsCompleted = useMemo(() => {
    const sessionsFromTasks = tasks.reduce((acc, t) => acc + (t.focusSessions || 0), 0)
    const sessionsFromHistory = sessionHistory.filter(s => s.mode === 'focus').length
    return Math.max(sessionsCompleted, sessionsFromTasks, sessionsFromHistory)
  }, [sessionsCompleted, tasks, sessionHistory])


  if (!user) return null

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 relative">
      
      
      {/* 1. Header Profile Section */}
      <div className="flex items-center gap-4 border-b border-border pb-6">
        <motion.div variants={item} className="flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-1">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-4 border-background ring-2 ring-primary/20">
            <User className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center sm:text-left flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-3xl font-bold tracking-tight">{user.name}</h1>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setShowLogoutConfirm(true)}
              className="gap-2 rounded-xl font-bold h-10 px-4 sm:w-auto w-full"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </Button>
          </div>
          <p className="text-muted-foreground">{user.email}</p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
            <Badge variant="secondary" className="gap-1.5 py-1">
              <CalendarDays className="w-3.5 h-3.5" />
              Joined {dayjs(user.createdAt).format('MMMM D, YYYY')}
            </Badge>
            <Badge variant="outline" className="gap-1.5 py-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
              <Target className="w-3.5 h-3.5" />
              {completedTasks} Tasks Completed
            </Badge>
          </div>
        </div>
      </motion.div>
    </div>

      {/* Premium XP & Level Section */}
      <motion.div variants={item} className="mb-6">
        <Card className="p-1 rounded-[2rem] bg-linear-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden relative group">
          <div className="absolute inset-0 bg-linear-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="p-5 flex flex-col sm:flex-row items-center gap-6 relative z-10">
            <div className="flex flex-col items-center justify-center shrink-0">
               <div className="relative flex items-center justify-center w-20 h-20">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                   <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted/30" strokeWidth="8" />
                   <circle cx="50" cy="50" r="45" fill="none" className="stroke-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.8)]" strokeWidth="8" strokeDasharray={`${((user?.xp || 0) % 1000) / 1000 * 283} 283`} strokeLinecap="round" />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black">{user?.level || 1}</span>
                 </div>
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-primary mt-2 flex items-center gap-1">
                 <Star className="w-3 h-3 fill-current" /> Level
               </span>
            </div>
            
            <div className="flex-1 w-full space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Current Experience
                  </h3>
                  <p className="text-sm text-muted-foreground">Keep completing tasks and habits to level up.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black">{user?.xp || 0}</span>
                  <span className="text-xs text-muted-foreground font-bold ml-1">XP</span>
                </div>
              </div>
              <div className="relative h-4 bg-muted/30 rounded-full overflow-hidden border border-border/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${((user?.xp || 0) % 1000) / 10}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="absolute top-0 left-0 h-full bg-linear-to-r from-primary to-primary/80 rounded-full" 
                />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InNoaW1tZXIiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBMMDAgMEw0MCAwTDQwIDQwWk0wIDQwTDQwIDBaIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI3NoaW1tZXIpIi8+PC9zdmc+')] opacity-20 pointer-events-none" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>{(user?.xp || 0) % 1000} XP in level {user?.level || 1}</span>
                <span>{1000 - ((user?.xp || 0) % 1000)} XP to Next</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* 2. Personalization (Theme Switcher) */}
      <motion.div variants={item} className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Personalization</h2>
          </div>
          
          {/* Light/Dark Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border/50">
            <button
              onClick={() => useThemeStore.getState().setIsDark(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                !isDark ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Light
            </button>
            <button
              onClick={() => useThemeStore.getState().setIsDark(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isDark ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3. Top-Level Stats */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Focus Hours', value: totalFocusHours.toFixed(1), icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Sessions Completed', value: totalSessionsCompleted, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Current Streak', value: `${focusStreak} Days`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Best Day', value: mostProductiveDay, icon: Trophy, color: 'text-red-500', bg: 'bg-red-500/10' },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* 4. Badges & Achievements */}
      <motion.div variants={item} className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Medal className="w-5 h-5 text-primary" />
          Achievements
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 border-primary/20 bg-primary/5">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Star className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm">First Steps</p>
              <p className="text-[10px] text-muted-foreground">Complete 1 task</p>
            </div>
          </Card>
          
          <Card className={`p-4 flex flex-col items-center justify-center text-center gap-2 ${user && user.level >= 5 ? 'border-yellow-500/20 bg-yellow-500/5' : 'opacity-50 grayscale'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${user && user.level >= 5 ? 'bg-yellow-500/20' : 'bg-muted/50'}`}>
              <Crown className={`w-6 h-6 ${user && user.level >= 5 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-bold text-sm">Rising Star</p>
              <p className="text-[10px] text-muted-foreground">Reach Level 5</p>
            </div>
          </Card>

          <Card className={`p-4 flex flex-col items-center justify-center text-center gap-2 ${focusStreak >= 3 ? 'border-orange-500/20 bg-orange-500/5' : 'opacity-50 grayscale'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${focusStreak >= 3 ? 'bg-orange-500/20' : 'bg-muted/50'}`}>
              <Flame className={`w-6 h-6 ${focusStreak >= 3 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-bold text-sm">On Fire</p>
              <p className="text-[10px] text-muted-foreground">3 Day Streak</p>
            </div>
          </Card>

          <Card className={`p-4 flex flex-col items-center justify-center text-center gap-2 ${totalFocusHours >= 10 ? 'border-emerald-500/20 bg-emerald-500/5' : 'opacity-50 grayscale'}`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${totalFocusHours >= 10 ? 'bg-emerald-500/20' : 'bg-muted/50'}`}>
              <Award className={`w-6 h-6 ${totalFocusHours >= 10 ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="font-bold text-sm">Deep Worker</p>
              <p className="text-[10px] text-muted-foreground">10 Hours Focus</p>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* 3. Deep Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Focus Chart */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="p-5 h-[350px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Focus Time {weekOffset === 0 ? '(Last 7 Days)' : `(${weekOffset} week${weekOffset > 1 ? 's' : ''} ago)`}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">Your daily productivity rhythm in minutes</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)} className="h-8 w-8 rounded-full text-muted-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="h-8 w-8 rounded-full text-muted-foreground">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 w-full -ml-4 min-h-0">
              <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                <BarChart data={focusTimeChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, className: 'fill-muted-foreground' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, className: 'fill-muted-foreground' }} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                  <Bar dataKey="minutes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Task Analytics */}
        <motion.div variants={item} className="lg:col-span-1 space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-lg mb-4">Task Completion</h3>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-bold text-emerald-500">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-3" />
            
            <div className="mt-6 flex justify-center h-[180px] min-h-0">
              {taskStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                  <PieChart>
                    <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No tasks yet</div>
              )}
            </div>
          </Card>
        </motion.div>



      </div>


      {/* 5. Notifications & Data Management */}
      <motion.div variants={item} className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border/50 bg-card/40 backdrop-blur-sm rounded-3xl">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </h3>
          <div className="space-y-4">
             <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/50">
              <div className="flex items-center gap-3">
                {notificationPermission === 'granted' ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-emerald-500" />
                  </div>
                ) : notificationPermission === 'denied' ? (
                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <BellOff className="w-5 h-5 text-destructive" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold">Status</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                    {notificationPermission === 'granted' ? 'Enabled' : notificationPermission === 'denied' ? 'Blocked' : 'Not Requested'}
                  </p>
                </div>
              </div>
              {notificationPermission !== 'granted' && (
                <Button 
                  size="sm" 
                  onClick={requestNotificationPermission}
                  className="rounded-xl font-bold h-9 px-4"
                >
                  Enable
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground px-1">
              Enabling notifications allows Obel to remind you of your scheduled tasks (like 8 PM reminders) and daily habits (like 7 AM habits).
            </p>

            {notificationPermission === 'granted' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => notificationSystem.send('Test Notification', { body: 'This is a test to verify everything is working!' })}
                className="w-full h-11 rounded-xl font-bold text-xs gap-2"
              >
                Send Test Notification
              </Button>
            )}
          </div>
        </Card>

        <BackupManager />
        
        <Card className="p-6 border-border/50 bg-card/40 backdrop-blur-sm rounded-3xl">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            System & Storage
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/50">
              <div className="flex items-center gap-3">
                <HardDrive className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-bold">Storage Engine</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">IndexedDB (High Performance)</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-black">
                ACTIVE
              </Badge>
            </div>

            {storageStats && (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold px-1">
                  <span className="text-muted-foreground uppercase tracking-widest">Disk Usage</span>
                  <span>{Math.round(storageStats.usage / 1024 / 1024)}MB / {Math.round(storageStats.quota / 1024 / 1024)}MB</span>
                </div>
                <Progress value={storageStats.percentage} className="h-2 bg-muted/30" />
                <p className="text-[10px] text-muted-foreground px-1 italic">
                  Note: Local storage (legacy) is being phased out in favor of IndexedDB.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button 
                variant="outline" 
                className="w-full h-11 rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive font-bold text-sm gap-2 transition-all"
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Wipe Local Database
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Wipe Confirmation Dialog */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md" 
              onClick={() => setShowClearConfirm(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <Card className="relative w-full max-w-[400px] p-8 rounded-3xl shadow-2xl border-destructive/20 bg-card overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
                <div className="flex flex-col items-center text-center gap-5">
                  <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mb-2">
                    <ShieldAlert className="w-10 h-10 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">Danger Zone</h3>
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                      This will <span className="text-destructive font-black underline decoration-2 underline-offset-4">permanently delete</span> all local tasks, notes, habits, and settings from this browser. This cannot be undone.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 w-full mt-4">
                    <Button 
                      variant="destructive" 
                      className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-destructive/20 uppercase tracking-widest"
                      onClick={() => clearAllLocalData()}
                    >
                      Delete Everything
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 rounded-2xl font-bold text-muted-foreground hover:text-foreground"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      Wait, keep my data
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>




      {/* ── Logout Confirmation Dialog ── */}
      <div className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${showLogoutConfirm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)} />
        <Card className={`relative w-full max-w-[380px] p-6 rounded-3xl shadow-2xl border-border bg-card transition-all duration-500 ${showLogoutConfirm ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
              <LogOut className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">Ready to leave?</h3>
              <p className="text-muted-foreground mt-2">
                Your data is safe on this device. You&apos;ll need to log in again to access cloud features.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-4">
              <Button 
                variant="outline" 
                className="flex-1 h-12 rounded-2xl font-bold"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1 h-12 rounded-2xl font-bold shadow-lg shadow-destructive/20"
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
              >
                Log Out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  )
}

