import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStorage } from '@/lib/storage'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { db } from '@/lib/db'
import { useAuthStore } from './authStore'

export type NoteColor = 'none' | 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'pink'

export interface NoteColorConfig {
  label: string
  dot: string
  bg: string
}

export const NOTE_COLORS: Record<NoteColor, NoteColorConfig> = {
  none:   { label: 'Default', dot: 'bg-muted-foreground/30', bg: '' },
  red:    { label: 'Urgent',  dot: 'bg-red-500',   bg: 'border-l-red-500/60' },
  orange: { label: 'Warning', dot: 'bg-orange-500', bg: 'border-l-orange-500/60' },
  green:  { label: 'Ideas',   dot: 'bg-emerald-500', bg: 'border-l-emerald-500/60' },
  blue:   { label: 'Reference', dot: 'bg-blue-500', bg: 'border-l-blue-500/60' },
  purple: { label: 'Personal', dot: 'bg-purple-500', bg: 'border-l-purple-500/60' },
  pink:   { label: 'Creative', dot: 'bg-pink-500',  bg: 'border-l-pink-500/60' },
}

export interface NoteFolder {
  id: string
  name: string
}

export interface Note {
  id: string
  userId: string
  title: string
  content: string
  pinned: boolean
  color: NoteColor
  folderId?: string
  linkedTaskIds?: string[]
  audioMap?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface NoteTemplate {
  name: string
  icon: string
  title: string
  content: string
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    name: 'Meeting Notes',
    icon: '📋',
    title: 'Meeting Notes',
    content: `## Meeting Notes\n\n**Date:** ${new Date().toLocaleDateString()}\n**Attendees:** \n\n---\n\n### Agenda\n- \n\n### Discussion\n\n\n### Action Items\n- [ ] \n- [ ] \n\n### Next Steps\n`,
  },
  {
    name: 'Daily Journal',
    icon: '📓',
    title: `Journal — ${new Date().toLocaleDateString()}`,
    content: `# Daily Journal\n\n## 🎯 Today's Goals\n- [ ] \n- [ ] \n- [ ] \n\n## 💭 Reflections\n\n\n## 🙏 Grateful For\n1. \n2. \n3. \n\n## 📝 Notes\n`,
  },
  {
    name: 'Project Brief',
    icon: '🚀',
    title: 'Project Brief',
    content: `# Project Brief\n\n## Overview\n\n\n## Tasks\n1. \n2. \n3. \n\n## Scope\n\n\n## Timeline\n| Phase | Deadline | Status |\n|-------|----------|--------|\n| Planning | | 🟡 |\n| Development | | ⬜ |\n| Testing | | ⬜ |\n| Launch | | ⬜ |\n\n## Resources\n- \n\n## Risks\n- \n`,
  },
  {
    name: 'Quick List',
    icon: '✅',
    title: 'Quick List',
    content: `## Quick List\n\n- [ ] \n- [ ] \n- [ ] \n- [ ] \n- [ ] \n`,
  },
  {
    name: 'Code Snippet',
    icon: '💻',
    title: 'Code Snippet',
    content: "# Code Snippet\n\n## Description\n\n\n## Code\n```\n\n```\n\n## Notes\n- \n",
  },
]

/** Merge API notes with local notes for offline-first. */
function mergeNotes(
  apiNotes: Note[],
  localNotes: Note[],
  userId: string,
  pendingIds: Set<string>
): Note[] {
  const localMap = new Map(localNotes.filter(n => n.userId === userId).map((n) => [n.id, n]))
  const apiIds = new Set(apiNotes.map((n) => n.id))
  
  const merged = apiNotes.map(apiNote => {
    const localNote = localMap.get(apiNote.id)
    if (!localNote) return apiNote

    // Resolve conflict by updatedAt
    const apiTime = new Date(apiNote.updatedAt || apiNote.createdAt).getTime()
    const localTime = new Date(localNote.updatedAt || localNote.createdAt).getTime()
    
    if (apiTime > localTime) {
      // If server is newer, use server metadata but keep local content 
      // if server doesn't provide it (which it doesn't in the list view)
      return {
        ...apiNote,
        content: apiNote.content !== undefined && apiNote.content !== null ? apiNote.content : localNote.content
      }
    } else if (localTime > apiTime) {
      return localNote
    }

    // If timestamps are equal, merge metadata but preserve local content if server didn't supply it
    return {
      ...apiNote,
      content: apiNote.content !== undefined && apiNote.content !== null ? apiNote.content : localNote.content
    }
  })

  // Add notes that are only on local (like temp- notes or offline created notes)
  const localOnly = localNotes.filter(n => 
    n.userId === userId && 
    !apiIds.has(n.id) && 
    (n.id.startsWith('temp-') || pendingIds.has(n.id))
  )

  return [...merged, ...localOnly]
}

