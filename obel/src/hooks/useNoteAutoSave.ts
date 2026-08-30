import { useEffect, useRef, useCallback } from 'react'
import { type Note } from '@/stores/noteStore'

interface UseNoteAutoSaveProps {
  activeNoteId: string | null
  activeNote: Note | null
  setDraftTitle: (title: string) => void
  setDraftContent: (content: string) => void
  activeFolderId: string | null
  setActiveFolderId: (folderId: string | null) => void
  draftTitle: string
  draftContent: string
  updateNote: (id: string, updates: Partial<Note>) => void
  syncNoteToServer: (id: string) => Promise<void>
}

export function useNoteAutoSave({
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
}: UseNoteAutoSaveProps) {
  const lastIdRef = useRef<string | null>(null)
  const needsSyncRef = useRef<boolean>(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerImmediateSave = useCallback(() => {
    if (saveTimerRef.current && lastIdRef.current) {
      clearTimeout(saveTimerRef.current)
      updateNote(lastIdRef.current, { title: draftTitle || 'Untitled', content: draftContent })
      syncNoteToServer(lastIdRef.current)
      needsSyncRef.current = false
    }
  }, [draftTitle, draftContent, updateNote, syncNoteToServer])

  useEffect(() => {
    if (lastIdRef.current && lastIdRef.current !== activeNoteId && needsSyncRef.current) {
      syncNoteToServer(lastIdRef.current)
      needsSyncRef.current = false
    }
    if (activeNote && activeNote.id !== lastIdRef.current) {
      setDraftTitle(activeNote.title || '')
      setDraftContent(activeNote.content || '')
      lastIdRef.current = activeNote.id
      if (activeNote.folderId && activeNote.folderId !== activeFolderId && activeFolderId !== null) {
        setActiveFolderId(activeNote.folderId)
      }
    } else if (!activeNote) {
      lastIdRef.current = null
    }
  }, [activeNoteId, activeNote, activeFolderId, syncNoteToServer, setDraftTitle, setDraftContent, setActiveFolderId])

  useEffect(() => {
    const timer = setInterval(() => {
      if (needsSyncRef.current && lastIdRef.current) {
        syncNoteToServer(lastIdRef.current)
        needsSyncRef.current = false
      }
    }, 15000)

    const handleUnload = () => {
      if (needsSyncRef.current && lastIdRef.current) {
        syncNoteToServer(lastIdRef.current)
        needsSyncRef.current = false
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleUnload)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleUnload)
      handleUnload()
    }
  }, [syncNoteToServer])

  const scheduleSave = useCallback((id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'color'>>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    needsSyncRef.current = true
    saveTimerRef.current = setTimeout(() => {
      updateNote(id, updates)
    }, 400)
  }, [updateNote])

  return {
    scheduleSave,
    triggerImmediateSave,
  }
}
