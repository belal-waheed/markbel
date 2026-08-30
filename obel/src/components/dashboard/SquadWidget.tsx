import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Flame, Heart, Share2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/authStore'
// import confetti from 'canvas-confetti'

export function SquadWidget() {
  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const [inviteEmail, setInviteEmail] = useState('')
  const [hasCheered, setHasCheered] = useState(false)

  if (!user) return null

  const handleInvite = async () => {
    if (!inviteEmail) return
    // Mock linking a partner
    await updateUser({ partnerId: 'mock-partner-123' })
  }

  const handleCheer = () => {
    setHasCheered(true)
    import('canvas-confetti').then((confetti) => {
      confetti.default({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#ef4444', '#ec4899', '#f43f5e'] // pink/reds
      })
    })
    setTimeout(() => setHasCheered(false), 3000)
  }

  return (
    <Card className="p-5 h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Squad
        </h3>
      </div>

      {!user.partnerId ? (
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Productivity is better together. Invite an accountability partner to share streaks!
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Partner's email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-9"
            />
            <Button size="sm" onClick={handleInvite} className="shrink-0 gap-1.5 h-9">
              <Share2 className="w-4 h-4" /> Invite
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                A
              </div>
              <div>
                <p className="font-semibold text-sm">Alex (Partner)</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-orange-600 font-medium">12 Day Streak</span>
                </div>
              </div>
            </div>
            
            <Button
              variant={hasCheered ? "secondary" : "outline"}
              size="icon"
              className="rounded-full shadow-sm hover:text-red-500 hover:border-red-200"
              onClick={handleCheer}
            >
              <Heart className={`w-4 h-4 ${hasCheered ? 'fill-red-500 text-red-500' : ''}`} />
            </Button>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Tasks Completed Today</span>
            <span className="font-bold text-foreground">8 / 10</span>
          </div>
          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '80%' }}
              className="bg-primary h-full"
            />
          </div>
        </div>
      )}
    </Card>
  )
}
