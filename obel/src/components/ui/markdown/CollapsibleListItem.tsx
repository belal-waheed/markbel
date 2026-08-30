'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  children?: React.ReactNode
  node?: any
  index?: number
  ordered?: boolean
  checked?: boolean | null
}

export function CollapsibleListItem({
  children,
  node,
  index,
  ordered,
  checked,
  ...props
}: CollapsibleListItemProps) {
  // Helper to recursively find and extract nested lists
  const extractNestedLists = (nodes: React.ReactNode): {
    hasSublist: boolean
    sublists: React.ReactNode[]
    inlineContent: React.ReactNode[]
  } => {
    const nodesArray = React.Children.toArray(nodes)
    let hasSublist = false
    const sublists: React.ReactNode[] = []
    const inlineContent: React.ReactNode[] = []

    nodesArray.forEach((node) => {
      if (!React.isValidElement(node)) {
        inlineContent.push(node)
        return
      }

      const element = node as React.ReactElement<any>
      const type = element.type
      // 1. Direct list tag check
      if (type === 'ul' || type === 'ol') {
        hasSublist = true
        sublists.push(element)
        return
      }

      // 2. Component list check (in case of custom renderers or internal components)
      if (typeof type === 'function') {
        const name = type.name || (type as any).displayName || ''
        if (name.toLowerCase() === 'ul' || name.toLowerCase() === 'ol') {
          hasSublist = true
          sublists.push(element)
          return
        }
      }

      // 3. Recursive check for wrapper elements (like p, span, div, etc.)
      if (element.props && element.props.children) {
        const nested = extractNestedLists(element.props.children)
        if (nested.hasSublist) {
          hasSublist = true
          sublists.push(...nested.sublists)
          
          // Re-create the parent wrapper element but with only the non-list (inline) children
          if (nested.inlineContent.length > 0) {
            inlineContent.push(
              React.cloneElement(
                element,
                element.props, // Preserve original props (like className, styles, etc.)
                ...nested.inlineContent
              )
            )
          }
        } else {
          inlineContent.push(element)
        }
      } else {
        inlineContent.push(element)
      }
    })

    return { hasSublist, sublists, inlineContent }
  }

  const { hasSublist, sublists, inlineContent } = extractNestedLists(children)

  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!hasSublist) {
    return <li {...props}>{children}</li>
  }

  return (
    <li
      {...props}
      style={{ ...props.style, listStyleType: 'none' }}
      className={`relative group ${props.className || ''}`}
    >
      {/* Premium touch-friendly collapse chevron button (scaled in em to match font-size settings) */}
      <button
        type="button"
        className="absolute -left-[1.95em] top-[-0.275em] text-muted-foreground/60 hover:text-primary hover:bg-primary/10 active:scale-90 transition-all duration-200 flex items-center justify-center w-[2.2em] h-[2.2em] rounded-full cursor-pointer select-none z-10 border-none bg-transparent p-0 opacity-45 group-hover:opacity-100"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsCollapsed(!isCollapsed)
        }}
        aria-label={isCollapsed ? 'Expand list' : 'Collapse list'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-[0.9em] h-[0.9em] transition-transform" />
        ) : (
          <ChevronDown className="w-[0.9em] h-[0.9em] transition-transform" />
        )}
      </button>

      {/* Parent list item text/inline content */}
      <div className="w-full">
        {inlineContent}
      </div>

      {/* Nested child lists container */}
      {!isCollapsed && (
        <div className="mt-1 transition-all duration-200">
          {sublists}
        </div>
      )}
    </li>
  )
}
