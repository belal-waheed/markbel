import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Check,
  X,
  Play,
  CheckCircle2,
  Plus,
  Trash2,
  MoreHorizontal,
  GripVertical,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useNoteStore } from "@/stores/noteStore";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Checkbox } from "@/components/ui/checkbox";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";

interface TaskListCardProps {
  listId: string;
  title: string;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  forceExpanded?: boolean;
}

export function TaskListCard({
  listId,
  title,
  tasks,
  onTaskClick,
  onStartFocus,
  forceExpanded = false,
}: TaskListCardProps) {
  const navigate = useNavigate();
  const notes = useNoteStore((state) => state.notes);
  const setActiveNoteId = useNoteStore((state) => state.setActiveNoteId);

  const [isExpanded, setIsExpanded] = useState(tasks.length > 0);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(tasks.length > 0);
  const showTasks = isExpanded || forceExpanded;

  // Auto-expand when tasks load (initial hydration may have 0 tasks)
  // Reset hasAutoExpanded when tasks count changes to allow re-expansion
  useEffect(() => {
    if (tasks.length > 0 && !hasAutoExpanded) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setIsExpanded(true);
      setHasAutoExpanded(true);
    } else if (tasks.length === 0) {
      // Reset when list becomes empty, allowing re-expansion when tasks load again
      setHasAutoExpanded(false);
    }
  }, [tasks.length, hasAutoExpanded]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<
    Record<string, string>
  >({});
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskValue, setEditingSubtaskValue] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Use a ref to track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const checkMobile = () => {
      if (isMountedRef.current) {
        setIsMobile(window.innerWidth < 768);
      }
    };

    checkMobile();

    // Debounce resize events to prevent excessive re-renders
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(checkMobile, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const updateListTitle = useTaskStore((state) => state.updateListTitle);
  const toggleComplete = useTaskStore((state) => state.toggleComplete);
  const calculateTaskProgress = useTaskStore(
    (state) => state.calculateTaskProgress,
  );
  const addSubtask = useTaskStore((state) => state.addSubtask);
  const updateSubtask = useTaskStore((state) => state.updateSubtask);
  const toggleSubtask = useTaskStore((state) => state.toggleSubtask);
  const deleteSubtask = useTaskStore((state) => state.deleteSubtask);
  const deleteList = useTaskStore((state) => state.deleteList);

  const handleSaveTitle = () => {
    if (newTitle.trim() && newTitle !== title) {
      updateListTitle(listId, newTitle);
    }
    setIsEditingTitle(false);
  };

  return (
    <Card className="bg-card/40 backdrop-blur-xl border-border/40 rounded-[2rem] md:w-[320px] lg:w-[350px] md:shrink-0 flex flex-col max-h-none md:max-h-[calc(100vh-180px)] transition-all duration-300">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors group "
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          {isEditingTitle ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                className="h-8 text-xl font-bold bg-background/50 border-primary/30 w-48"
                autoFocus
              />
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={handleSaveTitle}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:bg-muted"
                  onClick={() => setIsEditingTitle(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight first-letter:uppercase">
                {title}
              </h2>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-semibold text-sm bg-muted/20 px-2 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </div>
            </div>
          )}
        </div>
        <div
          className="flex items-center mr-8"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-full shadow-none h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-accent hover:text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <MoreHorizontal className="w-4 h-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem
                onClick={() => setIsEditingTitle(true)}
                className="cursor-pointer"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteList(listId)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shadow-none h-8 w-8 pointer-events-none"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 " />
            ) : (
              <ChevronDown className="w-5 h-5 " />
            )}
          </Button>
        </div>
      </div>

      {/* Task List */}
      <Droppable droppableId={listId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col min-h-[45px] transition-all duration-300 ${
              snapshot.isDraggingOver ? "bg-primary/5 rounded-[1.5rem] p-2" : ""
            }`}
          >
            <AnimatePresence initial={false}>
              {showTasks && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="flex-1 flex flex-col min-h-0 md:overflow-hidden overflow-visible px-3 pb-4 space-y-3 custom-scrollbar"
                >
                  {tasks.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-border/20 rounded-[1.5rem]">
                      <p className="text-muted-foreground text-sm font-medium italic opacity-50">
                        No tasks in this list
                      </p>
                    </div>
                  ) : (
                    [...tasks]
                      .sort((a, b) => {
                        if (a.status === "done" && b.status !== "done")
                          return 1;
                        if (a.status !== "done" && b.status === "done")
                          return -1;
                        return (a.order || 0) - (b.order || 0);
                      })
                      .map((task, index) => {
                        const isDone = task.status === "done";
                        const progress = calculateTaskProgress(task.id);
                        const isTaskExpanded = expandedTaskId === task.id;

                        const handleAddSubtaskLocal = async (
                          taskId: string,
                        ) => {
                          const title = newSubtaskTitles[taskId];
                          if (title?.trim()) {
                            await addSubtask(taskId, title.trim());
                            setNewSubtaskTitles(
                              (prev: Record<string, string>) => ({
                                ...prev,
                                [taskId]: "",
                              }),
                            );
                          }
                        };

                        const handleSaveSubtaskLocal = async (
                          taskId: string,
                        ) => {
                          if (editingSubtaskId && editingSubtaskValue.trim()) {
                            await updateSubtask(
                              taskId,
                              editingSubtaskId,
                              editingSubtaskValue.trim(),
                            );
                          }
                          setEditingSubtaskId(null);
                        };

                        return (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                          >
                            {(provided, snapshot) => {
                              const cardContent = (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    WebkitTouchCallout: "none",
                                    userSelect: "none",
                                    WebkitUserSelect: "none",
                                  }}
                                  onClick={(e) => {
                                    const target = e.target as HTMLElement;
                                    if (
                                      target.closest("button") ||
                                      target.closest("a") ||
                                      target.closest("input")
                                    ) {
                                      return;
                                    }
                                    if (isMobile) {
                                      onTaskClick(task.id);
                                    } else {
                                      setExpandedTaskId(
                                        isTaskExpanded ? null : task.id,
                                      );
                                    }
                                  }}
                                  className={`group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 border select-none cursor-pointer ${
                                    isDone
                                      ? "opacity-50 bg-muted/5 border-transparent"
                                      : isTaskExpanded && !isMobile
                                        ? "bg-background shadow-xl border-primary/20 scale-[1.02] z-10"
                                        : "bg-background/40 border-border/40 hover:border-primary/30 hover:bg-background/60"
                                  } ${snapshot.isDragging ? "shadow-2xl scale-105 z-[9999] ring-2 ring-primary border-transparent opacity-100 bg-card touch-none" : ""}`}
                                >
                                  <div className="p-3 flex items-center gap-3 cursor-pointer">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDone) {
                                          import("canvas-confetti").then(
                                            (confetti) => {
                                              confetti.default({
                                                particleCount: 100,
                                                spread: 70,
                                                origin: { y: 0.6 },
                                                colors: [
                                                  "#a855f7",
                                                  "#ec4899",
                                                  "#3b82f6",
                                                ],
                                              });
                                            },
                                          );
                                        }
                                        toggleComplete(task.id);
                                      }}
                                      className={`shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 w-6 h-6 z-10 ${
                                        isDone
                                          ? "bg-primary border-primary text-primary-foreground"
                                          : "border-muted-foreground/30 hover:border-primary text-transparent hover:bg-primary/10"
                                      }`}
                                    >
                                      <CheckCircle2
                                        className={`w-4 h-4 ${isDone ? "opacity-100" : "opacity-0"} transition-opacity`}
                                        strokeWidth={3}
                                      />
                                    </button>

                                    <div className="flex-1 min-w-0">
                                      <h3
                                        className={`text-sm sm:text-[15px] font-extrabold leading-tight tracking-tight first-letter:uppercase task-title ${
                                          isDone
                                            ? "line-through text-muted-foreground opacity-50"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {task.title}
                                      </h3>

                                      {task.subtasks?.length > 0 && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <ProgressRing
                                            progress={progress}
                                            size={14}
                                            strokeWidth={2}
                                          />
                                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                            {
                                              task.subtasks.filter(
                                                (s) => s.completed,
                                              ).length
                                            }
                                            /{task.subtasks.length} Steps
                                          </span>
                                        </div>
                                      )}
                                      {task.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {task.tags.map((tag) => (
                                            <span
                                              key={tag}
                                              className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20"
                                            >
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {task.linkedNoteIds &&
                                        task.linkedNoteIds.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {task.linkedNoteIds.map(
                                              (noteId) => {
                                                const note = notes.find(
                                                  (n) => n.id === noteId,
                                                );
                                                if (!note) return null;
                                                return (
                                                  <button
                                                    key={noteId}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setActiveNoteId(noteId);
                                                      navigate("/notes");
                                                    }}
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 transition-colors cursor-pointer"
                                                  >
                                                    <FileText className="w-2.5 h-2.5" />
                                                    <span className="truncate max-w-[80px]">
                                                      {note.title || "Untitled"}
                                                    </span>
                                                  </button>
                                                );
                                              },
                                            )}
                                          </div>
                                        )}
                                    </div>

                                    <div
                                      className={`flex items-center gap-1 transition-opacity ${
                                        isMobile
                                          ? "opacity-100"
                                          : "opacity-0 group-hover:opacity-100"
                                      }`}
                                    >
                                      {!isDone && (
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStartFocus(task.id);
                                          }}
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
                                        >
                                          <Play className="w-4 h-4 fill-current" />
                                        </Button>
                                      )}
                                      {!isMobile && (
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onTaskClick(task.id);
                                          }}
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 rounded-lg"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isTaskExpanded && !isMobile && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-3 pb-3 space-y-2 border-t border-border/20 bg-muted/5 mt-1"
                                      >
                                        <div className="pt-2 space-y-1.5">
                                          {task.subtasks.map((st) => (
                                            <div
                                              key={st.id}
                                              className="flex items-center gap-2 group/st p-1.5 rounded-xl hover:bg-muted/10 transition-colors"
                                            >
                                              <Checkbox
                                                checked={st.completed}
                                                onCheckedChange={() =>
                                                  toggleSubtask(task.id, st.id)
                                                }
                                                className="w-4 h-4 rounded border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                                              />

                                              {editingSubtaskId === st.id ? (
                                                <div className="flex-1 flex items-center gap-1">
                                                  <Input
                                                    value={editingSubtaskValue}
                                                    onChange={(e) =>
                                                      setEditingSubtaskValue(
                                                        e.target.value,
                                                      )
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter")
                                                        handleSaveSubtaskLocal(
                                                          task.id,
                                                        );
                                                      if (e.key === "Escape")
                                                        setEditingSubtaskId(
                                                          null,
                                                        );
                                                    }}
                                                    onBlur={() =>
                                                      handleSaveSubtaskLocal(
                                                        task.id,
                                                      )
                                                    }
                                                    className="h-7 text-xs bg-background/50 border-primary/30"
                                                    autoFocus
                                                  />
                                                </div>
                                              ) : (
                                                <span
                                                  className={`text-xs font-semibold flex-1 cursor-text subtask-title ${
                                                    st.completed
                                                      ? "line-through text-muted-foreground opacity-60"
                                                      : "text-foreground/90"
                                                  }`}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingSubtaskId(st.id);
                                                    setEditingSubtaskValue(
                                                      st.title,
                                                    );
                                                  }}
                                                >
                                                  {st.title}
                                                </span>
                                              )}

                                              <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/st:opacity-100 transition-opacity shrink-0">
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingSubtaskId(st.id);
                                                    setEditingSubtaskValue(st.title);
                                                  }}
                                                  title="Edit Step"
                                                >
                                                  <Edit2 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteSubtask(
                                                      task.id,
                                                      st.id,
                                                    );
                                                  }}
                                                  title="Delete Step"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          ))}

                                          {/* Quick Add Subtask */}
                                          <div className="flex items-center gap-2 mt-2 px-1">
                                            <div className="flex-1 flex items-center gap-2 bg-background/50 border border-border/50 rounded-xl px-2 focus-within:border-primary/50 transition-all">
                                              <Plus className="w-3 h-3 text-muted-foreground" />
                                              <Input
                                                placeholder="Add step..."
                                                value={
                                                  newSubtaskTitles[task.id] ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  setNewSubtaskTitles(
                                                    (
                                                      prev: Record<
                                                        string,
                                                        string
                                                      >,
                                                    ) => ({
                                                      ...prev,
                                                      [task.id]: e.target.value,
                                                    }),
                                                  )
                                                }
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter")
                                                    handleAddSubtaskLocal(
                                                      task.id,
                                                    );
                                                  if (e.key === "Escape")
                                                    setExpandedTaskId(null);
                                                }}
                                                className="h-8 text-xs border-none bg-transparent shadow-none focus-visible:ring-0 p-0"
                                              />
                                            </div>
                                            <Button
                                              size="sm"
                                              className="h-8 w-8 rounded-xl px-0 shrink-0"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleAddSubtaskLocal(task.id);
                                              }}
                                              disabled={
                                                !newSubtaskTitles[
                                                  task.id
                                                ]?.trim()
                                              }
                                            >
                                              <Plus className="w-4 h-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );

                              if (snapshot.isDragging) {
                                return createPortal(cardContent, document.body);
                              }
                              return cardContent;
                            }}
                          </Draggable>
                        );
                      })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </Card>
  );
}
