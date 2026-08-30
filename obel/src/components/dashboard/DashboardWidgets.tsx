import { useNavigate } from 'react-router-dom'
import { ListTodo, CheckCircle2, Clock, Zap, Play, ArrowRight, Calendar, Flame } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { Task } from '@/stores/taskStore'
import type { Habit } from '@/stores/habitStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)



export function QuickActionsWidget({ isRunning, completionRate }: { isRunning: boolean; completionRate: number }) {
  const navigate = useNavigate()
  return (
    <Card className="p-5 h-full glass-card border-t-primary/30 card-hover">
      <h3 className="font-semibold text-lg mb-4 text-foreground">Quick Actions</h3>
      <div className="space-y-3">
        <Button className="w-full justify-start gap-3 h-12 shadow-md hover:shadow-xl transition-all" onClick={() => navigate('/pomodoro')}>
          {isRunning ? <Zap className="w-5 h-5 text-yellow-300" /> : <Play className="w-5 h-5" />}
          {isRunning ? 'Continue Focus Session' : 'Start Pomodoro'}
        </Button>
        <Button variant="outline" className="w-full justify-start gap-3 h-12 bg-card/50 hover:bg-card/80 transition-colors" onClick={() => navigate('/tasks')}>
          <ListTodo className="w-5 h-5" />Manage Tasks
        </Button>
        <Button variant="outline" className="w-full justify-start gap-3 h-12 bg-card/50 hover:bg-card/80 transition-colors" onClick={() => navigate('/habits')}>
          <Calendar className="w-5 h-5" />View Habits
        </Button>
      </div>
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          <span>Task Completion</span>
          <span className="text-primary">{completionRate}%</span>
        </div>
        <Progress value={completionRate} className="h-2" />
      </div>
    </Card>
  )
}

export function DueTodayWidget({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate()
  return (
    <Card className="p-5 h-full glass-card border-t-primary/30 card-hover">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-foreground">Due Today</h3>
        <Button variant="ghost" size="sm" className="gap-1 text-primary hover:text-primary/80" onClick={() => navigate('/tasks')}>
          View all <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No tasks due today.<br/>You're all caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all cursor-pointer hover:shadow-md press-scale" onClick={() => navigate('/tasks')}>
              <span className="text-sm font-medium flex-1 truncate text-foreground">{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function DueThisWeekWidget({ tasks }: { tasks: Task[] }) {
  const navigate = useNavigate()
  return (
    <Card className="p-5 h-full glass-card border-t-accent/30 card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-accent" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Due This Week</h3>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate('/tasks')}>
          View all <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Your week is clear!<br/>Time to relax or plan ahead. 🏝️</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.slice(0, 5).map((task) => {
            const isToday = task.dueDate === dayjs().format('YYYY-MM-DD')
            return (
              <div key={task.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-accent/30 transition-all cursor-pointer hover:shadow-md press-scale" onClick={() => navigate('/tasks')}>
                <span className="text-sm font-medium truncate flex-1 text-foreground">{task.title}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${isToday ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
                  {isToday ? 'Today' : dayjs(task.dueDate).format('ddd')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export function DailyHabitsWidget({ habits }: { habits: Habit[] }) {
  const navigate = useNavigate()
  return (
    <Card className="p-5 h-full glass-card border-t-emerald-500/30 card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Daily Habits</h3>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate('/habits')}>
          Track <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      {habits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Build your first daily habit<br/>to start fresh.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.slice(0, 5).map((habit) => {
            const todayStr = dayjs().format('YYYY-MM-DD')
            const isDone = (habit.completedDates || []).includes(todayStr)

            return (
              <div key={habit.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md press-scale ${isDone ? 'bg-primary/5 border-primary/20 shadow-inner' : 'bg-card border-border/50 hover:border-emerald-500/30'}`} onClick={() => navigate('/habits')}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'}`}>
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-sm font-medium truncate ${isDone ? 'text-foreground/60 line-through' : 'text-foreground'}`}>{habit.name}</span>
                </div>
                {habit.currentStreak > 0 && (
                  <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-md">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-xs font-bold text-orange-500">{habit.currentStreak}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

