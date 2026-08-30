import React, { useState, useRef, useEffect } from 'react'
import { CheckSquare, Square, Plus, Trash2, Link2Off, Edit3, X, Check, ChevronRight, ChevronDown } from 'lucide-react'
import { useTaskStore, type Task } from '@/stores/taskStore'
import { type Note } from '@/stores/noteStore'
import { Button } from '@/components/ui/button'

interface LinkedTaskChecklistProps {
  activeNote: Note
  tasks: Task[]
  linkedTasks: Task[]
  toggleSubtask: (taskId: string, subtaskId: string) => void
  addSubtask: (taskId: string, title: string) => Promise<void>
  updateSubtask: (taskId: string, subtaskId: string, title: string) => Promise<void>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt' | 'userId' | 'updatedAt'>) => Promise<void>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onToggleTaskLink: (taskId: string) => void
}

export function LinkedTaskChecklist({
  activeNote,
  tasks,
  linkedTasks,
  toggleSubtask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  addTask,
  updateTask,
  onToggleTaskLink
}: LinkedTaskChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({})
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsCollapsed(true)
  }, [activeNote.id])

  useEffect(() => {
    if (editingSubtaskId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingSubtaskId])

  const handleCreateLinkedTask = async () => {
    const lists = useTaskStore.getState().lists
    const defaultListId = lists[0]?.id || 'inbox'
    await addTask({
      title: activeNote.title.trim() || 'Untitled Note Task',
      listId: defaultListId,
      linkedNoteIds: [activeNote.id],
      order: 0, subtasks: [], tags: [], status: 'todo'
    })
  }

  const handleAddSubtaskSubmit = async (taskId: string) => {
    const title = newSubtaskTitles[taskId]?.trim()
    if (!title) return
    await addSubtask(taskId, title)
    setNewSubtaskTitles(prev => ({ ...prev, [taskId]: '' }))
  }

  const startEditing = (taskId: string, subtaskId: string, currentTitle: string) => {
    setEditingTaskId(taskId)
    setEditingSubtaskId(subtaskId)
    setEditValue(currentTitle)
  }

  const saveSubtaskEdit = async () => {
    if (!editingTaskId || !editingSubtaskId) return
    const trimmed = editValue.trim()
    if (trimmed) await updateSubtask(editingTaskId, editingSubtaskId, trimmed)
    setEditingTaskId(null)
    setEditingSubtaskId(null)
    setEditValue('')
  }

  const cancelSubtaskEdit = () => {
    setEditingTaskId(null)
    setEditingSubtaskId(null)
    setEditValue('')
  }

  const unlinkedTasks = tasks.filter(t => !activeNote.linkedTaskIds?.includes(t.id) && !t.linkedNoteIds?.includes(activeNote.id))

  return (
    <div className={`transition-all duration-200 border border-border/10 rounded-2xl bg-card/40 premium-shadow ${
      isCollapsed ? 'mb-4 p-3 px-4 pb-3' : 'mb-8 p-5 space-y-4'
    }`}>
      <h4 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between cursor-pointer hover:text-foreground transition-colors select-none ${
          isCollapsed ? '' : 'border-b border-border/10 pb-2'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5" /> Linked Task Checklist
          <span className="text-[9px] lowercase font-normal text-muted-foreground/40 ml-1.5">
            ({linkedTasks.length} linked, {isCollapsed ? 'collapsed' : 'expanded'})
          </span>
        </span>
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />
        )}
      </h4>
      
      {!isCollapsed && (
        <div className="space-y-4">
          {linkedTasks.length === 0 ? (
            <div className="p-3 bg-muted/5 border border-dashed border-border/20 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-foreground">Task Checklist</span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    Link or create a task to track subtasks
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleCreateLinkedTask} 
                  variant="outline" 
                  size="sm" 
                  className="h-7 rounded-lg px-3 text-[11px] font-bold shadow-sm hover:bg-primary/5 hover:text-primary transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" /> Create Task
                </Button>

                {unlinkedTasks.length > 0 && (
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onToggleTaskLink(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="h-7 text-[11px] bg-muted/30 border border-border/10 rounded-lg pl-2 pr-6 outline-none hover:bg-muted/80 hover:border-border/30 cursor-pointer max-w-[130px] appearance-none font-bold"
                      defaultValue=""
                    >
                      <option value="" disabled>Link existing...</option>
                      {unlinkedTasks.map(t => (
                        <option key={t.id} value={t.id} className="text-foreground bg-background">{t.title}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-[8px]">
                      ▼
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {linkedTasks.map(task => (
                <div key={task.id} className="space-y-3">
                  <div className="flex items-center justify-between group/task">
                    <span className="text-xs font-black tracking-tight text-foreground/80 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {task.title}
                    </span>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-all opacity-100 md:opacity-0 md:group-hover/task:opacity-100 cursor-pointer"
                      onClick={() => onToggleTaskLink(task.id)}
                      title="Unlink this task"
                    >
                      <Link2Off className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 pl-3">
                    {task.subtasks?.map(subtask => {
                      const isEditingThis = editingSubtaskId === subtask.id
                      return (
                        <div 
                          key={subtask.id} 
                          className="flex items-center gap-2.5 text-sm font-medium hover:bg-muted/40 p-1.5 rounded-lg transition-all group/sub"
                        >
                          <button
                            onClick={() => toggleSubtask(task.id, subtask.id)}
                            className="focus:outline-none transition-transform active:scale-95 shrink-0"
                          >
                            {subtask.completed ? (
                              <CheckSquare className="w-4 h-4 text-primary fill-primary/10" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground/60 group-hover/sub:text-primary transition-colors" />
                            )}
                          </button>

                          {isEditingThis ? (
                            <div className="flex-1 flex items-center gap-1.5">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSubtaskEdit()
                                  if (e.key === 'Escape') cancelSubtaskEdit()
                                }}
                                onBlur={saveSubtaskEdit}
                                className="flex-1 bg-background border border-primary/20 rounded px-2 py-0.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                              <button onClick={saveSubtaskEdit} className="p-1 hover:text-primary transition-colors text-muted-foreground/60">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={cancelSubtaskEdit} className="p-1 hover:text-destructive transition-colors text-muted-foreground/60">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span 
                              onDoubleClick={() => startEditing(task.id, subtask.id, subtask.title)}
                              className={`flex-1 truncate cursor-text select-text ${subtask.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}
                              title="Double-click to edit subtask"
                            >
                              {subtask.title}
                            </span>
                          )}

                          {!isEditingThis && (
                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditing(task.id, subtask.id, subtask.title)}
                                className="p-1 text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer"
                                title="Edit Subtask"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteSubtask(task.id, subtask.id)}
                                className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                                title="Delete Subtask"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    <div className="flex items-center gap-2.5 p-1 pl-1.5 rounded-lg border border-dashed border-border/10 bg-muted/5 focus-within:border-primary/20 transition-all">
                      <Plus className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                      <input
                        type="text"
                        placeholder="Add subtask..."
                        value={newSubtaskTitles[task.id] || ''}
                        onChange={(e) => setNewSubtaskTitles(prev => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSubtaskSubmit(task.id)
                        }}
                        className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/30 focus:ring-0"
                      />
                      {newSubtaskTitles[task.id]?.trim() && (
                        <button
                          onClick={() => handleAddSubtaskSubmit(task.id)}
                          className="text-[10px] font-black text-primary hover:text-primary-active px-2 py-0.5 rounded cursor-pointer"
                        >
                          ADD
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {unlinkedTasks.length > 0 && (
                <div className="pt-2 border-t border-border/10 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Need to link another task?</span>
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onToggleTaskLink(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="h-7 text-[10px] bg-muted/40 border border-border/15 rounded-full px-2.5 pr-7 outline-none hover:bg-muted/75 cursor-pointer appearance-none transition-all"
                      defaultValue=""
                    >
                      <option value="" disabled>Link existing task...</option>
                      {unlinkedTasks.map(t => (
                        <option key={t.id} value={t.id} className="text-foreground bg-background">{t.title}</option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/50 text-[8px]">
                      ▼
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

