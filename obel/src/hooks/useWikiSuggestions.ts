import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { type Note } from '@/stores/noteStore'

interface UseWikiSuggestionsProps {
  notes: Note[]
  activeNoteId: string
  editorRef: React.RefObject<any>
}

export function useWikiSuggestions({
  notes,
  activeNoteId,
  editorRef,
}: UseWikiSuggestionsProps) {
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 })
  const [suggestionIndex, setSuggestionIndex] = useState(0)

  const filteredSuggestions = useMemo(() => {
    return notes
      .filter(
        (n) =>
          n.id !== activeNoteId &&
          n.title.toLowerCase().includes(suggestionQuery.toLowerCase())
      )
      .slice(0, 10)
  }, [notes, activeNoteId, suggestionQuery])

  useEffect(() => {
    setSuggestionIndex(0)
  }, [suggestionQuery])

  const handleAcceptSuggestion = useCallback((note: Note) => {
    const view = editorRef.current?.view
    if (!view) return
    const pos = view.state.selection.main.head
    const line = view.state.doc.lineAt(pos).text
    const lastBracketPos = line.lastIndexOf('[[', pos - view.state.doc.lineAt(pos).from)
    const afterCursor = view.state.doc.sliceString(pos, pos + 2)
    const hasClosing = afterCursor === ']]'
    
    view.dispatch({
      changes: { 
        from: view.state.doc.lineAt(pos).from + lastBracketPos + 2, 
        to: hasClosing ? pos + 2 : pos, 
        insert: `${note.title}]] ` 
      },
      selection: { anchor: view.state.doc.lineAt(pos).from + lastBracketPos + 2 + note.title.length + 3 }
    })
    setSuggestionOpen(false)
    view.focus()
  }, [editorRef])

  useEffect(() => {
    if (!suggestionOpen) return
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault()
          setSuggestionIndex((i) => (i + 1) % filteredSuggestions.length)
        }
      } else if (e.key === 'ArrowUp') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault()
          setSuggestionIndex(
            (i) => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length
          )
        }
      } else if (e.key === 'Enter') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault()
          handleAcceptSuggestion(filteredSuggestions[suggestionIndex])
        }
      } else if (e.key === 'Escape') {
        setSuggestionOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeys, true)
    return () => window.removeEventListener('keydown', handleKeys, true)
  }, [suggestionOpen, filteredSuggestions, suggestionIndex, handleAcceptSuggestion])

  const checkSuggestions = useCallback(() => {
    const view = editorRef.current?.view
    if (!view) return

    const pos = view.state.selection.main.head
    const before = view.state.doc.sliceString(pos - 2, pos)
    const line = view.state.doc.lineAt(pos).text
    const lastBracketPos = line.lastIndexOf('[[', pos - view.state.doc.lineAt(pos).from)
    
    if (before === '[[') {
      setSuggestionOpen(true)
      setSuggestionQuery('')
      const coords = view.coordsAtPos(pos)
      if (coords) setSuggestionPos({ top: coords.top + 20, left: coords.left })
    } else if (suggestionOpen && lastBracketPos !== -1) {
      const query = line.slice(lastBracketPos + 2, pos - view.state.doc.lineAt(pos).from)
      if (query.includes(']')) {
        setSuggestionOpen(false)
      } else {
        setSuggestionQuery(query)
      }
    } else {
      setSuggestionOpen(false)
    }
  }, [suggestionOpen, editorRef])

  return {
    suggestionOpen,
    setSuggestionOpen,
    suggestionPos,
    suggestionIndex,
    filteredSuggestions,
    handleAcceptSuggestion,
    checkSuggestions,
  }
}
