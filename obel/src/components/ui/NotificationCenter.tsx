import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, X, Info, Trophy, Timer } from 'lucide-react'
import { Button } from './button'
import { useAuthStore } from '@/stores/authStore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

// Dummy notifications for presentation. In a real app, this would be backed by a store.
const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    title: 'Welcome to Obel!',
    message: 'Start by creating your first task.',
    type: 'info',
    read: false,
    date: dayjs().subtract(2, 'hour').toISOString(),
    icon: <Info className="w-4 h-4 text-primary" />
  },
  {
    id: '2',
    title: 'Time to Focus',
    message: 'You have a high priority task due today. Ready to start a Pomodoro?',
    type: 'alert',
    read: false,
    date: dayjs().subtract(5, 'hour').toISOString(),
    icon: <Timer className="w-4 h-4 text-orange-500" />
  },
  {
    id: '3',
    title: 'Level Up!',
    message: 'You reached Level 2! Keep up the great work.',
    type: 'success',
    read: true,
    date: dayjs().subtract(1, 'day').toISOString(),
    icon: <Trophy className="w-4 h-4 text-yellow-500" />
  }
]

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const user = useAuthStore(s => s.user)

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifications(notifications.filter(n => n.id !== id))
  }

  if (!user) return null

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed md:absolute bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 md:inset-auto md:top-full md:mt-2 md:right-0 md:w-96 bg-card/95 backdrop-blur-3xl border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden premium-shadow"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-muted/10">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-primary/20 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-md">
                      {unreadCount} NEW
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] font-bold text-muted-foreground hover:text-primary px-2">
                    Mark all read <Check className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>

              <div className="max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col p-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center mb-3">
                      <Bell className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">You're all caught up!</p>
                  </div>
                ) : (
                  notifications.map(notification => (
                    <motion.div
                      layout
                      key={notification.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`relative flex gap-3 p-3 rounded-xl transition-colors cursor-pointer group ${
                        notification.read ? 'hover:bg-muted/30' : 'bg-primary/5 hover:bg-primary/10'
                      }`}
                      onClick={() => setNotifications(notifications.map(n => n.id === notification.id ? { ...n, read: true } : n))}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        notification.read ? 'bg-muted/50' : 'bg-background shadow-sm border border-primary/20'
                      }`}>
                        {notification.icon}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className={`text-sm font-bold truncate ${notification.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {notification.title}
                          </h4>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
                            {dayjs(notification.date).fromNow(true)}
                          </span>
                        </div>
                        <p className={`text-xs leading-snug line-clamp-2 ${notification.read ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                          {notification.message}
                        </p>
                      </div>
                      <button
                        onClick={(e) => dismissNotification(notification.id, e)}
                        className="absolute right-2 top-2 p-1 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
