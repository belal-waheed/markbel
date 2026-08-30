import React, { useState, useMemo, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Pin, 
  Trash2, 
  Files, 
  Layers, 
  MoreVertical, 
  FolderPlus, 
  Edit2, 
  Settings, 
  Keyboard,
  SquarePen,
  ArrowUpDown,
  ChevronsUpDown,
  PanelLeftClose
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { 
  NOTE_COLORS, 
  NOTE_TEMPLATES, 
  type Note, 
  type NoteFolder, 
  type NoteColor 
} from '@/stores/noteStore'
import { useContextMenu } from '@/hooks/useContextMenu'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { useNoteStore } from '@/stores/noteStore'
import { buildTree, type TreeNode } from '@/lib/treeHelpers'
import { TreeItem } from './TreeItem'

interface FolderSidebarProps {
  showSidebar: boolean
  activeFolderId: string | null
  setActiveFolderId: (id: string | null) => void
  search: string
  setSearch: (search: string) => void
  activeNoteId: string | null
  onSelectNote: (id: string) => void
  notes: Note[]
  folders: NoteFolder[]
  isHydrated: boolean
  filteredNotes: Note[]
  onShowSettings: () => void
  onShowShortcuts: () => void
  onNewNote: (templateIndex?: number) => void
  onNewFolder: () => void
  onRenameFolder: (id: string, oldName: string) => void
  onDeleteFolder: (id: string) => void
  onCloseSidebar?: () => void
}

export function FolderSidebar({
  showSidebar,
  activeFolderId,
  setActiveFolderId,
  search,
  setSearch,
  activeNoteId,
  onSelectNote,
  notes,
  folders,
  isHydrated,
  onShowSettings,
  onShowShortcuts,
  onNewNote,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onCloseSidebar,
}: FolderSidebarProps) {
  const [activeTab, setActiveTab] = useState<'explorer' | 'outline' | 'search'>('explorer')
  const [sortBy, setSortBy] = useState<'alphabetical' | 'updated'>('alphabetical')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const noteContextMenu = useContextMenu<Note>()
  const folderContextMenu = useContextMenu<NoteFolder>()

  const togglePin = useNoteStore((s) => s.togglePin)
  const setColor = useNoteStore((s) => s.setColor)
  const moveNote = useNoteStore((s) => s.moveNote)
  const addNote = useNoteStore((s) => s.addNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const addFolder = useNoteStore((s) => s.addFolder)
  const moveFolder = useNoteStore((s) => s.moveFolder)

  // Expand all folders by default on initial folder loading
  useEffect(() => {
    if (folders.length > 0) {
      setExpandedPaths((prev) => {
        if (prev.size > 0) return prev
        const newSet = new Set<string>()
        folders.forEach((f) => newSet.add(f.name))
        return newSet
      })
    }
  }, [folders])

  // Context Menu Submenus
  const colorSubmenu = noteContextMenu.data
    ? Object.entries(NOTE_COLORS).map(([colorKey, config]) => ({
        label: config.label,
        colorDot: config.dot,
        checked: noteContextMenu.data?.color === colorKey || (!noteContextMenu.data?.color && colorKey === 'none'),
        onClick: () => setColor(noteContextMenu.data!.id, colorKey as NoteColor),
      }))
    : []

  const folderSubmenu = noteContextMenu.data
    ? folders.map((f) => ({
        label: f.name,
        checked: noteContextMenu.data?.folderId === f.id || (!noteContextMenu.data?.folderId && f.id === 'hola-default'),
        onClick: () => moveNote(noteContextMenu.data!.id, f.id),
      }))
    : []

  const noteMenuItems = noteContextMenu.data
    ? [
        {
          label: noteContextMenu.data.pinned ? 'Unpin Note' : 'Pin Note',
          icon: <Pin className="w-3.5 h-3.5" />,
          onClick: () => togglePin(noteContextMenu.data!.id),
        },
        { label: 'Change Color', submenu: colorSubmenu },
        { label: 'Move to Folder', submenu: folderSubmenu },
        { divider: true },
        {
          label: 'Duplicate Note',
          onClick: () => addNote(`${noteContextMenu.data!.title || 'Untitled'}_Copy`, noteContextMenu.data!.content || '', noteContextMenu.data!.folderId),
        },
        {
          label: 'Export as Markdown',
          onClick: () => {
            const blob = new Blob([noteContextMenu.data!.content || ''], { type: 'text/markdown;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${noteContextMenu.data!.title || 'Untitled'}.md`
            link.click()
            URL.revokeObjectURL(url)
          },
        },
        { divider: true },
        {
          label: 'Delete Note',
          danger: true,
          onClick: () => {
            if (window.confirm('Delete this note?')) {
              deleteNote(noteContextMenu.data!.id)
            }
          },
        },
      ]
    : []

  const folderMoveSubmenu = folderContextMenu.data
    ? [
        {
          label: 'Root (No parent)',
          onClick: () => moveFolder(folderContextMenu.data!.id, undefined),
        },
        ...folders
          .filter((f) => {
            if (f.id === folderContextMenu.data!.id) return false
            const nameLower = f.name.toLowerCase()
            const currentNameLower = folderContextMenu.data!.name.toLowerCase()
            if (nameLower.startsWith(currentNameLower + '/')) return false
            return true
          })
          .map((f) => ({
            label: f.name,
            onClick: () => moveFolder(folderContextMenu.data!.id, f.id),
          })),
      ]
    : []

  const folderMenuItems = folderContextMenu.data
    ? [
        {
          label: 'New Note in Folder',
          onClick: () => {
            const id = addNote('', '', folderContextMenu.data!.id)
            onSelectNote(id)
          },
        },
        {
          label: 'New Subfolder',
          onClick: () => {
            const subfolderName = window.prompt(`Create subfolder inside "${folderContextMenu.data!.name}":`)
            if (subfolderName && subfolderName.trim()) {
              const fullName = `${folderContextMenu.data!.name}/${subfolderName.trim()}`
              addFolder(fullName)
            }
          }
        },
        { divider: true },
        {
          label: 'Rename Folder',
          disabled: folderContextMenu.data.id === 'hola-default',
          onClick: () => onRenameFolder(folderContextMenu.data!.id, folderContextMenu.data!.name),
        },
        {
          label: 'Move Folder',
          submenu: folderMoveSubmenu,
          disabled: folderContextMenu.data.id === 'hola-default',
        },
        {
          label: 'Delete Folder',
          danger: true,
          disabled: folderContextMenu.data.id === 'hola-default',
          onClick: () => onDeleteFolder(folderContextMenu.data!.id),
        },
      ]
    : []

  // Tree View and Sorting
  const folderTree = useMemo(() => buildTree(folders, notes), [folders, notes])

  const sortTreeNodes = (nodes: TreeNode[]): TreeNode[] => {
    return [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      if (a.type === 'note' && b.type === 'note') {
        const pinA = a.note?.pinned ? 1 : 0
        const pinB = b.note?.pinned ? 1 : 0
        if (pinA !== pinB) return pinB - pinA
      }
      if (sortBy === 'updated') {
        const timeA = a.type === 'note' ? new Date(a.note?.updatedAt || 0).getTime() : 0
        const timeB = b.type === 'note' ? new Date(b.note?.updatedAt || 0).getTime() : 0
        if (timeA !== timeB) return timeB - timeA
      }
      return a.name.localeCompare(b.name)
    })
  }

  const toggleFolderExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const handleToggleExpandAll = () => {
    const allPaths = folders.map((f) => f.name)
    const allExpanded = allPaths.every((p) => expandedPaths.has(p))
    if (allExpanded || expandedPaths.size > 0) setExpandedPaths(new Set())
    else setExpandedPaths(new Set(allPaths))
  }

  // Active Note Outline Extraction
  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId])
  const outlineHeadings = useMemo(() => {
    if (!activeNote?.content) return []
    const lines = activeNote.content.split('\n')
    const headings: { text: string; level: number }[] = []
    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) headings.push({ level: match[1].length, text: match[2].trim() })
    })
    return headings
  }, [activeNote])

  // Search filter
  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return notes.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
  }, [notes, search])

  return (
    <div className={`w-full md:w-72 lg:w-80 flex-col border-r border-border/40 bg-card/40 backdrop-blur-md select-none ${showSidebar ? 'flex' : 'hidden'}`}>
      
      {/* 1. Header Tab Bar (Obsidian Style) */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-background/30 shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTab('explorer')}
            className={`h-8 w-8 rounded-md transition-colors ${activeTab === 'explorer' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="File Explorer"
          >
            <Files className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTab('outline')}
            className={`h-8 w-8 rounded-md transition-colors ${activeTab === 'outline' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Document Outline"
          >
            <Layers className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveTab('search')}
            className={`h-8 w-8 rounded-md transition-colors ${activeTab === 'search' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="Search Vault"
          >
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onShowSettings} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Settings">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onShowShortcuts} className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex" title="Shortcuts">
            <Keyboard className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 2. Action Toolbar Row */}
      {activeTab === 'explorer' && (
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/10 bg-background/10 shrink-0 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => onNewNote()} className="h-7 w-7 rounded hover:bg-muted/50 hover:text-foreground" title="New Note">
              <SquarePen className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNewFolder} className="h-7 w-7 rounded hover:bg-muted/50 hover:text-foreground" title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSortBy(s => s === 'alphabetical' ? 'updated' : 'alphabetical')} className={`h-7 w-7 rounded hover:bg-muted/50 hover:text-foreground ${sortBy === 'updated' ? 'text-primary' : ''}`} title={`Sort order: ${sortBy}`}>
              <ArrowUpDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleToggleExpandAll} className="h-7 w-7 rounded hover:bg-muted/50 hover:text-foreground" title="Collapse/Expand All">
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </Button>
          </div>
          {onCloseSidebar && (
            <Button variant="ghost" size="icon" onClick={onCloseSidebar} className="h-7 w-7 rounded hover:bg-muted/50 hover:text-foreground" title="Collapse Sidebar">
              <PanelLeftClose className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* 3. Main Panel Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {!isHydrated ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-muted/40 animate-pulse" />
            <div className="h-10 rounded bg-muted/40 animate-pulse" />
            <div className="h-10 rounded bg-muted/40 animate-pulse" />
          </div>
        ) : activeTab === 'explorer' ? (
          /* EXPLORER TREE VIEW */
          <div className="space-y-0.5">
            {sortTreeNodes(folderTree).map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                activeNoteId={activeNoteId}
                onSelectNote={onSelectNote}
                onToggleExpand={toggleFolderExpanded}
                onNoteContextMenu={noteContextMenu.openMenu}
                onFolderContextMenu={folderContextMenu.openMenu}
                sortTreeNodes={sortTreeNodes}
              />
            ))}
            {folderTree.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground/50">
                No folders or files
              </div>
            )}
          </div>
        ) : activeTab === 'outline' ? (
          /* OUTLINE VIEW */
          <div className="space-y-1">
            <h4 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider mb-2 px-1">
              Outline: {activeNote?.title || 'No active note'}
            </h4>
            {outlineHeadings.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                No headings found in note
              </div>
            ) : (
              <div className="space-y-1.5">
                {outlineHeadings.map((h, i) => (
                  <div
                    key={i}
                    style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                    className={`text-xs truncate transition-colors text-muted-foreground/80 hover:text-foreground cursor-pointer ${
                      h.level === 1 ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {h.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* SEARCH VIEW */
          <div className="space-y-3">
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
              <Input
                placeholder="Search notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 bg-muted/30 border-none rounded text-xs focus-visible:ring-1 focus-visible:ring-primary/50"
              />
            </div>

            {search.trim() === '' ? (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                Type query above to search vault
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground/40">
                No matching notes found
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((note) => {
                  const parentFolder = folders.find((f) => f.id === note.folderId)
                  return (
                    <div
                      key={note.id}
                      onClick={() => onSelectNote(note.id)}
                      className={`p-2 rounded text-left cursor-pointer transition-colors border border-transparent ${
                        activeNoteId === note.id
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'hover:bg-muted/40 text-foreground'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{note.title || 'Untitled'}</div>
                      {parentFolder && parentFolder.name !== 'Hola' && (
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">
                          {parentFolder.name}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context Menus */}
      <ContextMenu
        x={noteContextMenu.x}
        y={noteContextMenu.y}
        isOpen={noteContextMenu.isOpen}
        onClose={noteContextMenu.closeMenu}
        items={noteMenuItems}
      />
      <ContextMenu
        x={folderContextMenu.x}
        y={folderContextMenu.y}
        isOpen={folderContextMenu.isOpen}
        onClose={folderContextMenu.closeMenu}
        items={folderMenuItems}
      />
    </div>
  )
}
