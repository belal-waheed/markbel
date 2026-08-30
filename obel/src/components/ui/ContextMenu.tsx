import React, { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  divider?: boolean
  danger?: boolean
  submenu?: ContextMenuItem[]
  checked?: boolean
  colorDot?: string
  shortcut?: string
}

interface ContextMenuProps {
  x: number
  y: number
  isOpen: boolean
  onClose: () => void
  items: ContextMenuItem[]
}

interface SubmenuProps {
  items: ContextMenuItem[]
  alignLeft: boolean
  onClose: () => void
}

function Submenu({ items, alignLeft, onClose }: SubmenuProps) {
  return (
    <ul
      style={{ zIndex: 9999 }}
      data-context-menu="true"
      className={cn(
        "absolute top-0 w-48 bg-popover/95 backdrop-blur-md border border-border/40 shadow-xl rounded-xl p-1.5 z-120 animate-in fade-in-50 zoom-in-95 duration-100",
        alignLeft ? "right-full mr-1.5" : "left-full ml-1.5"
      )}
    >
      {items.map((subItem, subIndex) => {
        if (subItem.divider) {
          return <hr key={`div-${subIndex}`} className="-mx-1.5 my-1 border-t border-border/40" />
        }

        return (
          <MenuItem
            key={`sub-${subIndex}`}
            item={subItem}
            alignLeft={alignLeft}
            onClose={onClose}
          />
        )
      })}
    </ul>
  )
}

interface MenuItemProps {
  item: ContextMenuItem
  alignLeft: boolean
  onClose: () => void
}

function MenuItem({ item, alignLeft, onClose }: MenuItemProps) {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (item.submenu) {
      setIsSubmenuOpen(true)
    }
  }

  const handleMouseLeave = () => {
    if (item.submenu) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsSubmenuOpen(false)
      }, 150)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (item.disabled || item.submenu) {
      e.stopPropagation()
      return
    }
    item.onClick?.()
    onClose()
  }

  return (
    <li
      className="relative list-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        disabled={item.disabled}
        onClick={handleClick}
        className={cn(
          "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-left outline-none transition-colors select-none",
          item.danger 
            ? "text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 focus:bg-destructive/10 dark:focus:bg-destructive/20"
            : "text-foreground/90 hover:bg-muted/70 focus:bg-muted/70 hover:text-foreground focus:text-foreground",
          item.disabled && "opacity-40 pointer-events-none"
        )}
      >
        {/* Left icon / checkmark / color dot */}
        <span className="flex items-center justify-center w-4 h-4 shrink-0">
          {item.checked && <Check className="w-3.5 h-3.5 text-primary" />}
          {!item.checked && item.colorDot && (
            <span className={cn("w-2.5 h-2.5 rounded-full", item.colorDot)} />
          )}
          {!item.checked && !item.colorDot && item.icon}
        </span>

        {/* Label */}
        <span className="flex-1 truncate text-left">{item.label}</span>

        {/* Shortcut */}
        {item.shortcut && (
          <span className="ml-auto pl-3 text-[10px] font-normal tracking-wider text-muted-foreground/50 font-mono">
            {item.shortcut}
          </span>
        )}

        {/* Right chevron indicator for submenu */}
        {item.submenu && (
          <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground/60", !item.shortcut && "ml-auto")} />
        )}
      </button>

      {/* Render Submenu */}
      {item.submenu && isSubmenuOpen && (
        <Submenu
          items={item.submenu}
          alignLeft={alignLeft}
          onClose={onClose}
        />
      )}
    </li>
  )
}

export function ContextMenu({ x, y, isOpen, onClose, items }: ContextMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })
  const [alignLeft, setAlignLeft] = useState(false)

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let newLeft = x
    let newTop = y

    // Right-edge check for main menu
    if (x + rect.width > window.innerWidth) {
      newLeft = Math.max(8, window.innerWidth - rect.width - 8)
    }

    // Bottom-edge check for main menu
    if (y + rect.height > window.innerHeight) {
      newTop = Math.max(8, window.innerHeight - rect.height - 8)
    }

    // Determine if submenus should open to the left
    // We open to the left if the menu itself is in the right half of the screen
    // or if a submenu would overflow the right edge.
    const shouldAlignLeft = newLeft + rect.width + 192 > window.innerWidth
    setAlignLeft(shouldAlignLeft)

    setPosition({ left: newLeft, top: newTop })
  }, [x, y, isOpen])

  if (!isOpen) return null

  const menuContent = (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.08, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        zIndex: 9999,
      }}
      data-context-menu="true"
      className="w-56 bg-popover/85 backdrop-blur-md border border-border/40 shadow-2xl rounded-xl p-1.5 z-120 outline-none select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <ul className="flex flex-col gap-0.5 p-0 m-0">
        {items.map((item, index) => {
          if (item.divider) {
            return <hr key={`div-${index}`} className="-mx-1.5 my-1 border-t border-border/40" />
          }

          return (
            <MenuItem
              key={`item-${index}`}
              item={item}
              alignLeft={alignLeft}
              onClose={onClose}
            />
          )
        })}
      </ul>
    </motion.div>
  )

  return createPortal(menuContent, document.body)
}
