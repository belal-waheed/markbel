import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Dot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskStore, type Task } from '@/stores/taskStore'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'

interface CalendarGridProps {
  currentDate: dayjs.Dayjs
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onTaskClick: (taskId: string) => void
}

const WEEKDAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function TaskPill({ task, onClick }: { task: Task; onClick: () => void }) {
  const isDone = task.status === 'done'
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex flex-col text-left text-[10px] font-semibold px-2.5 py-1.5 rounded-lg
        truncate transition-all duration-150 active:scale-95
        ${isDone
          ? 'bg-muted/10 text-muted-foreground/50 line-through border border-border/30'
          : 'bg-primary/10 text-foreground/90 hover:bg-primary/15 border border-primary/20 shadow-sm'
        }
      `}
    >
      <span className="truncate w-full">{task.title}</span>
      {task.tags && task.tags.length > 0 && (
         <span className="text-[8px] font-bold text-primary uppercase tracking-widest mt-0.5 truncate w-full">
           {task.tags[0]}
         </span>
      )}
    </button>
  )
}

// ── Desktop day cell ───────────────────────────────────────────────────────
function DayCell({
  day, tasks, isToday, isWeekend, onTaskClick,
}: {
  day: dayjs.Dayjs
  tasks: Task[]
  isToday: boolean
  isWeekend: boolean
  onTaskClick: (id: string) => void
}) {
  const isPast   = day.isBefore(dayjs(), 'day') && !isToday
  const visible  = tasks.slice(0, 3)
  const overflow = tasks.length - visible.length

  return (
    <div className={`
      relative flex flex-col gap-1.5 p-2.5 min-h-[160px]
      border-r border-b border-border/30 last:border-r-0
      transition-colors duration-150
      ${isWeekend ? 'bg-muted/10' : 'bg-transparent'}
      ${isPast    ? 'opacity-40'  : ''}
      hover:bg-muted/20
    `}>
      {/* Day number */}
      <div className="flex items-center justify-between mb-0.5">
        <div className={`
          w-7 h-7 flex items-center justify-center rounded-full
          text-xs font-black transition-all
          ${isToday
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-4 ring-primary/20'
            : 'text-foreground/60'
          }
        `}>
          {day.date()}
        </div>
        {tasks.length > 0 && !isToday && (
          <span className="text-[9px] font-bold text-muted-foreground/50 tabular-nums">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-1 flex-1">
        <AnimatePresence initial={false}>
          {visible.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.03, duration: 0.15 }}
            >
              <TaskPill task={task} onClick={() => onTaskClick(task.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {overflow > 0 && (
        <span className="text-[9px] font-bold text-muted-foreground/50 pl-1">
          +{overflow} more
        </span>
      )}

      {tasks.length === 0 && !isPast && (
        <div className="hidden sm:flex flex-1 items-center justify-center">
          <Dot className="w-4 h-4 text-border/40" />
        </div>
      )}
    </div>
  )
}

// ── Mobile: full-width task row ────────────────────────────────────────────
function MobileTaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const isDone = task.status === 'done'
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={`
        w-full flex items-center gap-3 p-4 rounded-2xl border text-left
        transition-all duration-150 active:scale-[0.98]
        ${isDone
          ? 'bg-muted/10 border-border/30 opacity-50'
          : 'bg-card border-border/40 hover:border-primary/30 hover:bg-primary/5 shadow-sm'
        }
      `}
    >
      <div className="shrink-0 mt-0.5">
        {isDone
          ? <CheckCircle2 className="w-5 h-5 text-muted-foreground/50" />
          : <Circle className="w-5 h-5 text-primary/60" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-snug truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
      </div>
      <div className={`
        shrink-0 w-2 h-2 rounded-full
        ${isDone ? 'bg-border' : 'bg-primary'}
      `} />
    </motion.button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function CalendarGrid({
  currentDate,
  onPrevWeek,
  onNextWeek,
  onToday,
  onTaskClick,
}: CalendarGridProps) {
  const tasks = useTaskStore((s) => s.tasks)

  // Mobile: track which day is selected in the strip
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>(
    dayjs().format('YYYY-MM-DD')
  )

  const daysInWeek = useMemo(() => {
    const start = currentDate.startOf('week')
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  }, [currentDate])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const key = dayjs(task.dueDate).format('YYYY-MM-DD')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [tasks])

  const weekLabel = useMemo(() => {
    const s = currentDate.startOf('week')
    const e = currentDate.endOf('week')
    return s.month() === e.month()
      ? `${s.format('MMM D')} – ${e.format('D, YYYY')}`
      : `${s.format('MMM D')} – ${e.format('MMM D, YYYY')}`
  }, [currentDate])

  const isCurrentWeek = currentDate.isSame(dayjs(), 'week')

  const handlePrevWeek = useCallback(() => {
    onPrevWeek()
    // Shift selected day back a week too
    setMobileSelectedDay((prev) =>
      dayjs(prev).subtract(1, 'week').format('YYYY-MM-DD')
    )
  }, [onPrevWeek])

  const handleNextWeek = useCallback(() => {
    onNextWeek()
    setMobileSelectedDay((prev) =>
      dayjs(prev).add(1, 'week').format('YYYY-MM-DD')
    )
  }, [onNextWeek])

  const handleToday = useCallback(() => {
    onToday()
    setMobileSelectedDay(dayjs().format('YYYY-MM-DD'))
  }, [onToday])

  const selectedDayTasks  = tasksByDay.get(mobileSelectedDay) ?? []
  const selectedDayObj    = dayjs(mobileSelectedDay)

  return (
    <div className="rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl shadow-xl overflow-hidden">

      {/* ── Shared header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-background/40">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black tracking-tight text-foreground tabular-nums">
            {weekLabel}
          </h2>
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-0.5">
            <Button
              variant="ghost" size="icon"
              onClick={handlePrevWeek}
              className="h-7 w-7 rounded-lg hover:bg-background/80"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={handleNextWeek}
              className="h-7 w-7 rounded-lg hover:bg-background/80"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={handleToday}
          disabled={isCurrentWeek}
          className="h-8 px-4 rounded-xl text-xs font-bold border-border/50 disabled:opacity-30"
        >
          Today
        </Button>
      </div>

      {/* ════════════════════════════════════════════
          MOBILE LAYOUT  (hidden on sm+)
      ════════════════════════════════════════════ */}
      <div className="sm:hidden">

        {/* Day strip */}
        <div className="flex border-b border-border/30 bg-muted/10 px-2 py-2 gap-1 overflow-x-auto no-scrollbar">
          {daysInWeek.map((day) => {
            const key      = day.format('YYYY-MM-DD')
            const isToday  = day.isSame(dayjs(), 'day')
            const isActive = key === mobileSelectedDay
            const count    = tasksByDay.get(key)?.length ?? 0

            return (
              <button
                key={key}
                onClick={() => setMobileSelectedDay(key)}
                className={`
                  flex-1 min-w-[42px] flex flex-col items-center py-2.5 px-1
                  rounded-2xl transition-all duration-150 active:scale-95 shrink-0
                  ${isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                    : isToday
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/60 hover:bg-muted/30'
                  }
                `}
              >
                <span className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ${isActive ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {WEEKDAYS[day.day()]}
                </span>
                <span className="text-base font-black leading-none">
                  {day.date()}
                </span>
                {/* Task count dot */}
                <div className="mt-1.5 h-1">
                  {count > 0 && (
                    <div className={`
                      w-1 h-1 rounded-full mx-auto
                      ${isActive ? 'bg-primary-foreground/60' : 'bg-primary'}
                    `} />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected day task list */}
        <div className="p-4 min-h-[240px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-foreground">
                {selectedDayObj.format('dddd')}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                {selectedDayObj.format('MMMM D, YYYY')}
              </p>
            </div>
            {selectedDayTasks.length > 0 && (
              <span className="text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {selectedDayTasks.filter(t => t.status === 'done').length}/{selectedDayTasks.length} done
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {selectedDayTasks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-2"
              >
                <div className="w-10 h-10 rounded-2xl bg-muted/40 border border-border/30 flex items-center justify-center">
                  <Dot className="w-5 h-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">No tasks for this day</p>
              </motion.div>
            ) : (
              <motion.div
                key={mobileSelectedDay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-2"
              >
                {selectedDayTasks.map((task) => (
                  <MobileTaskRow
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task.id)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          DESKTOP LAYOUT  (hidden on mobile)
      ════════════════════════════════════════════ */}
      <div className="hidden sm:block">

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-border/30 bg-muted/10">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`
                py-2.5 text-center text-[9px] font-black uppercase tracking-widest
                ${i === 0 || i === 6 ? 'text-muted-foreground/40' : 'text-muted-foreground/70'}
              `}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {daysInWeek.map((day) => (
            <DayCell
              key={day.format('YYYY-MM-DD')}
              day={day}
              tasks={tasksByDay.get(day.format('YYYY-MM-DD')) ?? []}
              isToday={day.isSame(dayjs(), 'day')}
              isWeekend={day.day() === 0 || day.day() === 6}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>

    </div>
  )
}