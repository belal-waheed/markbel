import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import { useMemo } from 'react'

const quotes = [
  { text: "Its never too late for coffee", author: "Belal Waheed" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" }
]

export function DailyQuoteCard() {
  const quote = useMemo(() => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24)
    return quotes[dayOfYear % quotes.length]
  }, [])

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8 bg-linear-to-br from-primary/90 to-accent/90 text-primary-foreground shadow-xl premium-shadow"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Quote className="w-24 h-24 rotate-180" />
      </div>
      
      <div className="relative z-10 max-w-[80%]">
        <p className="text-lg sm:text-xl font-medium leading-relaxed mb-4 text-white">
          "{quote.text}"
        </p>
        <p className="text-sm font-bold text-white/70 uppercase tracking-widest">
          — {quote.author}
        </p>
      </div>
    </motion.div>
  )
}
