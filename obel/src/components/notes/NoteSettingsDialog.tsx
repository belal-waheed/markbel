import { Sliders, Type, List, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useNoteStore } from '@/stores/noteStore'

interface NoteSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NoteSettingsDialog({ open, onOpenChange }: NoteSettingsDialogProps) {
  const noteSettings = useNoteStore((s) => s.noteSettings)
  const updateNoteSettings = useNoteStore((s) => s.updateNoteSettings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border/40 bg-background/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            Note Settings
          </DialogTitle>
          <DialogDescription className="font-medium">
            Customize your writing experience. These settings are synced across your devices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Type className="w-3 h-3" /> Font Size
              </label>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {noteSettings.fontSize}
              </span>
            </div>
            <Select 
              value={noteSettings.fontSize} 
              onValueChange={(val) => val && updateNoteSettings({ fontSize: val })}
            >
              <SelectTrigger className="rounded-xl border-border/20 bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {['14px', '16px', '18px', '20px', '24px'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <List className="w-3 h-3" /> Line Height
              </label>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {noteSettings.lineHeight}
              </span>
            </div>
            <Select 
              value={noteSettings.lineHeight} 
              onValueChange={(val) => val && updateNoteSettings({ lineHeight: val })}
            >
              <SelectTrigger className="rounded-xl border-border/20 bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {['1.2', '1.4', '1.6', '1.8', '2.0'].map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Info className="w-3 h-3" /> Editor Font
            </label>
            <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 text-sm font-medium">
              Using <span className="text-primary font-bold">{noteSettings.fontFamily}</span> as the default font.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl font-bold py-6">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
