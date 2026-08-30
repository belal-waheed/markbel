import { useState } from "react";
import {
  Play,
  Pause,
  Clock,
  Edit3,
  Trash2,
  Calendar,
  Flame,
  TagIcon,
  Plus,
  X,
  FileText,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useNoteStore } from "@/stores/noteStore";
import dayjs from "dayjs";
import { useToastStore } from "@/stores/toastStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onStartFocus: (taskId: string) => void;
}

export function TaskDetailsModal({
  task: initialTask,
  onClose,
  onEdit,
  onStartFocus,
}: TaskDetailsModalProps) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addSubtask = useTaskStore((state) => state.addSubtask);
  const toggleSubtask = useTaskStore((state) => state.toggleSubtask);
  const updateSubtask = useTaskStore((state) => state.updateSubtask);
  const deleteSubtask = useTaskStore((state) => state.deleteSubtask);
  const lists = useTaskStore((state) => state.lists);
  const showToast = useToastStore((s) => s.showToast);

  // CRITICAL: Get live task from store to handle ID changes during background sync
  const task = useTaskStore(
    (s) => s.tasks.find((t) => t.id === initialTask?.id) || initialTask,
  );

  const navigate = useNavigate();
  const notes = useNoteStore((state) => state.notes);
  const addNote = useNoteStore((state) => state.addNote);
  const addTask = useTaskStore((state) => state.addTask);

  // Inline subtask editing state
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskValue, setEditingSubtaskValue] = useState("");

  if (!task) return null;

  const linkedNotes = notes.filter((n) => task.linkedNoteIds?.includes(n.id));
  const unlinkedNotes = notes.filter(
    (n) => !task.linkedNoteIds?.includes(n.id),
  );

  const handleAttachNote = (value: string | null) => {
    if (!value) return;
    if (value === "NEW") {
      const noteId = addNote(task.title, "");
      updateTask(task.id, {
        linkedNoteIds: [...(task.linkedNoteIds || []), noteId],
      });
      // Link the task to the new note
      useNoteStore.getState().updateNote(noteId, { linkedTaskIds: [task.id] });
      onClose();
      navigate("/notes");
    } else if (value) {
      updateTask(task.id, {
        linkedNoteIds: [...(task.linkedNoteIds || []), value],
      });
      // Link the task to the existing note
      const note = notes.find((n) => n.id === value);
      if (note) {
        useNoteStore.getState().updateNote(value, {
          linkedTaskIds: [...(note.linkedTaskIds || []), task.id],
        });
      }
    }
  };

  const handleUnlinkNote = (noteId: string) => {
    updateTask(task.id, {
      linkedNoteIds: (task.linkedNoteIds || []).filter((id) => id !== noteId),
    });
    // Also unlink task from the note
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      useNoteStore.getState().updateNote(noteId, {
        linkedTaskIds: (note.linkedTaskIds || []).filter(
          (id) => id !== task.id,
        ),
      });
    }
  };

  const isDone = task.status === "done";
  const totalSubtasks = task.subtasks.length;
  const completedSubtasks = task.subtasks.filter((st) => st.completed).length;

  const focusMinutes = Math.floor((task.focusTime || 0) / 60);
  const hours = Math.floor(focusMinutes / 60);
  const mins = focusMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-3xl rounded-[2rem] sm:rounded-3xl outline-none shadow-2xl z-100 max-h-[90dvh] sm:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-5 sm:px-8 sm:py-8 border-b border-border/30 bg-background/30 shrink-0 relative">
          <div className="flex justify-between items-start gap-4 mt-5">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-3 mb-2 sm:mb-3">
                {task.status === "in-progress" && !isDone && (
                  <Badge
                    variant="secondary"
                    className="bg-primary text-primary-foreground px-3 py-0.5 text-[9px] sm:text-[10px] font-black tracking-wider uppercase rounded-full shadow-lg shadow-primary/20 border-none"
                  >
                    Active
                  </Badge>
                )}
              </div>
              <h2
                className={`text-xl sm:text-3xl font-extrabold tracking-tight leading-tight task-title ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
              >
                {task.title}
              </h2>
            </div>
            {/* Main Focus Action in Header */}
            {!isDone && (
              <Button
                onClick={() => {
                  onClose();
                  onStartFocus(task.id);
                }}
                className="shrink-0 gap-1.5 sm:gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl h-10 sm:h-12 px-4 sm:px-6 shadow-xl shadow-primary/20 transition-all hover:scale-105"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                <span className="text-sm sm:text-base">Focus</span>
              </Button>
            )}
          </div>
        </div>

        {/* Body scrollable */}
        <div
          className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Meta Details Row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/20">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                List:
              </span>
              <Select
                value={task.listId || "imp"}
                onValueChange={(v) =>
                  updateTask(task.id, { listId: v || undefined })
                }
              >
                <SelectTrigger className="h-6 border-none bg-transparent rounded-lg text-xs font-black p-0 shadow-none focus:ring-0">
                  <span className="flex flex-1 text-left line-clamp-1 text-xs font-black">
                    {lists.find((l) => l.id === (task.listId || "imp"))
                      ?.title ||
                      task.listId ||
                      "IMP"}
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  {lists.map((l) => (
                    <SelectItem
                      key={l.id}
                      value={l.id}
                      className="text-xs font-bold"
                    >
                      {l.title}
                    </SelectItem>
                  ))}
                  {/* Fallback for tasks in lists that might not have loaded yet or were deleted */}
                  {task.listId && !lists.find((l) => l.id === task.listId) && (
                    <SelectItem
                      value={task.listId}
                      className="text-xs font-bold opacity-50"
                    >
                      {task.listId} (Archived)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {task.dueDate && (
              <div
                className={`flex items-center text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-xl border uppercase tracking-wider ${
                  dayjs(task.dueDate).isBefore(dayjs(), "day") && !isDone
                    ? "text-red-500 bg-red-500/10 border-red-500/20"
                    : "text-muted-foreground bg-muted/30 border-border/20"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 mr-2 opacity-70" />
                Due {dayjs(task.dueDate).format("MMM D")}
              </div>
            )}

            {(task.focusSessions || 0) > 0 && (
              <div
                className={`flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-black px-3 sm:px-4 py-1.5 rounded-xl border uppercase tracking-wider ${
                  isDone
                    ? "bg-muted/30 text-muted-foreground border-border/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{task.focusSessions} Sessions</span>
                </div>
                <div className="w-px h-3 bg-current opacity-20" />
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeStr}</span>
                </div>
              </div>
            )}
          </div>

          {/* Actionable Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Actionable Steps
              </h4>
              {totalSubtasks > 0 && (
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                  {completedSubtasks} / {totalSubtasks}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {task.subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center gap-3 group/st p-3 sm:p-4 rounded-2xl bg-muted/10 border border-border/20 hover:bg-muted/20 transition-all"
                >
                  <div className="shrink-0">
                    <Checkbox
                      checked={st.completed}
                      onCheckedChange={() => toggleSubtask(task.id, st.id)}
                      className="w-5 h-5 rounded-lg border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all shadow-sm"
                    />
                  </div>
                  {editingSubtaskId === st.id ? (
                    <div className="flex-1 flex items-center gap-1">
                      <Input
                        value={editingSubtaskValue}
                        onChange={(e) => setEditingSubtaskValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingSubtaskValue.trim())
                              updateSubtask(
                                task.id,
                                st.id,
                                editingSubtaskValue.trim(),
                              );
                            setEditingSubtaskId(null);
                          }
                          if (e.key === "Escape") setEditingSubtaskId(null);
                        }}
                        className="h-8 text-sm bg-background/50 border-primary/30 flex-1 rounded-lg"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span
                      className={`text-sm sm:text-[15px] leading-tight font-bold transition-colors flex-1 cursor-text subtask-title ${st.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground/90"}`}
                      onClick={() => {
                        setEditingSubtaskId(st.id);
                        setEditingSubtaskValue(st.title);
                      }}
                    >
                      {st.title}
                    </span>
                  )}
                  {!isDone && editingSubtaskId !== st.id && (
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/st:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-full"
                        onClick={() => {
                          setEditingSubtaskId(st.id);
                          setEditingSubtaskValue(st.title);
                        }}
                        title="Edit Step"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-full"
                        onClick={() => deleteSubtask(task.id, st.id)}
                        title="Delete Step"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {!isDone && (
                <div className="flex items-center gap-3 mt-3 p-1 rounded-2xl group/add relative bg-background/50 border border-border/20 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <div className="pl-4">
                    <Plus className="w-5 h-5 text-muted-foreground group-focus-within/add:text-primary transition-colors" />
                  </div>
                  <Input
                    placeholder="Add a new step..."
                    className="h-10 sm:h-11 text-sm font-bold bg-transparent border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/30 w-full"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value;
                        if (val.trim()) {
                          addSubtask(task.id, val);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {task.tags.length > 0 && (
            <div>
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-xl font-bold border border-border/20 ${isDone ? "opacity-50" : "bg-background/50 hover:bg-muted"}`}
                  >
                    <TagIcon className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Base / Linked Notes */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Knowledge Base
              </h4>
            </div>
            <div className="space-y-2">
              {linkedNotes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/10 border border-border/20 hover:bg-muted/20 transition-all group"
                >
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => {
                      useNoteStore.getState().setActiveNoteId(n.id);
                      onClose();
                      navigate("/notes");
                    }}
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold text-foreground/90">
                      {n.title}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                  </div>
                  {!isDone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                      onClick={() => handleUnlinkNote(n.id)}
                    >
                      <LinkIcon className="w-3.5 h-3.5 line-through opacity-70" />
                    </Button>
                  )}
                </div>
              ))}
              {!isDone && (
                <Select onValueChange={handleAttachNote} value="">
                  <SelectTrigger className="w-full h-11 border-dashed border-border/30 bg-transparent hover:bg-muted/20 text-muted-foreground rounded-2xl justify-center shadow-none transition-all mt-2">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />{" "}
                      <span className="text-xs font-black uppercase tracking-wider">
                        Attach or Create Note
                      </span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/50 max-h-[300px]">
                    <SelectItem
                      value="NEW"
                      className="font-black text-primary focus:text-primary focus:bg-primary/10 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create new note
                      </div>
                    </SelectItem>
                    {unlinkedNotes.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-black text-muted-foreground opacity-50 mt-2 px-3 py-2">
                          Existing Notes
                        </SelectLabel>
                        {unlinkedNotes.map((n) => (
                          <SelectItem
                            key={n.id}
                            value={n.id}
                            className="font-bold text-sm py-2.5"
                          >
                            {n.title}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-4 sm:px-8 sm:py-6 border-t border-border/30 bg-muted/5 flex items-center justify-between shrink-0 gap-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-4 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all font-black text-xs uppercase tracking-wider"
              onClick={() => {
                updateTask(task.id, {
                  status:
                    task.status === "in-progress" ? "todo" : "in-progress",
                });
              }}
            >
              {task.status === "in-progress" ? (
                <Pause className="w-4 h-4 mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              <span className="whitespace-nowrap">
                {task.status === "in-progress" ? "Pause" : "Start"}
              </span>
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-4 rounded-xl text-muted-foreground hover:text-foreground transition-all font-black text-xs uppercase tracking-wider"
              onClick={() => {
                onClose();
                onEdit(task);
              }}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-4 rounded-xl text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all font-black text-xs uppercase tracking-wider"
              onClick={() => {
                const taskToRestore = { ...task };
                onClose();
                deleteTask(task.id);
                showToast(`Deleted task: ${task.title}`, () => {
                  addTask(taskToRestore);
                });
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              <span className="whitespace-nowrap">Delete</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
