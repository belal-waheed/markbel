import { useEffect } from 'react'
import { useTaskStore } from '@/stores/taskStore'

export default function PWAUpdater() {
  const tasks = useTaskStore((state) => state.tasks)
  
  useEffect(() => {
    const updateBadge = async () => {
      if ('setAppBadge' in navigator) {
        const today = new Date().toISOString().split('T')[0]
        const count = tasks.filter(t => t.dueDate?.startsWith(today) && t.status !== 'done').length
        
        interface NavigatorWithBadge extends Navigator {
          setAppBadge: (count: number) => Promise<void>
          clearAppBadge: () => Promise<void>
        }

        try {
          if (count > 0) {
            await (navigator as NavigatorWithBadge).setAppBadge(count)
          } else {
            await (navigator as NavigatorWithBadge).clearAppBadge()
          }
        } catch (error) {
          console.error('Failed to update app badge:', error)
        }
      }
    }

    updateBadge()
  }, [tasks])

  return null
}
