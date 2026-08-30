import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bold, Italic, Code, Link2, List, Quote, CheckSquare } from 'lucide-react'
import { Button } from './button'

interface FloatingToolbarProps {
  editorView: any
  onCreateTask?: (text: string) => void
}

export function FloatingToolbar({ editorView, onCreateTask }: FloatingToolbarProps) {
  const [show, setShow] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    if (!editorView) return
    const { state } = editorView
    const { from, to } = state.selection.main
    
    if (from === to) {
      setShow(false)
      return
    }

    const startRect = editorView.coordsAtPos(from)
    const endRect = editorView.coordsAtPos(to)
    
    if (startRect && endRect) {
      let left = (startRect.left + endRect.left) / 2
      let top = startRect.top - 50 // 50px above the selection
      
      // Keep within bounds
      if (top < 60) top = startRect.bottom + 10 // push below if too high
      if (left < 100) left = 100 // keep off left edge
      if (left > window.innerWidth - 100) left = window.innerWidth - 100 // keep off right edge
      
      setPosition({ top, left })
      setShow(true)
    }
  }, [editorView])

  useEffect(() => {
    if (!editorView) return
    
    const handleUpdate = () => {
      updatePosition()
    }

    window.addEventListener('selectionchange', handleUpdate)
    editorView.dom.addEventListener('mouseup', handleUpdate)
    editorView.dom.addEventListener('keyup', handleUpdate)

    return () => {
      window.removeEventListener('selectionchange', handleUpdate)
      editorView.dom.removeEventListener('mouseup', handleUpdate)
      editorView.dom.removeEventListener('keyup', handleUpdate)
    }
  }, [editorView, updatePosition])

  const applyFormat = (prefix: string, suffix: string = prefix) => {
    if (!editorView) return
    const { state } = editorView
    const { from, to } = state.selection.main
    const text = state.doc.sliceString(from, to)
    
    editorView.dispatch({
      changes: { from, to, insert: `${prefix}${text}${suffix}` },
      selection: { anchor: from + prefix.length + text.length + suffix.length }
    })
    editorView.focus()
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
          className="flex items-center gap-0.5 p-1 bg-card/90 backdrop-blur-xl border border-border/50 rounded-lg shadow-2xl premium-shadow"
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('**')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('*')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('`')}
          >
            <Code className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('[[', ']]')}
          >
            <Link2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('> ')}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
            onClick={() => applyFormat('- ')}
          >
            <List className="h-4 w-4" />
          </Button>
          {onCreateTask && (
            <>
              <div className="w-px h-4 bg-border/50 mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => {
                  if (editorView) {
                    const { state } = editorView
                    const { from, to } = state.selection.main
                    const text = state.doc.sliceString(from, to)
                    onCreateTask(text)
                  }
                }}
                title="Create Task from Selection"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
