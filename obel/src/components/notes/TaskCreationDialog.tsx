import { CheckSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/stores/taskStore'

interface TaskCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedText: string
  onSelectedTextChange: (text: string) => void
  activeNoteId: string | null
}

export function TaskCreationDialog({
  open,
  onOpenChange,
  selectedText,
  onSelectedTextChange,
  activeNoteId
}: TaskCreationDialogProps) {
  const addTask = useTaskStore((s) => s.addTask)

  const handleCreateTask = async () => {
    if (selectedText.trim() && activeNoteId) {
      await addTask({
        title: selectedText.trim(),
        linkedNoteIds: [activeNoteId],
        tags: [],
        subtasks: [],
        status: 'todo',
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border/40 bg-background/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            Create Task from Selection
          </DialogTitle>
          <DialogDescription className="font-medium">
            Create a new task linked to this note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Task Title</label>
            <Input
              value={selectedText}
              onChange={(e) => onSelectedTextChange(e.target.value)}
              className="h-10 rounded-xl bg-muted/30 border-border/20"
              placeholder="Task title..."
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleCreateTask}
            className="rounded-xl font-bold"
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
