import { useState, useEffect } from "react";
import { ArrowRight, Plus, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  useTaskStore,
  type TaskStatus,
  type Task,
  type Subtask,
} from "@/stores/taskStore";
import { useNoteStore } from "@/stores/noteStore";

import dayjs from "dayjs";

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTask: Task | null;
}

export function TaskFormModal({
  isOpen,
  onClose,
  editingTask,
}: TaskFormModalProps) {
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const lists = useTaskStore((state) => state.lists);
  const notes = useNoteStore((state) => state.notes);
  const addNote = useNoteStore((state) => state.addNote);

  const [formTitle, setFormTitle] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStatus>("todo");
  const [formSubtasks, setFormSubtasks] = useState<Subtask[]>([]);
  const [formListId, setFormListId] = useState<string>("");
  const [formScheduledTime, setFormScheduledTime] = useState("");
  const [formLinkedNoteIds, setFormLinkedNoteIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setFormTitle(editingTask.title);
        setFormTags(editingTask.tags.join(", "));
        setFormDueDate(editingTask.dueDate || "");
        setFormStatus(editingTask.status);
        setFormSubtasks(editingTask.subtasks || []);
        setFormListId(editingTask.listId || "");
        setFormScheduledTime(editingTask.scheduledTime || "");
        setFormLinkedNoteIds(editingTask.linkedNoteIds || []);
      } else {
        setFormTitle("");
        setFormTags("");
        setFormDueDate(dayjs().format("YYYY-MM-DD")); // Default deadline to today
        setFormStatus("todo");
        setFormSubtasks([]);
        setFormListId("imp"); // Default to IMP
        setFormScheduledTime("");
        setFormLinkedNoteIds([]);
      }
    }
  }, [isOpen, editingTask]);

  const handleSave = () => {
    if (!formTitle.trim()) return;
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingTask) {
      updateTask(editingTask.id, {
        title: formTitle,
        tags,
        dueDate: formDueDate || undefined,
        status: formStatus,
        subtasks: formSubtasks,
        listId: formListId || undefined,
        scheduledTime: formScheduledTime || undefined,
        linkedNoteIds: formLinkedNoteIds,
      });
    } else {
      addTask({
        title: formTitle,
        tags,
        subtasks: formSubtasks,
        dueDate: formDueDate || undefined,
        status: formStatus,
        listId: formListId || undefined,
        scheduledTime: formScheduledTime || undefined,
        linkedNoteIds: formLinkedNoteIds,
      });
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Ensure modal z-index doesn't conflict with Select drop-downs */}
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-2xl rounded-3xl z-100">
        <div className="px-6 py-5 border-b border-border/50 bg-muted/20">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {editingTask ? "Edit Task" : "Define New Task"}
          </DialogTitle>
        </div>
        <div className="px-6 py-6 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
          <div>
            <div className="mb-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Task Title
              </label>
            </div>
            <Input
              placeholder="What do you need to accomplish?"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              autoFocus
              className="h-11 text-base font-semibold bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/30 shadow-xs"
            />
          </div>

          {/* Subtasks Section - More Compact */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Actionable Steps
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => {
                  const newSubtask: Subtask = {
                    id: Math.random().toString(36).substring(2, 11),
                    title: "",
                    completed: false,
                  };
                  setFormSubtasks([...formSubtasks, newSubtask]);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {formSubtasks.length > 0 && (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                {formSubtasks.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex gap-2 group animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    <Input
                      placeholder={`Step ${idx + 1}...`}
                      value={st.title}
                      onChange={(e) => {
                        const updated = [...formSubtasks];
                        updated[idx].title = e.target.value;
                        setFormSubtasks(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const newSubtask: Subtask = {
                            id: Math.random().toString(36).substring(2, 11),
                            title: "",
                            completed: false,
                          };
                          setFormSubtasks([...formSubtasks, newSubtask]);
                          // Use setTimeout to allow React to render the new input before focusing
                          setTimeout(() => {
                            const inputs =
                              document.querySelectorAll(".subtask-input");
                            if (inputs.length > 0) {
                              (
                                inputs[inputs.length - 1] as HTMLInputElement
                              ).focus();
                            }
                          }, 10);
                        }
                      }}
                      className="subtask-input h-9 text-xs bg-background/30 border-border/30 rounded-lg focus-visible:ring-primary/20"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => {
                        setFormSubtasks(
                          formSubtasks.filter((s) => s.id !== st.id),
                        );
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                List / Category
              </label>
              <Select
                value={formListId}
                onValueChange={(v) => setFormListId(v || "")}
              >
                <SelectTrigger className="h-11 bg-background/50 border-border/50 rounded-xl text-sm font-semibold">
                  <span className="flex flex-1 text-left line-clamp-1">
                    {lists.find((l) => l.id === formListId)?.title ||
                      "Select a list"}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Deadline
              </label>
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="h-11 bg-background/50 border-border/50 rounded-xl text-sm font-semibold focus-visible:ring-primary/30 w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Notification Time (Optional)
              </label>
              <Input
                type="time"
                value={formScheduledTime}
                onChange={(e) => setFormScheduledTime(e.target.value)}
                className="h-11 bg-background/50 border-border/50 rounded-xl text-sm font-semibold focus-visible:ring-primary/30 w-full"
              />
            </div>
          </div>

          {/* Linked Vault Notes */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Linked Vault Notes
            </label>
            <div className="space-y-2">
              {formLinkedNoteIds.map((noteId) => {
                const note = notes.find((n) => n.id === noteId);
                if (!note) return null;
                return (
                  <div
                    key={noteId}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20 group animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground/90 truncate">
                        {note.title || "Untitled Note"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      onClick={() =>
                        setFormLinkedNoteIds(
                          formLinkedNoteIds.filter((id) => id !== noteId),
                        )
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}

              <Select
                value=""
                onValueChange={(val) => {
                  if (val === "NEW") {
                    const newNoteId = addNote(
                      formTitle || "New Linked Note",
                    );
                    setFormLinkedNoteIds([...formLinkedNoteIds, newNoteId]);
                  } else if (val && !formLinkedNoteIds.includes(val)) {
                    setFormLinkedNoteIds([...formLinkedNoteIds, val]);
                  }
                }}
              >
                <SelectTrigger className="w-full h-10 border-dashed border-border/30 bg-transparent hover:bg-muted/15 text-muted-foreground rounded-xl justify-center shadow-none transition-all">
                  <div className="flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Link or Create Note
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 max-h-[220px]">
                  <SelectItem
                    value="NEW"
                    className="font-bold text-primary focus:text-primary focus:bg-primary/10 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Create New Note
                    </div>
                  </SelectItem>
                  {notes.filter((n) => !formLinkedNoteIds.includes(n.id))
                    .length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[9px] uppercase font-bold text-muted-foreground/60 mt-1.5 px-3 py-1">
                        Existing Notes
                      </SelectLabel>
                      {notes
                        .filter((n) => !formLinkedNoteIds.includes(n.id))
                        .map((n) => (
                          <SelectItem
                            key={n.id}
                            value={n.id}
                            className="font-semibold text-xs py-2"
                          >
                            {n.title}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Tags
            </label>
            <Input
              placeholder="design, coding, meeting..."
              value={formTags}
              onChange={(e) => setFormTags(e.target.value)}
              className="h-11 bg-background/50 border-border/50 rounded-xl text-sm font-semibold focus-visible:ring-primary/30"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
          <Button
            variant="outline"
            className="h-11 px-5 rounded-xl font-bold border-border/50 text-sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="h-11 px-7 rounded-xl font-black text-sm gap-2 shadow-lg shadow-primary/25"
            onClick={handleSave}
            disabled={!formTitle.trim()}
          >
            {editingTask ? "Save Changes" : "Create Task"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
