import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useShortcutStore, DEFAULT_SHORTCUTS } from '@/stores/shortcutStore'
import { useNoteStore, NOTE_TEMPLATES, type Note } from '@/stores/noteStore'
import { useTaskStore } from '@/stores/taskStore'
import { Button } from '@/components/ui/button'
import { FileText, Minimize2 } from 'lucide-react'
import { useNoteAutoSave } from '@/hooks/useNoteAutoSave'
import { parseSections } from '@/components/ui/markdown/utils'
import {
  FolderSidebar,
  NoteEditor,
  NoteSettingsDialog,
  KeyboardShortcutsDialog,
  TaskCreationDialog,
  NoteCommandMenu
} from '@/components/notes'

export default function NotesPage() {
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const notes = useNoteStore((s) => s.notes)
  const folders = useNoteStore((s) => s.folders)
  const addNote = useNoteStore((s) => s.addNote)
  const updateNote = useNoteStore((s) => s.updateNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const togglePin = useNoteStore((s) => s.togglePin)
  const setColor = useNoteStore((s) => s.setColor)
  const addFolder = useNoteStore((s) => s.addFolder)
  const renameFolder = useNoteStore((s) => s.renameFolder)
  const deleteFolder = useNoteStore((s) => s.deleteFolder)
  const moveNote = useNoteStore((s) => s.moveNote)
  const getSortedNotes = useNoteStore((s) => s.getSortedNotes)
  const syncNoteToServer = useNoteStore((s) => s.syncNoteToServer)
  const activeNoteId = useNoteStore((s) => s.activeNoteId)
  const setActiveNoteId = useNoteStore((s) => s.setActiveNoteId)
  const openNoteIds = useNoteStore((s) => s.openNoteIds)
  const removeOpenNote = useNoteStore((s) => s.removeOpenNote)
  const isZenMode = useNoteStore((s) => s.isZenMode)
  const setIsZenMode = useNoteStore((s) => s.setIsZenMode)
  const hasLoadedNotes = useNoteStore((s) => s.hasLoadedNotes)

  const tasks = useTaskStore((s) => s.tasks)
  const toggleSubtask = useTaskStore((s) => s.toggleSubtask)
  const addSubtask = useTaskStore((s) => s.addSubtask)
  const updateSubtask = useTaskStore((s) => s.updateSubtask)
  const deleteSubtask = useTaskStore((s) => s.deleteSubtask)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)

  const [activeFolderId, setActiveFolderId] = useState<string | null>('hola-default')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit')
  const [isMobile, setIsMobile] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const sidebarBeforeZenRef = useRef(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [selectedTextForTask, setSelectedTextForTask] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [lastSelection, setLastSelection] = useState<any>(null)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')

  useEffect(() => {
    if (useNoteStore.persist.hasHydrated()) setIsHydrated(true)
    const unsubHydrate = useNoteStore.persist.onHydrate(() => setIsHydrated(false))
    const unsubFinish = useNoteStore.persist.onFinishHydration(() => setIsHydrated(true))
    return () => { unsubHydrate(); unsubFinish(); }
  }, [])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isZenMode) document.body.classList.add('zen-mode-active')
    else document.body.classList.remove('zen-mode-active')
    return () => document.body.classList.remove('zen-mode-active')
  }, [isZenMode])

  useEffect(() => {
    if (!isHydrated || !hasLoadedNotes) return

    if (openNoteIds.length === 0) {
      const homeNote = notes.find((n) => n.title.toLowerCase() === 'home')
      if (homeNote) {
        setActiveNoteId(homeNote.id)
      } else {
        const homeContent = `# Home\n\nWelcome to your Obsidian Vault!\n\nThis is your home page. You can customize this note to organize your thoughts, display dashboards, or link to other notes.\n\n## Getting Started\n- Click the folder icon in the sidebar to browse your files.\n- Press \`Ctrl + K\` to open the command palette.\n`
        const defaultFolder = activeFolderId || 'hola-default'
        const homeId = addNote('home', homeContent, defaultFolder)
        setActiveNoteId(homeId)
      }
    }
  }, [isHydrated, hasLoadedNotes, openNoteIds, notes, setActiveNoteId, addNote, activeFolderId])

  const sortedNotes = useMemo(() => getSortedNotes(), [getSortedNotes, notes])
  const filteredNotes = useMemo(() => {
    let base = sortedNotes
    if (activeFolderId) {
      base = base.filter((n) => n.folderId === activeFolderId || (!n.folderId && activeFolderId === 'hola-default'))
    }
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter((n) => (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q))
  }, [sortedNotes, search, activeFolderId])

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId])

  const { scheduleSave, triggerImmediateSave } = useNoteAutoSave({
    activeNoteId,
    activeNote,
    setDraftTitle,
    setDraftContent,
    activeFolderId,
    setActiveFolderId,
    draftTitle,
    draftContent,
    updateNote,
    syncNoteToServer,
  })

  const handleSelectNote = (id: string) => {
    triggerImmediateSave()
    setActiveNoteId(id)
    if (window.innerWidth < 768) setShowSidebar(false)
  }

  const handleNewNote = (templateIndex?: number) => {
    const defaultFolder = activeFolderId || 'hola-default'
    const id = (templateIndex !== undefined && NOTE_TEMPLATES[templateIndex])
      ? addNote(NOTE_TEMPLATES[templateIndex].title, NOTE_TEMPLATES[templateIndex].content, defaultFolder)
      : addNote('', '', defaultFolder)
    setActiveNoteId(id)
    setViewMode('edit')
    if (window.innerWidth < 768) setShowSidebar(false)
  }

  const handleNewFolder = () => {
    const name = window.prompt('Enter folder name:')
    if (name && name.trim()) addFolder(name.trim())
  }

  const handleRenameFolder = (id: string, oldName: string) => {
    const name = window.prompt('Rename folder:', oldName)
    if (name && name.trim()) renameFolder(id, name.trim())
  }

  const handleDeleteFolder = (id: string) => {
    if (id === 'hola-default') return
    if (window.confirm('Delete this folder? Notes inside will be moved to Hola.')) {
      if (activeFolderId === id) setActiveFolderId('hola-default')
      deleteFolder(id)
    }
  }

  const handleBack = () => {
    triggerImmediateSave()
    setShowSidebar(true)
  }

  useKeyboardShortcuts(useMemo(() => {
    const list = []
    if (shortcuts.commandMenu) {
      list.push({
        key: shortcuts.commandMenu.key,
        ctrlKey: shortcuts.commandMenu.ctrlKey,
        altKey: shortcuts.commandMenu.altKey,
        shiftKey: shortcuts.commandMenu.shiftKey,
        metaKey: shortcuts.commandMenu.metaKey,
        action: () => setCommandOpen((prev) => !prev)
      })
    }
    if (shortcuts.toggleSidebar) {
      list.push({
        key: shortcuts.toggleSidebar.key,
        ctrlKey: shortcuts.toggleSidebar.ctrlKey,
        altKey: shortcuts.toggleSidebar.altKey,
        shiftKey: shortcuts.toggleSidebar.shiftKey,
        metaKey: shortcuts.toggleSidebar.metaKey,
        action: () => {
          // Don't toggle sidebar while in zen mode
          if (useNoteStore.getState().isZenMode) return
          setShowSidebar((prev) => !prev)
        }
      })
    }
    if (shortcuts.togglePreview) {
      list.push({
        key: shortcuts.togglePreview.key,
        ctrlKey: shortcuts.togglePreview.ctrlKey,
        altKey: shortcuts.togglePreview.altKey,
        shiftKey: shortcuts.togglePreview.shiftKey,
        metaKey: shortcuts.togglePreview.metaKey,
        action: () => {
          setViewMode((prev) => prev === 'edit' ? 'preview' : 'edit')
        }
      })
    }
    if (shortcuts.toggleZen) {
      list.push({
        key: shortcuts.toggleZen.key,
        ctrlKey: shortcuts.toggleZen.ctrlKey,
        altKey: shortcuts.toggleZen.altKey,
        shiftKey: shortcuts.toggleZen.shiftKey,
        metaKey: shortcuts.toggleZen.metaKey,
        action: () => {
          const currentZen = useNoteStore.getState().isZenMode
          if (!currentZen) {
            // Entering zen: remember sidebar state, then hide it
            sidebarBeforeZenRef.current = showSidebar
            setShowSidebar(false)
          } else {
            // Exiting zen: restore sidebar to its pre-zen state
            setShowSidebar(sidebarBeforeZenRef.current)
          }
          setIsZenMode(!currentZen)
        }
      })
    }
    
    const cycleBinding = shortcuts.cycleTabs || DEFAULT_SHORTCUTS.cycleTabs
    if (cycleBinding) {
      list.push({
        key: cycleBinding.key,
        ctrlKey: cycleBinding.ctrlKey,
        altKey: cycleBinding.altKey,
        shiftKey: cycleBinding.shiftKey,
        metaKey: cycleBinding.metaKey,
        action: () => {
          if (openNoteIds.length > 1 && activeNoteId) {
            const idx = openNoteIds.indexOf(activeNoteId)
            if (idx !== -1) {
              const nextIdx = (idx + 1) % openNoteIds.length
              handleSelectNote(openNoteIds[nextIdx])
            }
          } else if (openNoteIds.length > 0) {
            handleSelectNote(openNoteIds[0])
          }
        }
      })
    }

    const closeBinding = shortcuts.closeNote || DEFAULT_SHORTCUTS.closeNote
    if (closeBinding) {
      list.push({
        key: closeBinding.key,
        ctrlKey: closeBinding.ctrlKey,
        altKey: closeBinding.altKey,
        shiftKey: closeBinding.shiftKey,
        metaKey: closeBinding.metaKey,
        action: () => {
          if (activeNoteId) {
            removeOpenNote(activeNoteId)
          }
        }
      })
    }

    const foldBinding = shortcuts.toggleFold || DEFAULT_SHORTCUTS.toggleFold
    if (foldBinding) {
      list.push({
        key: foldBinding.key,
        ctrlKey: foldBinding.ctrlKey,
        altKey: foldBinding.altKey,
        shiftKey: foldBinding.shiftKey,
        metaKey: foldBinding.metaKey,
        action: () => {
          if (activeNoteId && draftContent) {
            const parsed = parseSections(draftContent)
            const getAllSectionIds = (sections: any[]): string[] => {
              let ids: string[] = []
              sections.forEach((sec) => {
                ids.push(sec.id)
                if (sec.children && sec.children.length > 0) {
                  ids = ids.concat(getAllSectionIds(sec.children))
                }
              })
              return ids
            }
            const allSectionIds = getAllSectionIds(parsed.sections)
            if (allSectionIds.length === 0) return

            const collapsedHeadings = useNoteStore.getState().collapsedHeadings
            const hasAnyCollapsed = allSectionIds.some((sid) => collapsedHeadings[`${activeNoteId}:${sid}`])

            if (hasAnyCollapsed) {
              useNoteStore.getState().expandAllHeadings(activeNoteId)
            } else {
              useNoteStore.getState().collapseAllHeadings(activeNoteId, allSectionIds)
            }
          }
        }
      })
    }

    return list
  }, [shortcuts, isZenMode, setIsZenMode, showSidebar, openNoteIds, activeNoteId, handleSelectNote, removeOpenNote]))

  const handleInsertSnippet = (snippet: string) => {
    setDraftContent((prev) => prev.endsWith('/') ? prev.slice(0, -1) + snippet : prev + snippet)
    if (activeNoteId) scheduleSave(activeNoteId, { content: draftContent + snippet })
    setCommandOpen(false)
  }

  return (
    <div className={`h-[calc(100vh-4rem)] md:h-screen flex overflow-hidden bg-background transition-all duration-500 ${isZenMode ? `fixed inset-0 z-100 h-screen bg-background/95 ${isMobile ? '' : 'backdrop-blur-3xl'}` : ''}`}>
      {isZenMode && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-6 right-6 z-110 text-muted-foreground/50 hover:text-primary transition-all duration-300"
          onClick={() => {
            setIsZenMode(false)
            setShowSidebar(sidebarBeforeZenRef.current)
          }}
        >
          <Minimize2 className="h-5 w-5" />
        </Button>
      )}

      <FolderSidebar
        showSidebar={showSidebar}
        activeFolderId={activeFolderId}
        setActiveFolderId={setActiveFolderId}
        search={search}
        setSearch={setSearch}
        activeNoteId={activeNoteId}
        onSelectNote={handleSelectNote}
        notes={notes}
        folders={folders}
        isHydrated={isHydrated}
        filteredNotes={filteredNotes}
        onShowSettings={() => setShowSettings(true)}
        onShowShortcuts={() => setShowShortcuts(true)}
        onNewNote={handleNewNote}
        onNewFolder={handleNewFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onCloseSidebar={() => setShowSidebar(false)}
      />

      <div className={`flex-1 flex flex-col min-w-0 bg-background overflow-hidden ${!showSidebar ? 'flex' : 'hidden md:flex'}`}>
        {activeNote ? (
          <NoteEditor
            activeNote={activeNote}
            notes={notes}
            folders={folders}
            tasks={tasks}
            toggleSubtask={toggleSubtask}
            addSubtask={addSubtask}
            updateSubtask={updateSubtask}
            deleteSubtask={deleteSubtask}
            addTask={addTask}
            updateTask={updateTask}
            updateNote={updateNote}
            deleteNote={deleteNote}
            togglePin={togglePin}
            setColor={setColor}
            moveNote={moveNote}
            isZenMode={isZenMode}
            setIsZenMode={setIsZenMode}
            isMobile={isMobile}
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            openNoteIds={openNoteIds}
            removeOpenNote={removeOpenNote}
            onSelectNote={handleSelectNote}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onBack={handleBack}
            onCommandOpen={() => setCommandOpen(true)}
            onCreateTaskFromSelection={(text) => {
              setSelectedTextForTask(text)
              setTaskModalOpen(true)
            }}
            draftTitle={draftTitle}
            setDraftTitle={setDraftTitle}
            draftContent={draftContent}
            setDraftContent={setDraftContent}
            scheduleSave={scheduleSave}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground mb-2">Your Vault</h2>
            <p className="text-base text-muted-foreground/60 max-w-sm mb-8">
              Capture your thoughts, ideas, and goals. Select a note or create a new one.
            </p>
            <Button onClick={() => handleNewNote()} size="lg" className="rounded-full px-8 shadow-lg shadow-primary/20">
              + Create Note
            </Button>
          </div>
        )}
      </div>

      <NoteCommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        notes={notes}
        onSelectNote={handleSelectNote}
        onInsertSnippet={handleInsertSnippet}
        onNewNote={handleNewNote}
        onNewFolder={handleNewFolder}
      />

      <NoteSettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />
      <TaskCreationDialog open={taskModalOpen} onOpenChange={setTaskModalOpen} selectedText={selectedTextForTask} onSelectedTextChange={setSelectedTextForTask} activeNoteId={activeNoteId} />
    </div>
  )
}