/** Lightweight normalization to ensure array fields exist. */
function normalizeNote(note: any): Note {
  const n = { ...note }
  if (typeof n.linkedTaskIds === 'string') {
    try { n.linkedTaskIds = JSON.parse(n.linkedTaskIds) } catch { n.linkedTaskIds = [] }
  }
  if (!Array.isArray(n.linkedTaskIds)) n.linkedTaskIds = []

  if (typeof n.audioMap === 'string') {
    try { n.audioMap = JSON.parse(n.audioMap) } catch { n.audioMap = {} }
  }
  if (!n.audioMap || typeof n.audioMap !== 'object') n.audioMap = {}

  return n as Note
}

interface NoteState {
  notes: Note[]
  folders: NoteFolder[]
  activeNoteId: string | null
  setActiveNoteId: (id: string | null) => void
  openNoteIds: string[]
  addOpenNote: (id: string) => void
  removeOpenNote: (id: string) => void
  clearOpenNotes: () => void
  getBacklinks: (noteId: string) => Note[]
  fetchNotes: () => Promise<void>
  addNote: (title?: string, content?: string, folderId?: string) => string
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  togglePin: (id: string) => void
  setColor: (id: string, color: NoteColor) => void
  addFolder: (name: string) => void
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  moveFolder: (folderId: string, parentFolderId: string | undefined) => void
  moveNote: (noteId: string, folderId: string | undefined) => void
  getSortedNotes: () => Note[]
  noteSettings: {
    fontSize: string
    lineHeight: string
    editorTheme: string
    fontFamily: string
  }
  updateNoteSettings: (settings: Partial<NoteState['noteSettings']>) => Promise<void>
  isZenMode: boolean
  setIsZenMode: (val: boolean) => void
  fetchNoteContent: (id: string) => Promise<void>
  syncNoteToServer: (id: string) => Promise<void>
  collapsedHeadings: Record<string, boolean>
  toggleHeadingCollapse: (noteId: string, sectionId: string) => void
  setHeadingCollapsed: (noteId: string, sectionId: string, collapsed: boolean) => void
  collapseAllHeadings: (noteId: string, sectionIds: string[]) => void
  expandAllHeadings: (noteId: string) => void
  hasLoadedNotes: boolean
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set, get) => ({
      notes: [],
      folders: [{ id: 'hola-default', name: 'Hola' }],
      activeNoteId: null,
      openNoteIds: [],
      isZenMode: false,
      setIsZenMode: (val) => set({ isZenMode: val }),
      collapsedHeadings: {},
      hasLoadedNotes: false,
      toggleHeadingCollapse: (noteId, sectionId) => {
        const key = `${noteId}:${sectionId}`
        set((state) => ({
          collapsedHeadings: {
            ...state.collapsedHeadings,
            [key]: !state.collapsedHeadings[key]
          }
        }))
      },
      setHeadingCollapsed: (noteId, sectionId, collapsed) => {
        const key = `${noteId}:${sectionId}`
        set((state) => ({
          collapsedHeadings: {
            ...state.collapsedHeadings,
            [key]: collapsed
          }
        }))
      },
      collapseAllHeadings: (noteId, sectionIds) => {
        set((state) => {
          const updated = { ...state.collapsedHeadings }
          sectionIds.forEach((sid) => {
            updated[`${noteId}:${sid}`] = true
          })
          return { collapsedHeadings: updated }
        })
      },
      expandAllHeadings: (noteId) => {
        set((state) => {
          const updated = { ...state.collapsedHeadings }
          Object.keys(updated).forEach((key) => {
            if (key.startsWith(`${noteId}:`)) {
              delete updated[key]
            }
          })
          return { collapsedHeadings: updated }
        })
      },
      noteSettings: {
        fontSize: '16px',
        lineHeight: '1.6',
        editorTheme: 'atomone',
        fontFamily: 'Google Sans Code'
      },

      setActiveNoteId: (id) => {
        set({ activeNoteId: id })
        if (id) {
          get().addOpenNote(id)
          // Lazily fetch content if it's missing (metadata-only)
          const note = get().notes.find(n => n.id === id)
          if (note && note.content === undefined && !id.startsWith('temp-')) {
            get().fetchNoteContent(id)
          }
        }
      },

      addOpenNote: (id) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
        if (isMobile) {
          set({ openNoteIds: [id] })
          useAuthStore.getState().updateUser({ openNoteIds: [id] })
          return
        }

        const { openNoteIds } = get()
        if (!openNoteIds.includes(id)) {
          const newIds = [...openNoteIds, id]
          set({ openNoteIds: newIds })
          useAuthStore.getState().updateUser({ openNoteIds: newIds })
        }
      },

      removeOpenNote: (id) => {
        const { openNoteIds, activeNoteId } = get()
        const newIds = openNoteIds.filter((oid) => oid !== id)
        
        let newActiveId = activeNoteId
        if (activeNoteId === id) {
          newActiveId = newIds.length > 0 ? newIds[newIds.length - 1] : null
        }
        
        set({ openNoteIds: newIds, activeNoteId: newActiveId })
        useAuthStore.getState().updateUser({ openNoteIds: newIds })
      },

      clearOpenNotes: () => {
        set({ openNoteIds: [], activeNoteId: null })
        useAuthStore.getState().updateUser({ openNoteIds: [] })
      },

      getBacklinks: (noteId) => {
        const target = get().notes.find(n => n.id === noteId)
        if (!target || !target.title) return []
        const titleQuery = `[[${target.title}]]`.toLowerCase()
        return get().notes.filter(n => 
          n.id !== noteId && 
          (n.content || '').toLowerCase().includes(titleQuery)
        )
      },

      fetchNotes: async () => {
        const user = useAuthStore.getState().user
        if (!user?.id) {
          set({ hasLoadedNotes: true })
          return
        }

        // 1. Load from local database (Dexie) first (Offline-first hydration!)
        let localNotes: Note[] = []
        try {
          localNotes = await db.notes.where({ userId: user.id }).toArray()
          set({ notes: localNotes.map(normalizeNote), hasLoadedNotes: true })
        } catch (err) {
          console.error('[NoteStore] Failed to load local notes from Dexie:', err)
          set({ hasLoadedNotes: true })
        }

        // Hydrate folders from user profile — trust the server
        let parsedFolders: NoteFolder[] = [{ id: 'hola-default', name: 'Hola' }]
        if (user.noteFolders !== undefined && user.noteFolders !== null) {
          let folders: any = user.noteFolders
          if (typeof folders === 'string') {
            try { folders = JSON.parse(folders) } catch { folders = [] }
          }
          if (Array.isArray(folders) && folders.length > 0) {
            parsedFolders = folders
          }
        }
        set({ folders: parsedFolders })

        // ── OFFLINE GUARD ─────────────────────────────────────────────
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.log('[NoteStore] Offline, skipping fetchNotes network request.');
          return;
        }

        try {
          const apiNotes = await apiGet<Note[]>(`/notes?userId=${user.id}`)
          const normalizedApi = (Array.isArray(apiNotes) ? apiNotes : []).map(normalizeNote)
          
          // Get all pending sync queue items to identify local-only unsynced notes
          const pendingIds = new Set<string>()
          try {
            const queue = await db.syncQueue.toArray()
            for (const item of queue) {
              if (item.payload && (item.payload as any).id) {
                pendingIds.add((item.payload as any).id)
              } else {
                const parts = item.path.split('/')
                const lastPart = parts[parts.length - 1]
                if (lastPart) pendingIds.add(lastPart)
              }
            }
          } catch (err) {
            console.error('[NoteStore] Failed to read sync queue:', err)
          }

          // Merge logic: Resolve conflicts by updatedAt
          const currentNotes = get().notes
          const merged = mergeNotes(
            normalizedApi,
            currentNotes,
            user.id,
            pendingIds
          )
          
          // Bulk update Dexie with merged notes (so we don't wipe out content!)
          for (const note of merged) {
            await db.notes.put(note)
          }

          // Delete notes from Dexie that are no longer in the merged set (meaning they were deleted on the server)
          const mergedIds = new Set(merged.map(n => n.id))
          const deletedIds = currentNotes
            .filter(n => n.userId === user.id && !mergedIds.has(n.id))
            .map(n => n.id)

          for (const id of deletedIds) {
            await db.notes.delete(id).catch(() => {})
          }

          // Also sync noteSettings from user profile if available
          if (user.noteSettings) {
            set({ noteSettings: { ...get().noteSettings, ...user.noteSettings } })
          }

          set({ notes: merged })
        } catch (error) {
          console.warn('Note fetch failed, using local data', error)
        }
      },

      fetchNoteContent: async (id: string) => {
        try {
          const fullNote = await apiGet<Note>(`/notes/${id}`)
          if (fullNote && fullNote.content !== undefined) {
            const updatedNotes = get().notes.map((n) => (n.id === id ? { ...n, content: fullNote.content } : n))
            set({ notes: updatedNotes })
            // Sync content update to Dexie too
            const note = updatedNotes.find(n => n.id === id)
            if (note) {
              await db.notes.put(note)
            }
          }
        } catch (error) {
          console.error('Failed to fetch note content:', error)
        }
      },

      addNote: (title?: string, content?: string, folderId?: string) => {
        const userId = useAuthStore.getState().user?.id || ''
        const id = crypto.randomUUID() // Client-generated authoritative UUID
        const now = new Date().toISOString()
        
        // Ensure title is unique
        let finalTitle = (title || 'Untitled').trim().replace(/\s+/g, '_')
        const existingTitles = get().notes.map(n => n.title.toLowerCase())
        if (existingTitles.includes(finalTitle.toLowerCase())) {
          let counter = 1
          let candidate = finalTitle
          while (existingTitles.includes(candidate.toLowerCase())) {
            candidate = `${finalTitle}_${++counter}`
          }
          finalTitle = candidate
        }

        const note: Note = {
          id,
          userId,
          title: finalTitle,
          content: content || '',
          pinned: false,
          color: 'none',
          folderId: folderId || 'hola-default',
          linkedTaskIds: [],
          createdAt: now,
          updatedAt: now,
        }

        set((s) => ({ notes: [note, ...s.notes] }))

        if (userId) {
          // Write to local database (Dexie)
          db.notes.put(note).catch(err => console.error('Dexie save error:', err))

          apiPost<Note>('/notes', note)
            .then((saved) => {
              if (saved) {
                const normalized = normalizeNote(saved)
                db.notes.put(normalized).catch(() => {})
                set((s) => ({
                  notes: s.notes.map((n) => (n.id === id ? normalized : n))
                }))
              }
            })
            .catch(async () => {
              console.warn('Network error: addNote stored locally for background sync')
              await db.queueSync('/notes', 'POST', note)
            })
        }

        return id
      },

      updateNote: (id, updates) => {
        const now = new Date().toISOString()
        const note = get().notes.find((n) => n.id === id)
        if (!note) return

        if (updates.title !== undefined) {
          updates.title = updates.title.trim().replace(/\s+/g, '_')
        }

        const updated = { ...note, ...updates, updatedAt: now }

        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? updated : n)),
        }))

        // Save to Dexie
        db.notes.put(updated).catch(err => console.error('Dexie update error:', err))
      },

      syncNoteToServer: async (id) => {
        if (!id) return
        const note = get().notes.find((n) => n.id === id)
        if (!note) return

        try {
          const updated = await apiPut<Note>(`/notes/${id}`, {
            id: note.id,
            title: note.title,
            content: note.content,
            color: note.color,
            pinned: note.pinned,
            folderId: note.folderId,
            linkedTaskIds: note.linkedTaskIds,
            audioMap: note.audioMap,
            updatedAt: note.updatedAt
          })
          const normalized = normalizeNote(updated)
          await db.notes.put(normalized)
          set((s) => ({
            notes: s.notes.map((n) => (n.id === id ? normalized : n)),
          }))
        } catch (error) {
          console.warn('Network error: syncNoteToServer queued for background sync', error)
          await db.queueSync(`/notes/${id}`, 'PUT', {
            id: note.id,
            title: note.title,
            content: note.content,
            color: note.color,
            pinned: note.pinned,
            folderId: note.folderId,
            linkedTaskIds: note.linkedTaskIds,
            audioMap: note.audioMap,
            updatedAt: note.updatedAt
          })
        }
      },

      deleteNote: (id) => {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
        db.notes.delete(id).catch(err => console.error('Dexie delete error:', err))

        // Bidirectional Link Cleanup: Remove this note ID from all tasks
        import('./taskStore').then(({ useTaskStore }) => {
          useTaskStore.setState((s: any) => ({
            tasks: s.tasks.map((t: any) => ({
              ...t,
              linkedNoteIds: t.linkedNoteIds?.filter((nid: string) => nid !== id) || [],
            })),
          }))
        }).catch(() => {})

        apiDelete(`/notes/${id}`)
          .catch(async () => {
            console.warn('Network error: deleteNote queued for background sync')
            await db.queueSync(`/notes/${id}`, 'DELETE', null)
          })
      },

      togglePin: (id) => {
        const note = get().notes.find((n) => n.id === id)
        if (!note) return
        get().updateNote(id, { pinned: !note.pinned })
        get().syncNoteToServer(id)
      },

      setColor: (id, color) => {
        get().updateNote(id, { color })
        get().syncNoteToServer(id)
      },

      getNoteById: (id: string) => get().notes.find((n) => n.id === id),

      getSortedNotes: () => {
        const notes = [...get().notes]
        return notes.sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
      },

      addFolder: async (name: string) => {
        const id = crypto.randomUUID()
        const newFolder: NoteFolder = { id, name }
        const newFolders = [...get().folders, newFolder]
        set({ folders: newFolders })
        await useAuthStore.getState().updateUser({ noteFolders: newFolders })
      },

      renameFolder: async (id: string, newName: string) => {
        const currentFolder = get().folders.find((f) => f.id === id)
        if (!currentFolder) return
        const oldName = currentFolder.name

        const newFolders = get().folders.map((f) => {
          if (f.id === id) {
            return { ...f, name: newName }
          }
          if (f.name === oldName || f.name.startsWith(oldName + '/')) {
            const suffix = f.name.slice(oldName.length)
            return { ...f, name: newName + suffix }
          }
          return f
        })
        set({ folders: newFolders })
        await useAuthStore.getState().updateUser({ noteFolders: newFolders })
      },

      deleteFolder: async (id: string) => {
        if (id === 'hola-default') return // Protect default folder
        const currentFolder = get().folders.find((f) => f.id === id)
        if (!currentFolder) return
        const folderName = currentFolder.name

        const foldersToDelete = get().folders.filter(
          (f) => f.id === id || f.name.startsWith(folderName + '/')
        )
        const deleteIds = new Set(foldersToDelete.map((f) => f.id))

        const newFolders = get().folders.filter((f) => !deleteIds.has(f.id))
        set({ folders: newFolders })
        await useAuthStore.getState().updateUser({ noteFolders: newFolders })

        // Move all notes in all deleted folders to the default folder and sync them to server
        const affectedNotes = get().notes.filter((n) => n.folderId && deleteIds.has(n.folderId))
        for (const n of affectedNotes) {
          get().updateNote(n.id, { folderId: 'hola-default' })
          await get().syncNoteToServer(n.id)
        }
      },

      moveFolder: async (folderId: string, parentFolderId: string | undefined) => {
        const folders = get().folders
        const folderToMove = folders.find((f) => f.id === folderId)
        if (!folderToMove) return

        const parts = folderToMove.name.split('/')
        const leafName = parts[parts.length - 1]

        let newName = leafName
        if (parentFolderId && parentFolderId !== 'root') {
          const parentFolder = folders.find((f) => f.id === parentFolderId)
          if (!parentFolder) return
          newName = `${parentFolder.name}/${leafName}`
        }

        // Prevent name conflicts by checking if the name already exists
        let candidateName = newName
        let counter = 1
        while (folders.some((f) => f.name.toLowerCase() === candidateName.toLowerCase() && f.id !== folderId)) {
          candidateName = `${newName}_${counter++}`
        }
        newName = candidateName

        await get().renameFolder(folderId, newName)
      },

      moveNote: (noteId: string, folderId: string | undefined) => {
        get().updateNote(noteId, { folderId: folderId || 'hola-default' })
        get().syncNoteToServer(noteId)
      },

      updateNoteSettings: async (settings) => {
        const newSettings = { ...get().noteSettings, ...settings }
        set({ noteSettings: newSettings })
        
        // Persist to user profile on backend
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          await useAuthStore.getState().updateUser({ noteSettings: newSettings })
        }
      },
    }),
    {
      name: 'obel-notes',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({ 
        activeNoteId: state.activeNoteId,
        openNoteIds: state.openNoteIds,
        noteSettings: state.noteSettings,
        collapsedHeadings: state.collapsedHeadings
      }),
    }
  )
)
