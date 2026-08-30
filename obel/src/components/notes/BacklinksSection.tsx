import React from 'react'
import { Link2 } from 'lucide-react'
import { useNoteStore, type Note } from '@/stores/noteStore'
import { getExcerpt } from '@/lib/noteEditorHelpers'

interface BacklinksSectionProps {
  activeNoteId: string
  onSelectNote: (id: string) => void
}

export function BacklinksSection({ activeNoteId, onSelectNote }: BacklinksSectionProps) {
  const notes = useNoteStore((s) => s.notes)

  const backlinks = React.useMemo(() => {
    const targetNote = notes.find(n => n.id === activeNoteId)
    if (!targetNote || !targetNote.title) return []

    const targetTitle = targetNote.title.toLowerCase().trim()
    const targetFirstWord = targetTitle.split(/[_-\s]+/)[0]
    const genericWords = new Set(['a', 'the', 'new', 'untitled', 'temp', 'note', 'my', 'to', 'for', 'in', 'on', 'at', 'by', 'of', 'and', 'or', 'with'])

    return notes.filter(n => {
      if (n.id === activeNoteId) return false

      const content = n.content || ''
      const matches = content.matchAll(/\[\[([^\]]+)\]\]/g)

      for (const match of matches) {
        const linkTitle = match[1].toLowerCase().trim()

        // 1. Exact match
        if (linkTitle === targetTitle) return true

        // 2. First-word match (e.g. obel and obel_2, or obel and obel_components)
        const linkFirstWord = linkTitle.split(/[_-\s]+/)[0]
        if (
          linkFirstWord &&
          targetFirstWord &&
          linkFirstWord === targetFirstWord &&
          !genericWords.has(targetFirstWord) &&
          targetFirstWord.length > 2
        ) {
          return true
        }
      }

      return false
    })
  }, [notes, activeNoteId])

  return (
    <div className="mt-20 pt-10 border-t border-border/20">
      <h4 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Link2 className="w-3 h-3" /> Backlinks
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {backlinks.map(bn => (
          <div 
            key={bn.id}
            onClick={() => onSelectNote(bn.id)}
            className="p-4 rounded-xl border border-border/10 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all group"
          >
            <h5 className="text-sm font-bold mb-1 group-hover:text-primary transition-colors">{bn.title}</h5>
            <p className="text-xs text-muted-foreground line-clamp-2">{getExcerpt(bn.content)}</p>
          </div>
        ))}
        {backlinks.length === 0 && (
          <p className="text-xs text-muted-foreground/40 italic">No notes link to this one yet.</p>
        )}
      </div>
    </div>
  )
}
