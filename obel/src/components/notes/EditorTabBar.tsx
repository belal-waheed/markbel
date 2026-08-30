import React from 'react'
import { FileText, X } from 'lucide-react'
import { type Note } from '@/stores/noteStore'

interface EditorTabBarProps {
  isZenMode: boolean
  openNoteIds: string[]
  activeNoteId: string | null
  notes: Note[]
  onSelectNote: (id: string) => void
  removeOpenNote: (id: string) => void
}

export function EditorTabBar({
  isZenMode,
  openNoteIds,
  activeNoteId,
  notes,
  onSelectNote,
  removeOpenNote,
}: EditorTabBarProps) {
  if (isZenMode || openNoteIds.length === 0) return null

  return (
    <div className="hidden md:flex items-center gap-1 px-4 py-2 border-b border-border/10 bg-card/5 overflow-x-auto no-scrollbar shrink-0">
      {openNoteIds.map((id) => {
        const note = notes.find((n) => n.id === id)
        if (!note) return null
        const isActive = id === activeNoteId
        return (
          <div
            key={id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer border ${
              isActive 
                ? 'bg-primary/10 border-primary/20 text-primary' 
                : 'bg-transparent border-transparent text-muted-foreground hover:bg-muted/50'
            }`}
            onClick={() => onSelectNote(id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              removeOpenNote(id)
            }}
            onAuxClick={(e) => {
              if (e.button === 1) { // Middle click / mouse wheel click
                e.preventDefault()
                e.stopPropagation()
                removeOpenNote(id)
              }
            }}
          >
            <FileText className="h-3 w-3 opacity-50" />
            <span className="truncate max-w-[120px]">{note.title || 'Untitled'}</span>
            <X 
              className={`h-3 w-3 opacity-0 group-hover:opacity-50 hover:opacity-100 hover:text-destructive transition-all ${isActive ? 'opacity-30' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                removeOpenNote(id)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
