import React from 'react'
import { Search, FileText, CheckSquare, Table, Code, Quote, Plus, FolderPlus, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Command } from 'cmdk'
import { type Note } from '@/stores/noteStore'

interface NoteCommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notes: Note[]
  onSelectNote: (id: string) => void
  onInsertSnippet: (snippet: string) => void
  onNewNote: () => void
  onNewFolder: () => void
}

export function NoteCommandMenu({
  open,
  onOpenChange,
  notes,
  onSelectNote,
  onInsertSnippet,
  onNewNote,
  onNewFolder,
}: NoteCommandMenuProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-xl rounded-2xl border border-border/40 bg-background/80 backdrop-blur-2xl shadow-2xl z-100 overflow-hidden animate-in fade-in zoom-in duration-200 p-0">
        <Command label="Command Menu" className="w-full flex flex-col">
          <div className="flex items-center border-b border-border/40 px-4">
            <Search className="w-4 h-4 text-muted-foreground mr-3" />
            <Command.Input placeholder="Search notes, folders, and actions..." className="w-full h-12 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50" />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>
            <Command.Group heading="Notes" className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 py-1.5">
              {notes.map(note => (
                <Command.Item key={note.id} onSelect={() => { onSelectNote(note.id); onOpenChange(false); }} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                  <FileText className="w-4 h-4" />
                  <span className="truncate flex-1">{note.title || 'Untitled'}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Quick Insert (Slash Commands)" className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 py-1.5">
              <Command.Item onSelect={() => onInsertSnippet('\n| Header | Header |\n| --- | --- |\n| Cell | Cell |\n')} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <Table className="w-4 h-4" /> Insert Table
              </Command.Item>
              <Command.Item onSelect={() => onInsertSnippet('\n- [ ] Task ')} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <CheckSquare className="w-4 h-4" /> Task List Item
              </Command.Item>
              <Command.Item onSelect={() => onInsertSnippet('\n```\n\n```')} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <Code className="w-4 h-4" /> Code Block
              </Command.Item>
              <Command.Item onSelect={() => onInsertSnippet('\n> ')} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <Quote className="w-4 h-4" /> Quote Block
              </Command.Item>
              <Command.Item onSelect={() => onInsertSnippet('\n> [!NOTE]\n> ')} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <AlertCircle className="w-4 h-4" /> Info Callout
              </Command.Item>
            </Command.Group>
            <Command.Separator className="h-px bg-border/40 my-2" />
            <Command.Group heading="Actions" className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-2 py-1.5">
              <Command.Item onSelect={() => { onNewNote(); onOpenChange(false); }} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <Plus className="w-4 h-4" /> New Blank Note
              </Command.Item>
              <Command.Item onSelect={() => { onNewFolder(); onOpenChange(false); }} className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer aria-selected:bg-primary/10 aria-selected:text-primary transition-colors text-sm font-medium">
                <FolderPlus className="w-4 h-4" /> New Folder
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
