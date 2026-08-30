import { motion, AnimatePresence } from 'framer-motion'
import { Link2, FileText } from 'lucide-react'
import { type Note } from '@/stores/noteStore'

interface WikiLinkSuggestionsProps {
  open: boolean
  pos: { top: number; left: number }
  suggestions: Note[]
  selectedIndex: number
  onAccept: (note: Note) => void
  onClose: () => void
}

export function WikiLinkSuggestions({
  open,
  pos,
  suggestions,
  selectedIndex,
  onAccept,
  onClose
}: WikiLinkSuggestionsProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 2000,
          }}
          className="w-64 bg-card/90 backdrop-blur-2xl border border-border/50 rounded-xl shadow-2xl overflow-hidden premium-shadow"
        >
          <div className="p-2 border-b border-border/20 bg-muted/20 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest flex items-center gap-2">
            <Link2 className="h-3 w-3" />
            Link to Note
          </div>
          <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
            {suggestions.map((n, idx) => (
              <div
                key={n.id}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm text-foreground cursor-pointer group transition-all ${
                  idx === selectedIndex ? 'bg-primary/20 shadow-inner' : 'hover:bg-primary/10'
                }`}
                onClick={() => onAccept(n)}
              >
                <FileText className={`h-3.5 w-3.5 text-primary transition-opacity ${idx === selectedIndex ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
                <span className="truncate">{n.title}</span>
              </div>
            ))}
            {suggestions.length === 0 && (
              <div className="p-4 text-xs text-center text-muted-foreground opacity-50 italic">No notes found</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
