import type { ReactNode } from "react"
import { motion } from "framer-motion"

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div className="relative group pl-5">
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: '100%' }}
          className="absolute left-0 top-0 w-1.5 bg-primary rounded-full"
        />
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-primary/70">
              {icon}
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gradient pb-1">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="text-muted-foreground mt-1 font-medium text-sm">
            {subtitle}
          </p>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
