import React from 'react'
import { 
  ChevronLeft, 
  FileText, 
  Eye, 
  Edit3, 
  ImageIcon, 
  Mic, 
  MoreHorizontal, 
  Pin, 
  Folder, 
  CheckSquare, 
  Palette, 
  Link2, 
  Download, 
  Trash2 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { NOTE_COLORS, type Note, type NoteFolder, type NoteColor, type NoteColorConfig } from '@/stores/noteStore'
import dayjs from 'dayjs'

interface NoteHeaderProps {
  isMobile: boolean
  showSidebar: boolean
  setShowSidebar: (show: boolean) => void
  activeNote: Note
  viewMode: 'edit' | 'preview'
  setViewMode: (mode: 'edit' | 'preview') => void
  wordCount: number
  onBack: () => void
  onStartRecording: () => void
  imageInputRef: React.RefObject<HTMLInputElement | null>
  onInsertImageFromGallery: (event: React.ChangeEvent<HTMLInputElement>) => void
  onTogglePin: (id: string) => void
  folders: NoteFolder[]
  onMoveNote: (noteId: string, folderId: string | undefined) => void
  onSetColor: (id: string, color: NoteColor) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[]
  onToggleTaskLink: (taskId: string) => void
  onExportNote: () => void
  onDeleteNote: (id: string) => void
}

export function NoteHeader({
  isMobile,
  showSidebar,
  setShowSidebar,
  activeNote,
  viewMode,
  setViewMode,
  wordCount,
  onBack,
  onStartRecording,
  imageInputRef,
  onInsertImageFromGallery,
  onTogglePin,
  folders,
  onMoveNote,
  onSetColor,
  tasks,
  onToggleTaskLink,
  onExportNote,
  onDeleteNote
}: NoteHeaderProps) {
  return (
    <div 
      className="flex items-center justify-between px-6 py-3 border-b border-border/10 bg-background/20 shrink-0 select-none"
    >
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary transition-all"
          onClick={() => {
            if (isMobile) {
              onBack()
            } else {
              setShowSidebar(!showSidebar)
            }
          }}
          title={isMobile ? "Back to list" : "Toggle Sidebar (Ctrl+B)"}
        >
          {isMobile && !showSidebar ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
        </Button>

        <span className="text-[11px] text-muted-foreground/60 font-mono hidden sm:inline">
          {wordCount} words · {dayjs(activeNote.updatedAt).fromNow()}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* View Toggle */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')} 
          className="h-8 text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
        >
          {viewMode === 'edit' ? (
            <><Eye className="w-3.5 h-3.5 mr-1.5" /> Reading Mode</>
          ) : (
            <><Edit3 className="w-3.5 h-3.5 mr-1.5" /> Live Preview</>
          )}
        </Button>

        {viewMode === 'edit' && (
          <div className="flex items-center gap-1">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={imageInputRef}
              onChange={onInsertImageFromGallery}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              className="h-8 text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
              title="Insert image from gallery"
            >
              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
              Add Image
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onStartRecording}
              className="h-8 text-xs font-bold text-muted-foreground hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"
              title="Record Audio Memo"
            >
              <Mic className="w-3.5 h-3.5 mr-1.5 text-muted-foreground hover:text-red-500" />
              Record Note
            </Button>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
             <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
            <DropdownMenuItem onClick={() => onTogglePin(activeNote.id)} className="text-xs cursor-pointer">
              <Pin className="w-3.5 h-3.5 mr-2" /> {activeNote.pinned ? 'Unpin Note' : 'Pin Note'}
            </DropdownMenuItem>
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                <Folder className="w-3.5 h-3.5 mr-2" /> Move to Folder...
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="rounded-xl w-40">
                  {folders.map(f => (
                    <DropdownMenuItem key={f.id} onClick={() => onMoveNote(activeNote.id, f.id)} className="text-xs cursor-pointer">
                      {f.id === activeNote.folderId ? <CheckSquare className="w-3 h-3 mr-2 text-primary" /> : <div className="w-5" />}
                      {f.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                <Palette className="w-3.5 h-3.5 mr-2" /> Accent Color
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="rounded-xl p-1 grid grid-cols-4 gap-1 w-32">
                  {(Object.entries(NOTE_COLORS) as [NoteColor, NoteColorConfig][]).map(([key, config]) => (
                    <button
                      key={key} 
                      title={config.label} 
                      onClick={() => onSetColor(activeNote.id, key)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted/50 ${activeNote.color === key ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                    >
                       {key === 'none' ? (
                         <div className="w-3 h-3 rounded-full border border-muted-foreground/50 border-dashed" />
                       ) : (
                         <div className={`w-3 h-3 rounded-full ${config.dot}`} />
                       )}
                    </button>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                <Link2 className="w-3.5 h-3.5 mr-2" /> Link to Task
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="rounded-xl w-48 max-h-64 overflow-y-auto">
                  {tasks.map(t => {
                    const isLinked = activeNote.linkedTaskIds?.includes(t.id)
                    return (
                      <DropdownMenuItem 
                        key={t.id} 
                        onClick={(e) => { e.preventDefault(); onToggleTaskLink(t.id); }} 
                        className="text-xs cursor-pointer"
                      >
                        {isLinked ? <CheckSquare className="w-3 h-3 mr-2 text-primary shrink-0" /> : <div className="w-5 shrink-0" />}
                        <span className="truncate">{t.title}</span>
                      </DropdownMenuItem>
                    )
                  })}
                  {tasks.length === 0 && <div className="p-2 text-xs text-muted-foreground">No tasks found</div>}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportNote} className="text-xs cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-2" /> Export (.md)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDeleteNote(activeNote.id)} className="text-xs cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
