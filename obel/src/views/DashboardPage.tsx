import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTaskStore } from '@/stores/taskStore'
import { useAuthStore } from '@/stores/authStore'
import { useHabitStore } from '@/stores/habitStore'
import {
  DueThisWeekWidget,
  DailyHabitsWidget,
} from '@/components/dashboard/DashboardWidgets'
import { CoffeeDashboardCard } from '@/components/dashboard/CoffeeDashboardCard'
import { CoffeeHub } from '@/components/dashboard/CoffeeHub'
import { StatsRow } from '@/components/dashboard/StatsRow'
import { DailyQuoteCard } from '@/components/dashboard/DailyQuoteCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const tasks = useTaskStore((s) => s.tasks)
  const getTasksDueThisWeek = useTaskStore((s) => s.getTasksDueThisWeek)
  // const fetchTasks = useTaskStore((s) => s.fetchTasks) - unused
  
  const user = useAuthStore((s) => s.user)
  const userName = user?.name || ''
  
  const habits = useHabitStore((s) => s.habits)
  // const fetchHabits = useHabitStore((s) => s.fetchHabits) - unused
  
  const [isCoffeeHubOpen, setIsCoffeeHubOpen] = useState(false)

  // Redundant fetch calls removed: AppLayout already handles global fetch on mount.
  // This ensures local data appears immediately without being blocked by network requests.

  const tasksDueThisWeek = useMemo(() => getTasksDueThisWeek(), [getTasksDueThisWeek, tasks])

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const isTaskLoading = useTaskStore((s) => s.isLoading)
  const isHabitLoading = useHabitStore((s) => s.isLoading)
  // habits already declared above
  
  // CRITICAL FIX: Only show Skeletons if we have absolutely no data.
  // If we have hydrated data from IndexedDB, show it immediately!
  const isLoading = (isTaskLoading || isHabitLoading) && tasks.length === 0 && habits.length === 0

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 md:space-y-8">
      <motion.div variants={item}>
        <PageHeader 
          title={`${getGreeting()}${userName ? `, ${userName}` : ''}`}
          subtitle="Ready to make today productive?"
        />
      </motion.div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-[1.5rem]" />
            <Skeleton className="h-28 rounded-[1.5rem]" />
            <Skeleton className="h-28 rounded-[1.5rem]" />
            <Skeleton className="h-28 rounded-[1.5rem]" />
          </div>
          <Skeleton className="h-40 rounded-[2rem] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <>
          <motion.div variants={item}>
            <StatsRow />
          </motion.div>

          <motion.div variants={item}>
            <DailyQuoteCard />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 pt-2">
            <motion.div variants={item}>
              <CoffeeDashboardCard onOpenHub={() => setIsCoffeeHubOpen(true)} />
            </motion.div>
            <motion.div variants={item}>
              <DueThisWeekWidget tasks={tasksDueThisWeek} />
            </motion.div>
            <motion.div variants={item}>
              <DailyHabitsWidget habits={habits} />
            </motion.div>
          </div>
        </>
      )}

      <CoffeeHub isOpen={isCoffeeHubOpen} onClose={() => setIsCoffeeHubOpen(false)} />
    </motion.div>
  )
}
