import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto",
        className
      )}
    >
      <div className="w-20 h-20 mb-6 rounded-full bg-primary/10 flex items-center justify-center text-primary/40">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground mb-8 text-sm">
        {description}
      </p>
      {action && (
        <div className="flex justify-center w-full">
          {action}
        </div>
      )}
    </motion.div>
  )
}
