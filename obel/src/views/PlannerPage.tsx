import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Calendar as CalendarIcon, GripVertical, Clock, X, MoreVertical } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useTaskStore, type Task } from '@/stores/taskStore'
import dayjs from 'dayjs'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function PlannerPage() {
  const [mobileTab, setMobileTab] = useState<'timeline' | 'backlog'>('timeline')
  const timelineRef = useRef<HTMLDivElement>(null)
  
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const getTasksDueToday = useTaskStore((s) => s.getTasksDueToday)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tasksDueToday = useMemo(() => getTasksDueToday(), [getTasksDueToday, tasks])

  const unscheduledTasks = useMemo(() => {
    return tasksDueToday.filter((t) => !t.scheduledTime && t.status !== 'done')
  }, [tasksDueToday])

  const scheduledTasks = useMemo(() => {
    const map = new Map<number, Task[]>()
    HOURS.forEach(h => map.set(h, []))

    tasksDueToday.forEach(t => {
      if (t.scheduledTime && t.status !== 'done') {
        const hour = parseInt(t.scheduledTime.split(':')[0], 10)
        if (!isNaN(hour)) {
          map.get(hour)?.push(t)
        }
      }
    })
    return map
  }, [tasksDueToday])

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId)
  }

  const handleDrop = async (e: React.DragEvent, hour: number) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return

    const timeStr = `${hour.toString().padStart(2, '0')}:00`
    await updateTask(taskId, { scheduledTime: timeStr })
  }

  const handleDropToBacklog = async (e: React.DragEvent) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId) return
    await updateTask(taskId, { scheduledTime: '' })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleMobileSchedule = async (taskId: string, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`
    await updateTask(taskId, { scheduledTime: timeStr })
  }

  const handleMobileUnschedule = async (taskId: string) => {
    await updateTask(taskId, { scheduledTime: '' })
  }

  // Auto-scroll to current hour
  useEffect(() => {
    const currentHour = dayjs().hour()
    const element = document.getElementById(`hour-${currentHour}`)
    if (element && timelineRef.current) {
      setTimeout(() => {
        timelineRef.current?.scrollTo({
          top: (element as HTMLElement).offsetTop - 100,
          behavior: 'smooth'
        })
      }, 100)
    }
  }, [])

  return (
    <div className="h-[calc(100vh-4rem)] md:h-screen flex flex-col md:flex-row gap-6">
      <div className="flex md:hidden bg-muted/50 p-1.5 rounded-xl shrink-0">
        <button 
          onClick={() => setMobileTab('timeline')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mobileTab === 'timeline' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Timeline
        </button>
        <button 
          onClick={() => setMobileTab('backlog')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${mobileTab === 'backlog' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Backlog
          {unscheduledTasks.length > 0 && (
            <span className="bg-primary/20 text-primary px-1.5 rounded-full text-[10px]">{unscheduledTasks.length}</span>
          )}
        </button>
      </div>

      <Card
        className={`w-full md:w-80 flex-col bg-background/50 border-border/50 ${mobileTab === 'backlog' ? 'flex' : 'hidden md:flex'}`}
        onDrop={handleDropToBacklog}
        onDragOver={handleDragOver}
      >
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10">
              <CalendarIcon className="w-4 h-4 text-primary" />
            </span>
            Backlog
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {unscheduledTasks.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-border/30 rounded-2xl">
              <p className="text-sm font-medium italic text-muted-foreground/60">No tasks in backlog</p>
            </div>
          )}
          {unscheduledTasks.map((task) => (
            <motion.div
              layoutId={task.id}
              key={task.id}
              draggable
              onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
              className="bg-card border border-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group flex items-start gap-2"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/30 mt-0.5 group-hover:text-primary transition-colors shrink-0 hidden md:block" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight mb-1 truncate">{task.title}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="h-6 w-6 -mr-1 text-muted-foreground md:hidden shrink-0 mt-0.5 flex items-center justify-center hover:bg-muted/10 rounded-lg outline-none" title="Schedule Task">
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px] h-[300px] overflow-y-auto custom-scrollbar">
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Schedule Time</div>
                  <DropdownMenuSeparator />
                  {HOURS.map(h => (
                    <DropdownMenuItem key={h} onClick={() => handleMobileSchedule(task.id, h)} className="cursor-pointer">
                      <Clock className="w-4 h-4 mr-2" />
                      {dayjs().hour(h).minute(0).format('ha')}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </div>
      </Card>

      <Card className={`flex-1 flex-col overflow-hidden border-border/50 ${mobileTab === 'timeline' ? 'flex' : 'hidden md:flex'}`}>
        <div 
          ref={timelineRef}
          className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-linear-to-b from-muted/5 to-background scroll-smooth"
        >
          <div className="space-y-4 max-w-none">
            {HOURS.map((hour) => {
              const hourTasks = scheduledTasks.get(hour) || []
              const isCurrentHour = dayjs().hour() === hour

              return (
                <div key={hour} id={`hour-${hour}`} className="flex gap-6 relative group">
                  <div className="w-20 text-right shrink-0 pt-3">
                    <span className={`text-xs font-black tracking-tighter uppercase ${isCurrentHour ? 'text-primary' : 'text-muted-foreground/50'}`}>
                      {dayjs().hour(hour).minute(0).format('ha')}
                    </span>
                  </div>
                  
                  <div
                    className={`flex-1 min-h-20 rounded-2xl border-2 transition-all duration-300 relative p-3 flex flex-col gap-3 ${
                      isCurrentHour 
                        ? 'bg-primary/5 border-primary/30 shadow-[0_0_20px_-5px_rgba(var(--primary),0.1)]' 
                        : 'bg-card/30 border-dashed border-border/50 hover:border-primary/20 hover:bg-card/50'
                    }`}
                    onDrop={(e) => handleDrop(e, hour)}
                    onDragOver={handleDragOver}
                  >
                    {isCurrentHour && (
                      <motion.div 
                        layoutId="current-hour-indicator"
                        className="absolute -left-13 top-1/2 -translate-y-1/2 flex items-center gap-2"
                      >
                        <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20 animate-pulse" />
                        <div className="h-[2px] w-6 bg-linear-to-r from-primary to-transparent" />
                      </motion.div>
                    )}

                    {hourTasks.map((task) => (
                      <motion.div
                        layoutId={task.id}
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
                        whileHover={{ scale: 1.01, x: 4 }}
                        className="bg-background/80 backdrop-blur-md border border-border/50 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-xl hover:shadow-primary/5 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
                          <p className="text-sm font-bold tracking-tight truncate">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ml-auto" 
                            title="Remove from timeline"
                            onClick={() => handleMobileUnschedule(task.id)}
                          >
                            <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                          <GripVertical className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0 hidden md:block" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
