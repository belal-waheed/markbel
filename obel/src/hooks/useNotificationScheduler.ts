import { useEffect, useRef } from 'react'
import dayjs from 'dayjs'
import { useTaskStore } from '@/stores/taskStore'
import { useHabitStore } from '@/stores/habitStore'
import { notificationSystem } from '@/lib/notifications'

/**
 * Hook to automatically schedule notifications for tasks and habits.
 * Runs whenever the task or habit lists change.
 * Uses native Notification Triggers when available for resource efficiency.
 */
export function useNotificationScheduler() {
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitStore((s) => s.habits)
  
  // Keep track of what we've already scheduled in this session to avoid redundant calls
  const scheduledTags = useRef<Set<string>>(new Set())

  useEffect(() => {
    const scheduleAll = async () => {
      // If Web Push subscription is active, delegate all scheduling to the backend cron
      // to avoid receiving duplicate notifications.
      const hasPush = await notificationSystem.hasActivePushSubscription()
      if (hasPush) {
        for (const task of tasks) {
          notificationSystem.cancelScheduled(`task-${task.id}`)
        }
        for (const habit of habits) {
          notificationSystem.cancelScheduled(`habit-${habit.id}`)
        }
        scheduledTags.current.clear()
        return
      }

      // ─── Schedule Tasks ───────────────────────────────────────────
      for (const task of tasks) {
        if (!task.scheduledTime || task.status === 'done') {
          // Cancel any existing notification if task was unscheduled or completed
          notificationSystem.cancelScheduled(`task-${task.id}`)
          Array.from(scheduledTags.current).forEach(key => {
            if (key.startsWith(`task-${task.id}-`)) {
              scheduledTags.current.delete(key)
            }
          })
          continue
        }

        const datePart = task.dueDate
          ? (task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate)
          : dayjs().format('YYYY-MM-DD')

        const triggerDate = dayjs(`${datePart}T${task.scheduledTime}`)

        // If the calculated time is in the past, skip it
        if (triggerDate.isBefore(dayjs())) continue

        const tag = `task-${task.id}`
        const timestamp = triggerDate.valueOf()
        const scheduleKey = `${tag}-${timestamp}-${task.title}`

        if (!scheduledTags.current.has(scheduleKey)) {
          // Clear any old schedule keys for this task first
          Array.from(scheduledTags.current).forEach(key => {
            if (key.startsWith(`task-${task.id}-`)) {
              scheduledTags.current.delete(key)
            }
          })

          await notificationSystem.schedule(
            `Task Reminder: ${task.title}`,
            timestamp,
            tag,
            { 
              body: 'Time to get this done! Open Obel to update progress.', 
              icon: '/icons/badge-task.png',
              badge: '/icons/badge-task.svg',
              data: { url: '/tasks' } 
            }
          )
          scheduledTags.current.add(scheduleKey)
        }
      }

      // ─── Schedule Habits ──────────────────────────────────────────
      for (const habit of habits) {
        if (!habit.reminderTime) {
          notificationSystem.cancelScheduled(`habit-${habit.id}`)
          Array.from(scheduledTags.current).forEach(key => {
            if (key.startsWith(`habit-${habit.id}-`)) {
              scheduledTags.current.delete(key)
            }
          })
          continue
        }

        // If already completed today, don't notify
        const todayStr = dayjs().format('YYYY-MM-DD')
        if (habit.completedDates?.includes(todayStr)) {
          notificationSystem.cancelScheduled(`habit-${habit.id}`)
          Array.from(scheduledTags.current).forEach(key => {
            if (key.startsWith(`habit-${habit.id}-`)) {
              scheduledTags.current.delete(key)
            }
          })
          continue
        }

        const [hours, minutes] = habit.reminderTime.split(':').map(Number)
        let triggerDate = dayjs().hour(hours).minute(minutes).second(0)

        // If time passed for today, schedule for tomorrow (optional, but good for consistency)
        if (triggerDate.isBefore(dayjs())) {
          triggerDate = triggerDate.add(1, 'day')
        }

        const tag = `habit-${habit.id}`
        const timestamp = triggerDate.valueOf()
        const scheduleKey = `${tag}-${timestamp}-${habit.name}`

        if (!scheduledTags.current.has(scheduleKey)) {
          // Clear any old schedule keys for this habit first
          Array.from(scheduledTags.current).forEach(key => {
            if (key.startsWith(`habit-${habit.id}-`)) {
              scheduledTags.current.delete(key)
            }
          })

          await notificationSystem.schedule(
            `Habit Reminder: ${habit.name}`,
            timestamp,
            tag,
            { 
              body: `Don't break your streak! Time to complete your habit.`, 
              icon: '/icons/badge-habit.png',
              badge: '/icons/badge-habit.svg',
              data: { url: '/habits' } 
            }
          )
          scheduledTags.current.add(scheduleKey)
        }
      }
    }

    // Debounce the scheduling to prevent rapid firing during multiple state updates
    const timer = setTimeout(scheduleAll, 2000)
    return () => clearTimeout(timer)
  }, [tasks, habits])
}
