// CalendarPage.tsx
import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { TaskDetailsModal } from '@/components/tasks/TaskDetailsModal'
import { TaskFormModal } from '@/components/tasks/TaskFormModal'
import { useTaskStore, type Task } from '@/stores/taskStore'
import { useTimerStore } from '@/stores/timerStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'

const PAGE_TRANSITION = {
  initial:    { opacity: 0, y: 12 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: 'easeOut' } as const,
}

export default function CalendarPage() {
  const navigate        = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tasks           = useTaskStore((s) => s.tasks)
  const fetchTasks      = useTaskStore((s) => s.fetchTasks)
  const setActiveTaskId = useTimerStore((s) => s.setActiveTaskId)



  const [currentDate,     setCurrentDate]     = useState(dayjs)
  
  // Use URL search params for task selection
  const selectedTaskId = searchParams.get('taskId')
  const setSelectedTaskId = useCallback((id: string | null) => {
    if (id) {
      setSearchParams({ taskId: id })
    } else {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('taskId')
      setSearchParams(nextParams)
    }
  }, [searchParams, setSearchParams])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingTask,     setEditingTask]     = useState<Task | null>(null)

  // ── Week stats (header badges) ────────────────────────────────────────────
  const weekStats = useMemo(() => {
    const start = currentDate.startOf('week')
    const end   = currentDate.endOf('week')
    const weekTasks = tasks.filter((t) => {
      if (!t.dueDate) return false
      const d = dayjs(t.dueDate)
      return (d.isAfter(start, 'day') || d.isSame(start, 'day')) &&
             (d.isBefore(end, 'day')  || d.isSame(end, 'day'))
    })
    return {
      total:  weekTasks.length,
      done:   weekTasks.filter((t) => t.status === 'done').length,
      high:   weekTasks.filter((t) => t.listId === 'imp' && t.status !== 'done').length,
    }
  }, [tasks, currentDate])

  // ── Navigation ────────────────────────────────────────────────────────────
  const handlePrevWeek = useCallback(() => setCurrentDate((d) => d.subtract(1, 'week')), [])
  const handleNextWeek = useCallback(() => setCurrentDate((d) => d.add(1, 'week')), [])
  const handleToday    = useCallback(() => setCurrentDate(dayjs()), [])

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectedTask = useMemo(
    () => (selectedTaskId ? (tasks.find((t) => t.id === selectedTaskId) ?? null) : null),
    [tasks, selectedTaskId],
  )

  const handleTaskClick    = useCallback((id: string)  => setSelectedTaskId(id),   [setSelectedTaskId])
  const handleDetailsClose = useCallback(()            => setSelectedTaskId(null), [setSelectedTaskId])

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task)
    setIsEditModalOpen(true)
  }, [])

  const handleEditClose = useCallback(() => {
    setIsEditModalOpen(false)
    setEditingTask(null)
  }, [])

  // ── Focus ─────────────────────────────────────────────────────────────────
  const handleStartFocus = useCallback((taskId: string) => {
    setActiveTaskId(taskId)
    navigate('/pomodoro')
  }, [navigate, setActiveTaskId])

  return (
    <motion.div className="space-y-5" {...PAGE_TRANSITION}>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground leading-none">
                Calendar
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium">
                Strategic mapping of your deadlines and tasks.
              </p>
            </div>
          </div>
        </div>

        {/* Week stats */}
        {weekStats.total > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Stat label="This week"   value={weekStats.total} />
            <Stat label="Completed"   value={weekStats.done}  dim />
            {weekStats.high > 0 && (
              <Stat label="High priority" value={weekStats.high} danger />
            )}
          </div>
        )}
      </div>

      {/* ── Calendar ── */}
      <CalendarGrid
        currentDate={currentDate}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onTaskClick={handleTaskClick}
      />

      {/* ── Modals ── */}
      <TaskDetailsModal
        task={selectedTask}
        onClose={handleDetailsClose}
        onEdit={handleEdit}
        onStartFocus={handleStartFocus}
      />
      <TaskFormModal
        isOpen={isEditModalOpen}
        onClose={handleEditClose}
        editingTask={editingTask}
      />
    </motion.div>
  )
}

// ── Inline stat badge ─────────────────────────────────────────────────────────
function Stat({
  label, value, dim, danger,
}: {
  label: string
  value: number
  dim?: boolean
  danger?: boolean
}) {
  return (
    <div className={`
      flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold
      ${danger ? 'bg-red-400/8 border-red-400/20 text-red-400'
               : dim
                 ? 'bg-muted/30 border-border/40 text-muted-foreground'
                 : 'bg-primary/8 border-primary/20 text-primary'}
    `}>
      <span className="text-base font-black leading-none">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  )
}