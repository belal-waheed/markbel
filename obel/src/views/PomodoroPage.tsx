import { useState, useMemo, useEffect, useCallback } from 'react'
import dayjs from 'dayjs'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Settings2,
  Timer,
  Coffee,
  Zap,
  Link2,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTimerStore, type TimerMode } from '@/stores/timerStore'
import { useCoffeeStore } from '@/stores/coffeeStore'
import { useTaskStore } from '@/stores/taskStore'

import { CoffeeBreakTimer } from '@/components/pomodoro/CoffeeBreakTimer'

const modeConfig: Record<TimerMode, { label: string; color: string; bgColor: string; icon: typeof Timer }> = {
  focus: { label: 'Focus Time', color: 'text-primary', bgColor: 'bg-primary/10', icon: Zap },
  shortBreak: { label: 'Short Break', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: Coffee },
  longBreak: { label: 'Long Break', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Coffee },
  coffeeBreak: { label: 'Coffee Break', color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: Coffee },
}

const focusPresets = [15, 20, 25, 30, 40, 45, 60]

export default function PomodoroPage() {
  const timeRemaining = useTimerStore((s) => s.timeRemaining)
  const isRunning = useTimerStore((s) => s.isRunning)
  const mode = useTimerStore((s) => s.mode)
  const settings = useTimerStore((s) => s.settings)
  const sessionHistory = useTimerStore((s) => s.sessionHistory)
  const activeTaskId = useTimerStore((s) => s.activeTaskId)
  const start = useTimerStore((s) => s.start)
  const pause = useTimerStore((s) => s.pause)
  const reset = useTimerStore((s) => s.reset)
  const skip = useTimerStore((s) => s.skip)
  const setMode = useTimerStore((s) => s.setMode)
  const updateSettings = useTimerStore((s) => s.updateSettings)
  const setActiveTaskId = useTimerStore((s) => s.setActiveTaskId)

  const tasks = useTaskStore((s) => s.tasks)
  const activeTasks = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'done')
    const selectedTask = tasks.find(t => t.id === activeTaskId)
    
    // Ensure selected task is always in the list even if done or from another list
    if (selectedTask && !active.find(t => t.id === activeTaskId)) {
      return [selectedTask, ...active]
    }
    return active
  }, [tasks, activeTaskId])
  const activeTask = useMemo(() => tasks.find((t) => t.id === activeTaskId), [tasks, activeTaskId])
  const getCupsToday = useCoffeeStore((s) => s.getCupsToday)

  const [showSettings, setShowSettings] = useState(false)
  const [localFocus, setLocalFocus] = useState(settings.focusDuration)
  const [localShortBreak, setLocalShortBreak] = useState(settings.shortBreakDuration)
  const [localLongBreak, setLocalLongBreak] = useState(settings.longBreakDuration)
  const [localInterval, setLocalInterval] = useState(settings.longBreakInterval)
  const [autoBreaks, setAutoBreaks] = useState(settings.autoStartBreaks)
  const [autoFocus, setAutoFocus] = useState(settings.autoStartFocus)
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled)
  const [notifsEnabled, setNotifsEnabled] = useState(settings.notificationsEnabled)
  const [energySaver, setEnergySaver] = useState(settings.energySaver)

  // Sync local state when store settings change (e.g. after loadFromUser)
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLocalFocus(settings.focusDuration)
    setLocalShortBreak(settings.shortBreakDuration)
    setLocalLongBreak(settings.longBreakDuration)
    setLocalInterval(settings.longBreakInterval)
    setAutoBreaks(settings.autoStartBreaks)
    setAutoFocus(settings.autoStartFocus)
    setSoundEnabled(settings.soundEnabled)
    setNotifsEnabled(settings.notificationsEnabled)
    setEnergySaver(settings.energySaver)
  }, [settings])

  const isFullscreen = useTimerStore((s) => s.isFullscreen)
  const setIsFullscreen = useTimerStore((s) => s.setIsFullscreen)

  // ESC to exit fullscreen (Desktop)
  const handleEscKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
  }, [isFullscreen, setIsFullscreen])

  useEffect(() => {
    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [handleEscKey])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const totalDuration =
    mode === 'focus'
      ? settings.focusDuration * 60
      : mode === 'shortBreak'
      ? settings.shortBreakDuration * 60
      : mode === 'coffeeBreak'
      ? 5 * 60 // Base for selector
      : settings.longBreakDuration * 60

  const progress = ((totalDuration - timeRemaining) / totalDuration) * 100
  const config = modeConfig[mode]
  const ModeIcon = config.icon

  const todaySessions = useMemo(() => {
    const today = new Date().toDateString()
    return sessionHistory.filter((s) => new Date(s.completedAt).toDateString() === today)
  }, [sessionHistory])

  const todayFocusMinutes = useMemo(
    () => Math.round(todaySessions.filter((s) => s.mode === 'focus').reduce((a, s) => a + s.duration, 0) / 60),
    [todaySessions]
  )

  const coffeeStats = useMemo(() => {
    const coffeeSessions = todaySessions.filter(s => s.mode === 'coffeeBreak')
    const cupsLogged = getCupsToday()
    return {
      count: Math.max(coffeeSessions.length, cupsLogged),
      minutes: Math.round(coffeeSessions.reduce((a, s) => a + s.duration, 0) / 60)
    }
  }, [todaySessions, getCupsToday])

  const handleSaveSettings = () => {
    updateSettings({
      focusDuration: localFocus,
      shortBreakDuration: localShortBreak,
      longBreakDuration: localLongBreak,
      longBreakInterval: localInterval,
      autoStartBreaks: autoBreaks,
      autoStartFocus: autoFocus,
      soundEnabled,
      notificationsEnabled: notifsEnabled,
      energySaver,
    })
    setShowSettings(false)
  }

  const openSettings = () => {
    setLocalFocus(settings.focusDuration)
    setLocalShortBreak(settings.shortBreakDuration)
    setLocalLongBreak(settings.longBreakDuration)
    setLocalInterval(settings.longBreakInterval)
    setAutoBreaks(settings.autoStartBreaks)
    setAutoFocus(settings.autoStartFocus)
    setSoundEnabled(settings.soundEnabled)
    setNotifsEnabled(settings.notificationsEnabled)
    setEnergySaver(settings.energySaver)
    setShowSettings(true)
  }

  const handleModeSwitch = (m: TimerMode) => {
    if (!isRunning) {
      setMode(m)
    }
  }

  const radius = 140
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="space-y-10 max-w-[1650px] mx-auto pb-24 px-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-2">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight bg-linear-to-br from-foreground via-foreground to-primary/40 bg-clip-text text-transparent leading-[1.1] pb-1">
              Timer
            </h1>
            <p className="text-muted-foreground mt-2 text-base sm:text-lg font-medium max-w-md">
              Work hard, recharge deep. Your productivity sanctuary.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 xl:gap-12 items-start">
        {/* Left Section (Timer display & Mode switcher) */}
        <div className="space-y-8 lg:sticky lg:top-8 bg-card/10 p-6 sm:p-8 rounded-[2.5rem] border border-border/20 backdrop-blur-xl">
          {/* Mode Selector Segmented Bar */}
          <div className="flex justify-center">
            <div className="bg-card/25 backdrop-blur-xl border border-border/30 p-1.5 rounded-full flex gap-1.5 shadow-md">
              {(['focus', 'coffeeBreak'] as TimerMode[]).map((m) => {
                const c = modeConfig[m]
                const Icon = c.icon
                const isActive = mode === m
                return (
                  <button
                    key={m}
                    onClick={() => handleModeSwitch(m)}
                    disabled={isRunning}
                    className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all relative active:scale-95 disabled:opacity-50 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {c.label}
                  </button>
                )
              })}
              {(mode === 'shortBreak' || mode === 'longBreak') && (
                <div className={`px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-border/25 ${modeConfig[mode].bgColor} ${modeConfig[mode].color}`}>
                  <Coffee className="w-4 h-4" />
                  {modeConfig[mode].label}
                </div>
              )}
            </div>
          </div>

          {mode === 'coffeeBreak' ? (
            <CoffeeBreakTimer activeTask={activeTask} />
          ) : (
            <div className="space-y-8">
              {/* Countdown Circular Ring */}
              <div className="flex justify-center relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[100px] bg-primary/10 pointer-events-none opacity-60" />
                
                <div className="relative w-[340px] h-[340px] flex items-center justify-center mx-auto">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 filter drop-shadow-[0_0_12px_rgba(235,94,40,0.15)]" viewBox="0 0 320 320">
                    <defs>
                      <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--primary, #eb5e28)" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                      <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    <circle cx="160" cy="160" r={radius} fill="none" stroke="currentColor" className="text-muted-foreground/10" strokeWidth="8" />
                    <motion.circle
                      cx="160" cy="160" r={radius} fill="none"
                      stroke={mode === 'focus' ? 'url(#focusGradient)' : 'url(#breakGradient)'}
                      strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      className={`p-3 rounded-2xl ${config.bgColor} border border-border/10 mb-4 shadow-sm`}
                      animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
                      transition={{ repeat: isRunning ? Infinity : 0, duration: 2 }}
                    >
                      <ModeIcon className={`w-6 h-6 ${config.color}`} />
                    </motion.div>
                    <div className="text-7xl font-extrabold tracking-tighter tabular-nums text-foreground leading-none">
                      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.25em] mt-4 opacity-70 ${config.color}`}>{config.label}</p>
                  </div>
                </div>
              </div>

              {/* Control Tray Buttons */}
              <div className="flex justify-center items-center gap-3.5 mt-4">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl bg-card/25 border-border/30 hover:bg-card/45 hover:border-primary/20 hover:scale-105 active:scale-95 transition-all shadow-none" 
                  onClick={reset} 
                  title="Reset"
                >
                  <RotateCcw className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button 
                  size="lg" 
                  className="h-16 w-16 rounded-[1.25rem] bg-primary text-primary-foreground shadow-xl shadow-primary/25 hover:scale-105 hover:bg-primary/95 active:scale-95 transition-all border-none" 
                  onClick={() => {
                    if (isRunning) {
                      import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playPause());
                      pause();
                    } else {
                      import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playStart());
                      start();
                    }
                  }}
                >
                  {isRunning ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 ml-1 fill-current" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl bg-card/25 border-border/30 hover:bg-card/45 hover:border-primary/20 hover:scale-105 active:scale-95 transition-all shadow-none" 
                  onClick={skip} 
                  title="Skip"
                >
                  <SkipForward className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl bg-card/25 border-border/30 hover:bg-card/45 hover:border-primary/20 hover:scale-105 active:scale-95 transition-all shadow-none" 
                  onClick={openSettings} 
                  title="Settings"
                >
                  <Settings2 className="w-5 h-5 text-muted-foreground" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-12 w-12 rounded-xl bg-card/25 border-border/30 hover:bg-card/45 hover:border-primary/20 hover:scale-105 active:scale-95 transition-all shadow-none" 
                  onClick={() => setIsFullscreen(true)} 
                  title="Fullscreen"
                >
                  <Maximize2 className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Section (Tasks, Stats, Completed Sessions Log) */}
        <div className="space-y-8">
          {/* Focus Task Card Panel */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {!activeTaskId ? (
                <motion.div
                  key="select-task"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground/50">Focus Task</p>
                  <Select value="none" onValueChange={(v) => setActiveTaskId(v === 'none' ? null : v)}>
                    <SelectTrigger className="w-full h-12 bg-card/25 border-border/30 shadow-none rounded-[1.5rem] backdrop-blur-xl hover:bg-card/40 hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Link2 className="w-4 h-4 text-primary" />
                        </div>
                        <SelectValue placeholder="Link a task to this session..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-2xl border-border/40 rounded-2xl">
                      <SelectItem value="none" className="text-muted-foreground font-bold">Standalone Session</SelectItem>
                      {activeTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id} className="py-3 rounded-xl font-bold">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{task.title}</span>
                              {task.listId && task.listId !== 'imp' && task.listId !== 'fast' && task.listId !== 'later' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black uppercase tracking-tighter">
                                  {tasks.find(t => t.id === task.id)?.listId ? useTaskStore.getState().lists.find(l => l.id === task.listId)?.title : ''}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{task.focusSessions || 0} sessions completed</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              ) : (
                <motion.div
                  key="active-task-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative p-5 rounded-[2rem] bg-card/25 border border-primary/20 backdrop-blur-xl overflow-hidden group shadow-lg"
                >
                  <div className="absolute top-0 right-0 p-4 relative z-20">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200"
                      onClick={() => setActiveTaskId(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-[9px] uppercase tracking-widest font-black text-primary">Focusing On</p>
                        {activeTask?.listId && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary font-black border border-primary/20">
                            {useTaskStore.getState().lists.find(l => l.id === activeTask.listId)?.title}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold tracking-tight truncate mb-3 text-foreground">{activeTask?.title}</h3>
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-1.5 rounded-xl bg-background/25 border border-border/20 flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground leading-none mb-1">Sessions</span>
                          <span className="text-xs font-black tabular-nums">{activeTask?.focusSessions || 0}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-background/25 border border-border/20 flex flex-col">
                          <span className="text-[9px] uppercase font-bold text-muted-foreground leading-none mb-1">Status</span>
                          <span className="text-xs font-bold text-primary capitalize">{activeTask?.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Focus / Rest Metrics Cards */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <Card className="p-5 text-center bg-card/25 backdrop-blur-xl border border-border/30 rounded-[2rem] relative overflow-hidden group shadow-sm">
              <p className="text-3xl font-black tracking-tight text-foreground leading-none">{todayFocusMinutes}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground mt-2">Mins Focused Today</p>
            </Card>
            <Card className="p-5 text-center bg-card/25 backdrop-blur-xl border border-border/30 rounded-[2rem] relative overflow-hidden group shadow-sm">
              <p className="text-3xl font-black tracking-tight text-orange-500 leading-none">{coffeeStats.count}</p>
              <p className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground mt-2">No. of Coffees</p>
            </Card>
          </div>

          {/* Today's Completed Sessions Log */}
          {todaySessions.length > 0 && (
            <Card className="p-6 w-full bg-card/25 backdrop-blur-xl border border-border/30 rounded-[2rem] shadow-sm">
              <h3 className="font-extrabold text-base tracking-tight text-foreground mb-4">Today&apos;s Sessions</h3>
              <div className="space-y-2.5">
                {todaySessions.filter(s => s.type === 'complete').slice(0, 8).map((session, idx) => {
                  const sc = modeConfig[session.mode]
                  const Ic = sc.icon
                  const sessionTask = session.taskId ? tasks.find(t => t.id === session.taskId) : null
                  const endTime = dayjs(session.completedAt)
                  const startTime = endTime.subtract(session.duration, 'second')
                  
                  return (
                    <div key={`${session.completedAt}-${idx}`} className="flex items-center gap-4 p-4 rounded-2xl bg-background/25 border border-border/20 hover:border-primary/20 transition-all duration-200">
                      <div className={`p-2.5 rounded-xl ${sc.bgColor} border border-border/10 shadow-sm`}><Ic className={`w-4 h-4 ${sc.color}`} /></div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground tracking-tight">{sc.label}</span>
                          <span className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                            {Math.round(session.duration / 60)} min
                          </span>
                        </div>
                        {sessionTask && (
                          <span className="text-xs font-bold text-muted-foreground/80 truncate mt-1">
                            {sessionTask.title}
                          </span>
                        )}
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none">Start</span>
                            <span className="text-[10px] font-bold text-foreground mt-0.5">{startTime.format('hh:mm A')}</span>
                          </div>
                          <div className="w-4 h-px bg-border/30 mt-2" />
                          <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none">End</span>
                            <span className="text-[10px] font-bold text-foreground mt-0.5">{endTime.format('hh:mm A')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Settings Panel Console Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border border-border/40 bg-card/45 backdrop-blur-3xl rounded-[2.5rem] outline-none shadow-2xl z-[100] max-h-[90dvh] sm:max-h-[85vh] flex flex-col">
          <div className="px-6 py-6 sm:px-8 border-b border-border/20 bg-card/10 shrink-0 relative">
            <div className="absolute top-0 left-1/4 right-1/4 h-24 bg-primary/5 blur-3xl rounded-full -translate-y-1/2 pointer-events-none" />
            <DialogTitle className="text-2xl font-black tracking-tight leading-tight mt-5">Timer Settings</DialogTitle>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Focus Preset</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {focusPresets.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLocalFocus(m)}
                    className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border active:scale-95 ${
                      localFocus === m
                        ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'border-border/30 bg-background/25 text-muted-foreground hover:bg-background/50'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <Input 
                type="number" 
                min={1} 
                max={120} 
                value={localFocus} 
                onChange={(e) => setLocalFocus(Number(e.target.value))} 
                className="h-12 bg-background/25 border-border/30 rounded-xl text-sm font-bold focus-visible:ring-primary/30 w-full shadow-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Short Break (mins)</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={30} 
                  value={localShortBreak} 
                  onChange={(e) => setLocalShortBreak(Number(e.target.value))} 
                  className="h-12 bg-background/25 border-border/30 rounded-xl text-sm font-bold focus-visible:ring-primary/30 w-full shadow-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Long Break (mins)</label>
                <Input 
                  type="number" 
                  min={1} 
                  max={60} 
                  value={localLongBreak} 
                  onChange={(e) => setLocalLongBreak(Number(e.target.value))} 
                  className="h-12 bg-background/25 border-border/30 rounded-xl text-sm font-bold focus-visible:ring-primary/30 w-full shadow-none"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Long Break After (sessions)</label>
              <Input 
                type="number" 
                min={2} 
                max={10} 
                value={localInterval} 
                onChange={(e) => setLocalInterval(Number(e.target.value))} 
                className="h-12 bg-background/25 border-border/30 rounded-xl text-sm font-bold focus-visible:ring-primary/30 w-full shadow-none"
              />
            </div>
            
            <div className="space-y-4 pt-2 border-t border-border/20">
              {[
                { label: 'Auto-start breaks', checked: autoBreaks, onChange: setAutoBreaks },
                { label: 'Auto-start focus sessions', checked: autoFocus, onChange: setAutoFocus },
                { label: 'Enable timer chime', checked: soundEnabled, onChange: setSoundEnabled },
                { label: 'Enable browser notifications', checked: notifsEnabled, onChange: setNotifsEnabled },
              ].map((toggle) => (
                <label key={toggle.label} className="flex items-center justify-between text-sm font-bold text-foreground cursor-pointer group">
                  <span className="text-xs uppercase tracking-wider font-black text-muted-foreground group-hover:text-foreground transition-colors">{toggle.label}</span>
                  <input 
                    type="checkbox" 
                    checked={toggle.checked} 
                    onChange={(e) => toggle.onChange(e.target.checked)} 
                    className="w-5 h-5 rounded-md border-muted-foreground/30 text-primary focus:ring-primary/20 accent-primary" 
                  />
                </label>
              ))}
              
              <label className="flex items-center justify-between text-sm font-bold text-foreground cursor-pointer group border-t border-border/10 pt-4">
                <span className="text-xs uppercase tracking-wider font-black text-primary">Energy Saver Mode</span>
                <input 
                  type="checkbox" 
                  checked={energySaver} 
                  onChange={(e) => setEnergySaver(e.target.checked)} 
                  className="w-5 h-5 rounded-md border-muted-foreground/30 text-primary focus:ring-primary/20 accent-primary" 
                />
              </label>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs font-black uppercase tracking-wider h-11 border-dashed border-border/30 hover:border-primary/30 mt-2 bg-transparent rounded-2xl"
                onClick={async () => {
                  const { soundSystem } = await import('@/lib/sounds')
                  soundSystem.playChime()
                }}
              >
                Test Chime & Init Audio
              </Button>
            </div>
          </div>
          <div className="px-6 py-5 sm:px-8 border-t border-border/20 bg-card/10 flex justify-end gap-3 shrink-0">
            <Button variant="outline" className="h-12 px-6 rounded-xl font-bold border-border/30 text-sm hover:bg-muted/80" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button className="h-12 px-8 rounded-xl font-black text-sm gap-2 bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/25 active:scale-95 transition-all border-none" onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Mode */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden select-none w-screen h-screen"
            style={{ background: '#000000' }}
          >
            {(!settings.energySaver) && (
              <div className="absolute inset-0 overflow-hidden opacity-50">
                <motion.div
                  className={`absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 ${
                    mode === 'focus' ? 'bg-purple-600' : mode === 'coffeeBreak' ? 'bg-orange-600' : 'bg-emerald-600'
                  }`}
                  animate={{
                    x: ['-10%', '10%', '-10%'],
                    y: ['-5%', '15%', '-5%'],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ top: '10%', left: '20%' }}
                />
                <motion.div
                  className={`absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-15 ${
                    mode === 'focus' ? 'bg-blue-600' : mode === 'coffeeBreak' ? 'bg-amber-500' : 'bg-teal-500'
                  }`}
                  animate={{
                    x: ['10%', '-10%', '10%'],
                    y: ['10%', '-10%', '10%'],
                    scale: [1.1, 0.9, 1.1],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ bottom: '10%', right: '15%' }}
                />
              </div>
            )}

            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-8 right-8 z-10 p-4 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
 
            {activeTask && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-12 left-1/2 -translate-x-1/2 z-10 max-w-[80vw]"
              >
                <span className="text-sm font-black text-white/30 uppercase tracking-[0.4em] text-center block">
                  {activeTask.title}
                </span>
              </motion.div>
            )}

            <div className="relative z-10 flex flex-col items-center justify-center gap-6">
              <div className="relative flex flex-col items-center justify-center">
                <motion.div
                  className="text-8xl md:text-9xl lg:text-[16rem] font-black tracking-tighter tabular-nums text-white"
                  animate={{ opacity: isRunning ? 1 : [1, 0.5, 1] }}
                  transition={{ repeat: isRunning ? 0 : Infinity, duration: 1.5 }}
                >
                  {String(minutes).padStart(2, '0')}
                  <span className="text-white/30">:</span>
                  {String(seconds).padStart(2, '0')}
                </motion.div>

                <p className={`text-sm lg:text-xl font-bold uppercase tracking-[0.5em] mt-8 ${
                  mode === 'focus' ? 'text-purple-400/50' : mode === 'coffeeBreak' ? 'text-orange-400/50' : 'text-emerald-400/50'
                }`}>
                  {config.label}
                </p>
              </div>

              <button
                onClick={() => {
                  if (isRunning) {
                    import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playPause());
                    pause();
                  } else {
                    import('@/lib/sounds').then(({ soundSystem }) => soundSystem.playStart());
                    start();
                  }
                }}
                className="mt-12 p-6 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              >
                {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
