import { useState, useEffect, useMemo } from 'react'
import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useShortcutStore, DEFAULT_SHORTCUTS, type ShortcutBinding } from '@/stores/shortcutStore'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const updateShortcut = useShortcutStore((s) => s.updateShortcut)
  const resetShortcuts = useShortcutStore((s) => s.resetShortcuts)
  const [rebindingAction, setRebindingAction] = useState<string | null>(null)

  useEffect(() => {
    if (!rebindingAction || !open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setRebindingAction(null)
        return
      }

      // Ignore solo modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return
      }

      const binding: ShortcutBinding = {
        key: e.key.toLowerCase(),
        ctrlKey: e.ctrlKey || e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey
      }

      updateShortcut(rebindingAction, binding)
      setRebindingAction(null)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [rebindingAction, updateShortcut, open])

  const formatShortcut = (binding: ShortcutBinding) => {
    if (!binding) return ''
    const parts: string[] = []
    if (binding.ctrlKey) parts.push('Ctrl')
    if (binding.altKey) parts.push('Alt')
    if (binding.shiftKey) parts.push('Shift')
    parts.push(binding.key.toUpperCase())
    return parts.join(' + ')
  }

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val)
    if (!val) setRebindingAction(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border/40 bg-background/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="font-medium">
            Customize and rebind your hotkeys for fast vault navigation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Navigation & Views</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetShortcuts}
                className="h-6 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md"
              >
                Reset All
              </Button>
            </div>
            <div className="space-y-1.5">
              {[
                { id: 'toggleSidebar', label: 'Toggle Sidebar' },
                { id: 'commandMenu', label: 'Command & Search Menu' },
                { id: 'quickSearch', label: 'Quick Search / Switcher' },
                { id: 'togglePreview', label: 'Toggle Edit / Reading Mode' },
                { id: 'toggleZen', label: 'Toggle Zen Mode' },
                { id: 'cycleTabs', label: 'Cycle Open Tabs' },
                { id: 'closeNote', label: 'Close Active Note' },
                { id: 'toggleFold', label: 'Toggle Collapse All Headings' }
              ].map(({ id, label }) => {
                const binding = shortcuts[id] || DEFAULT_SHORTCUTS[id];
                const isRebinding = rebindingAction === id;
                return (
                  <div key={id} className="flex items-center justify-between py-1.5 border-b border-border/10 text-sm">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      {isRebinding ? (
                        <span className="px-2 py-0.5 text-xs font-black text-primary bg-primary/10 border border-primary/20 rounded-lg animate-pulse">
                          Press keys...
                        </span>
                      ) : (
                        <kbd className="px-2 py-0.5 text-xs font-bold font-mono bg-muted border border-border/40 rounded-lg shadow-sm">
                          {formatShortcut(binding)}
                        </kbd>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRebindingAction(isRebinding ? null : id)}
                        className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all ${
                          isRebinding
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'hover:bg-primary/10 hover:text-primary text-muted-foreground'
                        }`}
                      >
                        {isRebinding ? 'Cancel' : 'Rebind'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Editor Actions & Navigation</h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between py-1.5 border-b border-border/10 text-sm">
                <span className="text-muted-foreground">Slash Commands list</span>
                <kbd className="px-2 py-0.5 text-xs font-bold font-mono bg-muted border border-border/40 rounded-lg shadow-sm">/</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/10 text-sm">
                <span className="text-muted-foreground">Link Existing Note</span>
                <kbd className="px-2 py-0.5 text-xs font-bold font-mono bg-muted border border-border/40 rounded-lg shadow-sm">[[</kbd>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)} className="w-full rounded-xl font-bold py-6">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
