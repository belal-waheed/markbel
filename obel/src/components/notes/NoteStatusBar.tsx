import React from 'react'
import { Maximize2 } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface NoteStatusBarProps {
  isZenMode: boolean
  setIsZenMode: (val: boolean) => void
  updatedAt: string
}

export function NoteStatusBar({ isZenMode, setIsZenMode, updatedAt }: NoteStatusBarProps) {
  if (isZenMode) return null

  return (
    <div className="note-status-bar">
      <div className="flex gap-4">
        <div 
          className="note-status-item cursor-pointer" 
          onClick={() => setIsZenMode(true)} 
          title="Zen Mode (Alt+Z)"
        >
          <Maximize2 className="h-3 w-3 mr-1" />
          Zen Mode
        </div>
        <div className="note-status-item">
          <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
          Synced
        </div>
        <div className="note-status-item opacity-50 lowercase tracking-tight">
          Edited {dayjs(updatedAt).fromNow()}
        </div>
      </div>
    </div>
  )
}
