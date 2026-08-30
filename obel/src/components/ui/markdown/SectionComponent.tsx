'use client'

import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useNoteStore } from '@/stores/noteStore'
import { MarkdownSection } from './utils'

interface SectionComponentProps {
  noteId: string
  section: MarkdownSection
  renderContent: (content: string, isTitle?: boolean) => React.ReactNode
  renderSection: (sec: MarkdownSection) => React.ReactNode
}

export function SectionComponent({
  noteId,
  section,
  renderContent,
  renderSection,
}: SectionComponentProps) {
  const isCollapsed = useNoteStore((s) => s.collapsedHeadings[`${noteId}:${section.id}`] || false)
  const toggleHeadingCollapse = useNoteStore((s) => s.toggleHeadingCollapse)

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleHeadingCollapse(noteId, section.id)
  }

  // Heading styling classes mapping to match Obel typography theme in globals.css
  const headingStyles: Record<number, string> = {
    1: 'text-[2.25em] border-b-2 border-border pb-[0.1em] mt-[1em] mb-[0.5em] text-primary font-extrabold leading-tight w-full',
    2: 'text-[1.65em] border-b border-border pb-[0.2em] mt-[1.2em] mb-[0.5em] text-primary font-bold opacity-95 leading-tight w-full',
    3: 'text-[1.35em] mt-[1.5em] mb-[0.5em] text-primary font-bold opacity-85 leading-tight w-full',
    4: 'text-[1.15em] mt-[1.5em] mb-[0.5em] text-primary font-bold opacity-75 leading-tight w-full',
    5: 'text-[0.9em] mt-[1.5em] mb-[0.5em] uppercase tracking-[0.05em] text-muted-foreground opacity-80 font-bold leading-tight w-full',
    6: 'text-[0.9em] mt-[1.5em] mb-[0.5em] uppercase tracking-[0.05em] text-muted-foreground opacity-80 font-bold leading-tight w-full',
  }

  const HeadingTag = `h${section.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

  return (
    <div className="markdown-section mb-4">
      {/* Header Container */}
      <div
        className="flex items-center gap-2 group -ml-6 relative pl-6"
      >
        {/* Toggle chevron button (always visible on mobile/touch, hover transition on desktop) */}
        <button
          type="button"
          onClick={handleToggle}
          className="absolute -left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-primary hover:bg-muted active:scale-95 transition-all duration-200 flex items-center justify-center w-8 h-8 rounded shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 cursor-pointer border-none bg-transparent p-0 z-10"
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <HeadingTag className={`m-0 select-text ${headingStyles[section.level] || ''}`}>
          {renderContent(section.title, true)}
        </HeadingTag>
      </div>

      {/* Section Content & Nested Child Sections */}
      {!isCollapsed && (
        <div className="mt-2 transition-all duration-200">
          {section.contentLines.length > 0 && renderContent(section.contentLines.join('\n'))}
          {section.children.map((child) => (
            <div key={child.id}>
              {renderSection(child)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
