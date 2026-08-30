import { useState, useMemo } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useNoteStore } from '@/stores/noteStore'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useShortcutStore, DEFAULT_SHORTCUTS } from '@/stores/shortcutStore'
import { Search, FileText, Plus } from 'lucide-react'

export function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')

  const navigate = useNavigate()
  const notes = useNoteStore((s) => s.notes)
  const folders = useNoteStore((s) => s.folders)
  const addNote = useNoteStore((s) => s.addNote)
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const setActiveNoteId = useNoteStore((s) => s.setActiveNoteId)
  const shortcuts = useShortcutStore((s) => s.shortcuts)

  const quickSearchShortcut = shortcuts.quickSearch || DEFAULT_SHORTCUTS.quickSearch

  useKeyboardShortcuts(
    useMemo(() => {
      if (!quickSearchShortcut) return []
      return [
        {
          key: quickSearchShortcut.key,
          ctrlKey: quickSearchShortcut.ctrlKey,
          altKey: quickSearchShortcut.altKey,
          shiftKey: quickSearchShortcut.shiftKey,
          metaKey: quickSearchShortcut.metaKey,
          action: () => setOpen((prev) => !prev),
        },
      ]
    }, [quickSearchShortcut])
  )

  const filteredNotes = useMemo(() => {
    // Sort notes by updatedAt (or fallback to createdAt) descending
    const sorted = [...notes].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return timeB - timeA
    })

    if (!inputValue.trim()) {
      // "list last 5 updates not all the notes"
      return sorted.slice(0, 5)
    }

    const q = inputValue.toLowerCase()
    return sorted.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
    )
  }, [inputValue, notes])

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId), [notes, activeNoteId])

  const handleSelectNote = (id: string) => {
    setActiveNoteId(id)
    setOpen(false)
    setInputValue('')
    navigate('/notes')
  }

  const handleCreateNote = () => {
    if (!inputValue.trim()) return
    const folderId = activeNote?.folderId || folders[0]?.id || 'hola-default'
    const newId = addNote(inputValue.trim(), '', folderId)
    setActiveNoteId(newId)
    setOpen(false)
    setInputValue('')
    navigate('/notes')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[20vh] px-4">
      <div
        className="fixed inset-0 bg-transparent"
        onClick={() => {
          setOpen(false)
          setInputValue('')
        }}
        aria-hidden="true"
      />

      <Command
        className="relative w-full max-w-2xl bg-popover/80 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        loop
        shouldFilter={false}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
            setInputValue('')
          }
        }}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10" cmdk-input-wrapper="">
          <Search className="w-5 h-5 mr-3 text-muted-foreground shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Search note by title or content..."
            value={inputValue}
            onValueChange={setInputValue}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none border-none text-base h-10 w-full"
          />
        </div>

        <Command.List className="max-h-[350px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
          {inputValue.trim().length > 0 &&
            !filteredNotes.some(
              (n) => (n.title || '').toLowerCase() === inputValue.trim().toLowerCase()
            ) && (
              <Command.Group heading="Create Note" className="text-xs font-medium text-muted-foreground px-2 py-1.5 **:[[cmdk-item]]:rounded-xl **:[[cmdk-item]]:px-3 **:[[cmdk-item]]:py-3 **:[[cmdk-item]]:flex **:[[cmdk-item]]:items-center **:[[cmdk-item]]:gap-3 **:[[cmdk-item]]:cursor-pointer **:[[cmdk-item]]:text-sm **:[[cmdk-item]]:text-foreground **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:mb-2">
                <Command.Item
                  onSelect={handleCreateNote}
                  className="data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground group transition-colors"
                  value={`create-note-${inputValue}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 group-data-[selected=true]:bg-black/20 text-primary group-data-[selected=true]:text-primary-foreground">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium">Create note: "{inputValue}"</span>
                    <span className="text-xs opacity-70 truncate">
                      in folder: {folders.find((f) => f.id === (activeNote?.folderId || folders[0]?.id))?.name || 'Hola'}
                    </span>
                  </div>
                </Command.Item>
              </Command.Group>
            )}

          <Command.Group
            heading={inputValue.trim() ? 'Search Results' : 'Recently Updated'}
            className="text-xs font-medium text-muted-foreground px-2 py-1.5 **:[[cmdk-item]]:rounded-xl **:[[cmdk-item]]:px-3 **:[[cmdk-item]]:py-2.5 **:[[cmdk-item]]:flex **:[[cmdk-item]]:items-center **:[[cmdk-item]]:gap-3 **:[[cmdk-item]]:cursor-pointer **:[[cmdk-item]]:text-sm **:[[cmdk-item]]:text-foreground **:[[cmdk-group-heading]]:text-left **:[[cmdk-group-heading]]:mb-2"
          >
            {filteredNotes.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No matching notes found.
              </div>
            ) : (
              filteredNotes.map((n) => {
                const folder = folders.find((f) => f.id === n.folderId)
                const folderName = folder ? folder.name : 'Hola'
                return (
                  <Command.Item
                    key={n.id}
                    onSelect={() => handleSelectNote(n.id)}
                    value={`note-${n.id}-${n.title}`}
                    className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground group transition-colors flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0 group-data-[selected=true]:text-accent-foreground" />
                      <span className="font-medium truncate">{n.title || 'Untitled'}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border/40 text-muted-foreground group-data-[selected=true]:bg-black/20 group-data-[selected=true]:text-accent-foreground truncate shrink-0">
                      {folderName}
                    </span>
                  </Command.Item>
                )
              })
            )}
          </Command.Group>
        </Command.List>

        <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-t border-white/5 text-[10px] text-muted-foreground font-medium">
          <div className="flex gap-4">
            <span>
              <kbd className="font-sans bg-white/10 px-1 py-0.5 rounded text-[9px] mr-1 border border-white/10">
                ↑↓
              </kbd>{' '}
              to navigate
            </span>
            <span>
              <kbd className="font-sans bg-white/10 px-1 py-0.5 rounded text-[9px] mr-1 border border-white/10">
                Enter
              </kbd>{' '}
              to select
            </span>
            <span>
              <kbd className="font-sans bg-white/10 px-1 py-0.5 rounded text-[9px] mr-1 border border-white/10">
                Esc
              </kbd>{' '}
              to close
            </span>
          </div>
          <div className="font-mono opacity-50">Quick Switcher</div>
        </div>
      </Command>
    </div>
  )
}
