import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, FolderPlus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { useTimerStore } from "@/stores/timerStore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { TaskDetailsModal } from "@/components/tasks/TaskDetailsModal";
import { TaskListCard } from "@/components/tasks/TaskListCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

export default function TasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMounted, setIsMounted] = useState(false);
  const [isDraggingTask, setIsDraggingTask] = useState(false);

  const tasks = useTaskStore((state) => state.tasks) || [];
  const lists = useTaskStore((state) => state.lists) || [];
  const isLoading = useTaskStore((state) => state.isLoading);
  const error = useTaskStore((state) => state.error);
  const getFilteredTasks = useTaskStore((state) => state.getFilteredTasks);
  const addList = useTaskStore((state) => state.addList);
  const fetchTasks = useTaskStore((state) => state.fetchTasks);

  const setActiveTaskId = useTimerStore((state) => state.setActiveTaskId);
  const reorderTasks = useTaskStore((state) => state.reorderTasks);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Proactively fetch/hydrate tasks on component mount
    fetchTasks().catch(() => {});
  }, [fetchTasks]);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [filterStatus] = useState<string>("all");
  const [searchQuery] = useState("");

  const selectedTaskDetailsId = searchParams.get("taskId");
  const setSelectedTaskDetailsId = (id: string | null) => {
    if (id) {
      setSearchParams({ taskId: id });
    } else {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("taskId");
      setSearchParams(nextParams);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    return getFilteredTasks(filterStatus, searchQuery);
  }, [filterStatus, searchQuery, getFilteredTasks, tasks]);

  const tasksByList = useMemo(() => {
    const grouped: Record<string, typeof tasks> = {};
    lists.forEach((list) => {
      grouped[list.id] = filteredTasks.filter(
        (t) => t.listId === list.id || (!t.listId && list.id === "imp"),
      );
    });
    return grouped;
  }, [filteredTasks, lists]);

  const liveSelectedTask = useMemo(
    () =>
      selectedTaskDetailsId
        ? tasks.find((t) => t.id === selectedTaskDetailsId) || null
        : null,
    [tasks, selectedTaskDetailsId],
  );

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleStartFocus = (taskId: string) => {
    setActiveTaskId(taskId);
    navigate("/pomodoro");
  };

  const handleDragStart = () => {
    setIsDraggingTask(true);
  };

  const handleDragEnd = (result: DropResult) => {
    setIsDraggingTask(false);
    if (!result.destination) return;

    const sourceListId = result.source.droppableId;
    const destListId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    const taskId = result.draggableId;

    if (sourceListId !== destListId || sourceIndex !== destIndex) {
      reorderTasks(sourceListId, destListId, sourceIndex, destIndex, taskId);
    }
  };

  if (!isMounted || lists.length === 0) {
    return (
      <div className="space-y-6 max-w-[100vw] sm:max-w-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight font-arabic bg-linear-to-br from-foreground via-foreground to-primary/40 bg-clip-text text-transparent pb-2 leading-tight animate-pulse">
                استعن بالله
              </h1>
            </div>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-hidden md:pb-8">
          <div className="w-full md:w-[320px] lg:w-[350px] md:shrink-0 space-y-4">
            <SkeletonList count={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 max-w-[100vw] sm:max-w-none">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute -left-4 top-0 bottom-0 w-1 bg-primary rounded-full"
              />
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight font-arabic bg-linear-to-br from-foreground via-foreground to-primary/40 bg-clip-text text-transparent pb-2 leading-tight">
                استعن بالله
              </h1>
            </div>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl mb-4"
          >
            <p className="text-destructive text-sm font-medium">Failed to load tasks: {error}</p>
          </motion.div>
        )}

        {isLoading && tasks.length === 0 && (
          <div className="flex gap-4 overflow-x-hidden md:pb-8">
            <div className="w-full md:w-[320px] lg:w-[350px] md:shrink-0 space-y-4">
              <SkeletonList count={4} />
            </div>
            <div className="hidden md:block w-full md:w-[320px] lg:w-[350px] md:shrink-0 space-y-4">
              <SkeletonList count={2} />
            </div>
          </div>
        )}

        {/* List Cards Board / Container */}
        <div className="min-h-[calc(100vh-250px)]">
          {!isLoading && lists.length === 0 ? (
            <EmptyState
              icon={<Target className="w-10 h-10" />}
              title="No lists found"
              description="Create your first list to start organizing your tasks."
              action={
                <Button
                  onClick={() => addList("New List")}
                  variant="outline"
                  className="mt-4 rounded-full px-8 h-12"
                >
                  Create First List
                </Button>
              }
            />
          ) : isMobile ? (
            <div className="flex flex-col gap-4">
              {lists.map((list) => (
                <div key={list.id} className="relative w-full">
                  <TaskListCard
                    listId={list.id}
                    title={list.title}
                    tasks={tasksByList[list.id] || []}
                    onTaskClick={(id: string) => setSelectedTaskDetailsId(id)}
                    onStartFocus={handleStartFocus}
                    forceExpanded={isDraggingTask}
                  />
                </div>
              ))}

              {/* Add New List Card */}
              <div className="w-full">
                <button
                  onClick={() => addList("New List")}
                  className="w-full py-12 flex flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed border-border/40 hover:border-primary/40 bg-card/20 hover:bg-card/40 transition-all group cursor-pointer"
                >
                  <FolderPlus className="w-8 h-8 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  <span className="text-sm font-bold text-muted-foreground/50 group-hover:text-primary/70 transition-colors uppercase tracking-wider">
                    New List
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-row items-start overflow-x-auto pb-8 gap-4 custom-scrollbar">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="relative group/list shrink-0 w-full md:w-[320px] lg:w-[350px]"
                >
                  <TaskListCard
                    listId={list.id}
                    title={list.title}
                    tasks={tasksByList[list.id] || []}
                    onTaskClick={(id: string) => setSelectedTaskDetailsId(id)}
                    onStartFocus={handleStartFocus}
                    forceExpanded={isDraggingTask}
                  />
                </div>
              ))}

              {/* Add New List Card */}
              <div className="w-full md:w-[320px] lg:w-[350px] md:shrink-0">
                <button
                  onClick={() => addList("New List")}
                  className="w-full py-12 flex flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed border-border/40 hover:border-primary/40 bg-card/20 hover:bg-card/40 transition-all group cursor-pointer"
                >
                  <FolderPlus className="w-8 h-8 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  <span className="text-sm font-bold text-muted-foreground/50 group-hover:text-primary/70 transition-colors uppercase tracking-wider">
                    New List
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div
          className="fixed right-4 sm:right-8 flex flex-col gap-4 z-50 transition-all duration-300"
          style={{
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))', // Clear mobile nav & mini timer
          }}
        >
          <Button
            onClick={openCreateModal}
            size="lg"
            className="w-16 h-16 rounded-full shadow-lg shadow-primary/40 hover:scale-110 active:scale-95 transition-all duration-300 p-0 press-scale"
          >
            <Plus className="w-8 h-8" strokeWidth={3} />
          </Button>
        </div>

        <TaskDetailsModal
          task={liveSelectedTask}
          onClose={() => setSelectedTaskDetailsId(null)}
          onEdit={(task) => {
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          onStartFocus={handleStartFocus}
        />

        <TaskFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          editingTask={editingTask}
        />
      </div>
    </DragDropContext>
  );
}
