import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  AlertCircle,
  Trash2,
  Square,
  FileText,
  Undo,
  Redo,
  Copy,
  Scissors,
  Clipboard,
  Bold,
  Italic,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  CaseSensitive,
  Code,
} from "lucide-react";
import { useContextMenu } from "@/hooks/useContextMenu";
import { ContextMenu } from "@/components/ui/ContextMenu";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { atomone } from "@uiw/codemirror-theme-atomone";
import { EditorView, keymap } from "@codemirror/view";
import { indentWithTab, undo, redo } from "@codemirror/commands";

import { Button } from "@/components/ui/button";
import { FloatingToolbar } from "@/components/ui/FloatingToolbar";
import { MarkdownRenderer } from "@/components/ui/markdown/index";
import {
  useNoteStore,
  type Note,
  type NoteFolder,
  type NoteColor,
} from "@/stores/noteStore";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useImagePaste } from "@/hooks/useImagePaste";
import { useWikiSuggestions } from "@/hooks/useWikiSuggestions";

import { NoteHeader } from "./NoteHeader";
import { WikiLinkSuggestions } from "./WikiLinkSuggestions";
import { EditorTabBar } from "./EditorTabBar";
import { LinkedTaskChecklist } from "./LinkedTaskChecklist";
import { BacklinksSection } from "./BacklinksSection";
import { NoteStatusBar } from "./NoteStatusBar";

import {
  handleEnterKey,
  handleBold,
  handleItalic,
  handleLink,
  handleTabIndent,
  handleTabOutdent,
  CODEMIRROR_BASIC_SETUP,
  handleStrikethrough,
  handleInlineCode,
  handleCodeBlock,
  handleHeader,
  handleList,
  handleTextCase,
  handleCut,
  handlePasteFromMenu,
} from "@/lib/noteEditorHelpers";
import { livePreview } from "@/components/ui/LivePreviewExtension";

interface NoteEditorProps {
  activeNote: Note;
  notes: Note[];
  folders: NoteFolder[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  updateSubtask: (
    taskId: string,
    subtaskId: string,
    title: string,
  ) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addTask: (task: any) => Promise<void>;
  updateTask: (id: string, updates: any) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  setColor: (id: string, color: NoteColor) => void;
  moveNote: (noteId: string, folderId: string | undefined) => void;
  isZenMode: boolean;
  setIsZenMode: (val: boolean) => void;
  isMobile: boolean;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  openNoteIds: string[];
  removeOpenNote: (id: string) => void;
  onSelectNote: (id: string) => void;
  viewMode: "edit" | "preview";
  setViewMode: (mode: "edit" | "preview") => void;
  onBack: () => void;
  onCommandOpen: () => void;
  onCreateTaskFromSelection: (text: string) => void;
  draftTitle: string;
  setDraftTitle: (title: string) => void;
  draftContent: string;
  setDraftContent: (content: string) => void;
  scheduleSave: (
    id: string,
    updates: Partial<Pick<Note, "title" | "content" | "color">>,
  ) => void;
}

export function NoteEditor({
  activeNote,
  notes,
  folders,
  tasks,
  toggleSubtask,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  addTask,
  updateTask,
  updateNote,
  deleteNote,
  togglePin,
  setColor,
  moveNote,
  isZenMode,
  setIsZenMode,
  isMobile,
  showSidebar,
  setShowSidebar,
  openNoteIds,
  removeOpenNote,
  onSelectNote,
  viewMode,
  setViewMode,
  onBack,
  onCommandOpen,
  onCreateTaskFromSelection,
  draftTitle,
  setDraftTitle,
  draftContent,
  setDraftContent,
  scheduleSave,
}: NoteEditorProps) {
  const activeNoteId = activeNote.id;
  const noteSettings = useNoteStore((s) => s.noteSettings);

  const [isLarge, setIsLarge] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkLarge = () => setIsLarge(window.innerWidth >= 1024);
    checkLarge();
    window.addEventListener("resize", checkLarge);
    return () => window.removeEventListener("resize", checkLarge);
  }, []);

  const editorFontSize = useMemo(() => {
    const base = parseInt(noteSettings.fontSize) || 16;
    if (isMobile) return `${base - 2}px`;
    if (isLarge) return `${base + 2}px`;
    return `${base}px`;
  }, [noteSettings.fontSize, isMobile, isLarge]);

  const [titleError, setTitleError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastSelection, setLastSelection] = useState<any>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editorView, setEditorView] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRefCallback = useCallback((node: any) => {
    editorRef.current = node;
    setEditorView(node?.view || null);
  }, []);

  const draftContentRef = useRef(draftContent);
  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  const lpExtension = useMemo(() => livePreview(), []);

  // Word count
  const wordCount = useMemo(() => {
    return (draftContent || "").trim()
      ? (draftContent || "").trim().split(/\s+/).length
      : 0;
  }, [draftContent]);

  const linkedTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.linkedNoteIds?.includes(activeNoteId) ||
        activeNote.linkedTaskIds?.includes(t.id),
    );
  }, [tasks, activeNoteId, activeNote.linkedTaskIds]);

  const linkedSubtasks = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: { taskId: string; taskTitle: string; subtask: any }[] = [];
    linkedTasks.forEach((t) => {
      if (t.subtasks && t.subtasks.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t.subtasks.forEach((s: any) => {
          list.push({ taskId: t.id, taskTitle: t.title, subtask: s });
        });
      }
    });
    return list;
  }, [linkedTasks]);

  // Refocus editor when switching to edit mode
  useEffect(() => {
    if (viewMode === "edit") {
      const timer = setTimeout(() => {
        if (editorRef.current?.view) {
          const view = editorRef.current.view;
          view.focus();
          if (lastSelection) {
            view.dispatch({ selection: lastSelection });
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewMode, lastSelection]);

  // Audio Recorder Hook
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onAudioRecorded: (audioId, base64Audio) => {
      const currentAudioMap = activeNote.audioMap || {};
      const updatedAudioMap = { ...currentAudioMap, [audioId]: base64Audio };
      updateNote(activeNoteId, { audioMap: updatedAudioMap });

      const audioMarkdown = `\n![Voice Note](audio:${audioId})\n`;
      const view = editorRef.current?.view;
      if (view) {
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: audioMarkdown },
          selection: { anchor: from + audioMarkdown.length },
        });
        view.focus();
      } else {
        setDraftContent(draftContentRef.current + audioMarkdown);
        scheduleSave(activeNoteId, {
          content: draftContentRef.current + audioMarkdown,
        });
      }
    },
  });

  // WikiLink autocomplete suggestions hook
  const {
    suggestionOpen,
    setSuggestionOpen,
    suggestionPos,
    suggestionIndex,
    filteredSuggestions,
    handleAcceptSuggestion,
    checkSuggestions,
  } = useWikiSuggestions({
    notes,
    activeNoteId,
    editorRef,
  });

  // Image paste/upload hook
  const { handlePaste, handleInsertImageFromGallery } = useImagePaste({
    editorRef,
    draftContentRef,
    handleContentChange: (val) => {
      setDraftContent(val);
      scheduleSave(activeNoteId, { content: val });
    },
  });

  // Title sanitization with instant space replacement
  const handleTitleChange = (val: string) => {
    const cleaned = val.replace(/\s+/g, "_");
    setDraftTitle(cleaned);

    if (cleaned.trim()) {
      const isDuplicate = notes.some(
        (n) =>
          n.id !== activeNoteId &&
          n.title.toLowerCase() === cleaned.toLowerCase(),
      );
      if (isDuplicate) {
        setTitleError("This title already exists in your vault");
      } else {
        setTitleError(null);
      }
    } else {
      setTitleError(null);
    }

    scheduleSave(activeNoteId, { title: cleaned || "Untitled" });
  };

  const handleContentChange = (val: string) => {
    setDraftContent(val);
    scheduleSave(activeNoteId, { content: val });

    // Check for WikiLink suggestions [[
    checkSuggestions();

    // Slash command detection
    const view = editorRef.current?.view;
    if (view) {
      const pos = view.state.selection.main.head;
      const beforeSlash = view.state.doc.sliceString(pos - 1, pos);
      if (beforeSlash === "/") {
        onCommandOpen();
      }
    } else {
      if (val.length > (draftContent || "").length && val.endsWith("/")) {
        onCommandOpen();
      }
    }
  };

  const pasteExtension = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste: (event) => {
          handlePaste(event);
          return false;
        },
      }),
    [handlePaste],
  );

  const markdownKeymap = useMemo(() => {
    return keymap.of([
      { key: "Enter", run: handleEnterKey },
      { key: "Mod-b", run: handleBold },
      { key: "Mod-i", run: handleItalic },
      { key: "Mod-k", run: handleLink },
      { key: "Mod-z", run: undo },
      { key: "Mod-y", run: redo },
      { key: "Mod-Shift-z", run: redo },
      { key: "Tab", run: handleTabIndent },
      { key: "Shift-Tab", run: handleTabOutdent },
    ]);
  }, []);

  const editorExtensions = useMemo(() => {
    return [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.scrollMargins.of(() => ({ bottom: 150, top: 100 })),
      lpExtension,
      pasteExtension,
      markdownKeymap,
      EditorView.theme({
        "&": { backgroundColor: "transparent !important" },
        ".cm-scroller": { overflow: "visible" },
        ".cm-content": {
          padding: "10px 0 60vh 0",
          minHeight: "80vh",
          fontSize: editorFontSize,
          lineHeight: noteSettings.lineHeight,
          fontFamily: noteSettings.fontFamily,
        },
      }),
    ];
  }, [
    lpExtension,
    pasteExtension,
    markdownKeymap,
    editorFontSize,
    noteSettings.lineHeight,
    noteSettings.fontFamily,
  ]);

  const toggleTaskLink = (taskId: string) => {
    const currentNote = activeNote;
    const links = currentNote.linkedTaskIds || [];
    const isLinked = links.includes(taskId);

    const newLinks = isLinked
      ? links.filter((id) => id !== taskId)
      : [...links, taskId];
    updateNote(activeNoteId, { linkedTaskIds: newLinks });

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const taskLinks = task.linkedNoteIds || [];
      const newTaskLinks = isLinked
        ? taskLinks.filter((id: string) => id !== activeNoteId)
        : [...taskLinks, activeNoteId];
      import("@/stores/taskStore").then(({ useTaskStore: store }) => {
        store.getState().updateTask(taskId, { linkedNoteIds: newTaskLinks });
      });
    }
  };

  const exportNote = () => {
    const blob = new Blob([activeNote.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeNote.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm("Are you sure you want to delete this note?")) {
      deleteNote(id);
      onBack();
    }
  };

  const handleNoteClick = (title: string) => {
    const cleaned = title.trim().replace(/\s+/g, "_").toLowerCase();
    let note = notes.find((n) => n.title.toLowerCase() === cleaned);

    if (!note) {
      const clickFirstWord = cleaned.split(/[_-\s]+/)[0];
      const genericWords = new Set([
        "a",
        "the",
        "new",
        "untitled",
        "temp",
        "note",
        "my",
        "to",
        "for",
        "in",
        "on",
        "at",
        "by",
        "of",
        "and",
        "or",
        "with",
      ]);
      if (
        clickFirstWord &&
        !genericWords.has(clickFirstWord) &&
        clickFirstWord.length > 2
      ) {
        note = notes.find((n) => {
          const noteFirstWord = n.title.toLowerCase().split(/[_-\s]+/)[0];
          return noteFirstWord === clickFirstWord;
        });
      }
    }

    if (note) {
      onSelectNote(note.id);
    } else {
      const newNoteId = useNoteStore
        .getState()
        .addNote(title, "", activeNote.folderId);
      onSelectNote(newNoteId);
    }
  };

  const editorContextMenu = useContextMenu();

  const getSelectedText = useCallback(() => {
    if (viewMode === "edit" && editorView) {
      const { from, to } = editorView.state.selection.main;
      return editorView.state.sliceDoc(from, to);
    }
    if (typeof window !== "undefined") {
      return window.getSelection()?.toString() || "";
    }
    return "";
  }, [viewMode, editorView]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, button, a")) {
        return;
      }
      editorContextMenu.openMenu(e, null);
    },
    [editorContextMenu],
  );

  const selectedText = getSelectedText();

  const handleCopy = useCallback((text: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }, []);

  const editorMenuItems = useMemo(() => {
    const isEdit = viewMode === "edit";
    const hasSelection = !!selectedText.trim();

    if (isEdit && editorView) {
      return [
        {
          label: "Undo",
          icon: <Undo className="w-3.5 h-3.5" />,
          shortcut: "Ctrl+Z",
          onClick: () => undo(editorView),
        },
        {
          label: "Redo",
          icon: <Redo className="w-3.5 h-3.5" />,
          shortcut: "Ctrl+Y",
          onClick: () => redo(editorView),
        },
        { divider: true },
        {
          label: "Cut",
          icon: <Scissors className="w-3.5 h-3.5" />,
          shortcut: "Ctrl+X",
          disabled: !hasSelection,
          onClick: () => handleCut(editorView),
        },
        {
          label: "Copy",
          icon: <Copy className="w-3.5 h-3.5" />,
          shortcut: "Ctrl+C",
          disabled: !hasSelection,
          onClick: () => handleCopy(selectedText),
        },
        {
          label: "Paste",
          icon: <Clipboard className="w-3.5 h-3.5" />,
          shortcut: "Ctrl+V",
          onClick: () => handlePasteFromMenu(editorView),
        },
        { divider: true },
        {
          label: "Format Text",
          submenu: [
            {
              label: "Bold",
              icon: <Bold className="w-3.5 h-3.5" />,
              shortcut: "Ctrl+B",
              onClick: () => handleBold(editorView),
            },
            {
              label: "Italic",
              icon: <Italic className="w-3.5 h-3.5" />,
              shortcut: "Ctrl+I",
              onClick: () => handleItalic(editorView),
            },
            {
              label: "Strikethrough",
              onClick: () => handleStrikethrough(editorView),
            },
            { divider: true },
            {
              label: "Inline Code",
              icon: <Code className="w-3.5 h-3.5" />,
              onClick: () => handleInlineCode(editorView),
            },
            {
              label: "Code Block",
              onClick: () => handleCodeBlock(editorView),
            },
          ],
        },
        {
          label: "Paragraph Style",
          submenu: [
            {
              label: "Heading 1",
              icon: <Type className="w-3.5 h-3.5 font-bold" />,
              onClick: () => handleHeader(editorView, 1),
            },
            {
              label: "Heading 2",
              icon: <Type className="w-3.5 h-3.5 font-medium" />,
              onClick: () => handleHeader(editorView, 2),
            },
            {
              label: "Heading 3",
              icon: <Type className="w-3.5 h-3.5 font-normal" />,
              onClick: () => handleHeader(editorView, 3),
            },
          ],
        },
        {
          label: "Lists",
          submenu: [
            {
              label: "Checklist",
              icon: <CheckSquare className="w-3.5 h-3.5" />,
              onClick: () => handleList(editorView, "checklist"),
            },
            {
              label: "Bullet List",
              icon: <List className="w-3.5 h-3.5" />,
              onClick: () => handleList(editorView, "bullet"),
            },
            {
              label: "Numbered List",
              icon: <ListOrdered className="w-3.5 h-3.5" />,
              onClick: () => handleList(editorView, "numbered"),
            },
          ],
        },
        {
          label: "Transform Text",
          submenu: [
            {
              label: "UPPERCASE",
              icon: <CaseSensitive className="w-3.5 h-3.5" />,
              disabled: !hasSelection,
              onClick: () => handleTextCase(editorView, "upper"),
            },
            {
              label: "lowercase",
              icon: <CaseSensitive className="w-3.5 h-3.5" />,
              disabled: !hasSelection,
              onClick: () => handleTextCase(editorView, "lower"),
            },
            {
              label: "Title Case",
              icon: <CaseSensitive className="w-3.5 h-3.5" />,
              disabled: !hasSelection,
              onClick: () => handleTextCase(editorView, "title"),
            },
          ],
        },
        { divider: true },
        ...(hasSelection
          ? [
              {
                label: "Create Task from Selection",
                onClick: () => onCreateTaskFromSelection(selectedText),
              },
            ]
          : []),
        {
          label: "Switch to Preview Mode",
          icon: <FileText className="w-3.5 h-3.5" />,
          onClick: () => setViewMode("preview"),
        },
        { divider: true },
        {
          label: "Export as Markdown",
          onClick: () => exportNote(),
        },
        {
          label: "Delete Note",
          danger: true,
          onClick: () => handleDeleteNote(activeNoteId),
        },
        { divider: true },
        {
          label: `${wordCount} words | ${(draftContent || "").length} chars`,
          disabled: true,
        },
      ];
    }

    return [
      {
        label: "Switch to Edit Mode",
        icon: <FileText className="w-3.5 h-3.5" />,
        onClick: () => setViewMode("edit"),
      },
      {
        label: "Copy Selection",
        icon: <Copy className="w-3.5 h-3.5" />,
        shortcut: "Ctrl+C",
        disabled: !hasSelection,
        onClick: () => handleCopy(selectedText),
      },
      { divider: true },
      {
        label: "Export as Markdown",
        onClick: () => exportNote(),
      },
      {
        label: "Delete Note",
        danger: true,
        onClick: () => handleDeleteNote(activeNoteId),
      },
      { divider: true },
      {
        label: `${wordCount} words | ${(draftContent || "").length} chars`,
        disabled: true,
      },
    ];
  }, [
    viewMode,
    selectedText,
    editorView,
    activeNoteId,
    setViewMode,
    onCreateTaskFromSelection,
    exportNote,
    handleDeleteNote,
    wordCount,
    draftContent,
    handleCopy,
  ]);

  return (
    <>
      <NoteHeader
        isMobile={isMobile}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        activeNote={activeNote}
        viewMode={viewMode}
        setViewMode={setViewMode}
        wordCount={wordCount}
        onBack={onBack}
        onStartRecording={startRecording}
        imageInputRef={imageInputRef}
        onInsertImageFromGallery={handleInsertImageFromGallery}
        onTogglePin={togglePin}
        folders={folders}
        onMoveNote={moveNote}
        onSetColor={setColor}
        tasks={tasks}
        onToggleTaskLink={toggleTaskLink}
        onExportNote={exportNote}
        onDeleteNote={handleDeleteNote}
      />

      <EditorTabBar
        isZenMode={isZenMode}
        openNoteIds={openNoteIds}
        activeNoteId={activeNoteId}
        notes={notes}
        onSelectNote={onSelectNote}
        removeOpenNote={removeOpenNote}
      />

      <div
        onContextMenu={handleContextMenu}
        className="flex-1 flex overflow-hidden relative"
      >
        <div className="flex-1 overflow-auto flex justify-center custom-scrollbar">
          <div
            className={`w-full transition-all duration-700 ${isZenMode ? "w-full md:w-8/12 mx-auto px-6 pt-24" : "w-full md:w-5/6 mx-auto px-6 py-10"}`}
          >
            {activeNote.linkedTaskIds &&
              activeNote.linkedTaskIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {activeNote.linkedTaskIds.map((taskId) => {
                    const t = tasks.find((x) => x.id === taskId);
                    if (!t) return null;
                    return (
                      <div
                        key={taskId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-xs font-medium"
                      >
                        <Link2 className="w-3 h-3" /> {t.title}
                      </div>
                    );
                  })}
                </div>
              )}

            <LinkedTaskChecklist
              activeNote={activeNote}
              tasks={tasks}
              linkedTasks={linkedTasks}
              toggleSubtask={toggleSubtask}
              addSubtask={addSubtask}
              updateSubtask={updateSubtask}
              deleteSubtask={deleteSubtask}
              addTask={addTask}
              updateTask={updateTask}
              onToggleTaskLink={toggleTaskLink}
            />

            {viewMode === "edit" ? (
              <>
                <input
                  ref={titleRef}
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={(e) => {
                    let val = e.target.value.trim().replace(/\s+/g, "_");
                    if (!val) {
                      val = "Untitled";
                    }
                    const existingTitles = notes
                      .filter((n) => n.id !== activeNoteId)
                      .map((n) => n.title.toLowerCase());
                    if (existingTitles.includes(val.toLowerCase())) {
                      let counter = 1;
                      let candidate = val;
                      while (existingTitles.includes(candidate.toLowerCase())) {
                        candidate = `${val}_${++counter}`;
                      }
                      val = candidate;
                    }
                    setDraftTitle(val);
                    setTitleError(null);
                    updateNote(activeNoteId, { title: val });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      titleRef.current?.blur();
                    }
                  }}
                  placeholder="Untitled"
                  className={`w-full bg-transparent text-5xl font-black tracking-tight text-foreground placeholder:text-muted-foreground/10 outline-none border-none ${titleError ? "mb-2" : "mb-12"} hover:placeholder:text-muted-foreground/20 transition-all`}
                />

                {titleError && (
                  <div className="flex items-center gap-1.5 text-destructive text-[10px] font-bold uppercase tracking-wider mb-6 bg-destructive/10 px-3 py-1.5 rounded-lg w-fit border border-destructive/20">
                    <AlertCircle className="w-3 h-3" />
                    {titleError}
                  </div>
                )}

                <div className="bg-transparent">
                  <CodeMirror
                    ref={editorRefCallback}
                    value={draftContent}
                    height="auto"
                    theme={atomone}
                    extensions={editorExtensions}
                    onChange={(val) => handleContentChange(val)}
                    className="bg-transparent border-none outline-none"
                    basicSetup={CODEMIRROR_BASIC_SETUP}
                  />
                </div>
              </>
            ) : (
              <div className="prose-obel max-w-none">
                <h1 className="text-5xl font-black mb-12 tracking-tight">
                  {draftTitle || "Untitled"}
                </h1>
                <MarkdownRenderer
                  content={draftContent}
                  audioMap={activeNote.audioMap}
                  onNoteClick={handleNoteClick}
                  style={{
                    fontSize: editorFontSize,
                    lineHeight: noteSettings.lineHeight,
                    fontFamily: noteSettings.fontFamily,
                  }}
                />
              </div>
            )}

            <BacklinksSection
              activeNoteId={activeNoteId}
              onSelectNote={onSelectNote}
            />
          </div>
        </div>
      </div>

      <NoteStatusBar
        isZenMode={isZenMode}
        setIsZenMode={setIsZenMode}
        updatedAt={activeNote.updatedAt}
      />

      <WikiLinkSuggestions
        open={suggestionOpen}
        pos={suggestionPos}
        suggestions={filteredSuggestions}
        selectedIndex={suggestionIndex}
        onAccept={handleAcceptSuggestion}
        onClose={() => setSuggestionOpen(false)}
      />

      {viewMode === "edit" && editorView && (
        <FloatingToolbar
          editorView={editorView}
          onCreateTask={onCreateTaskFromSelection}
        />
      )}

      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-4 bg-card/85 backdrop-blur-2xl border border-border/40 rounded-full shadow-2xl premium-shadow"
          >
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
            </div>

            <div className="text-sm font-black font-mono text-foreground select-none">
              {Math.floor(recordingDuration / 60)
                .toString()
                .padStart(2, "0")}
              :{(recordingDuration % 60).toString().padStart(2, "0")}
            </div>

            <div className="flex items-end gap-[3px] h-5 px-2 select-none">
              {[0.6, 0.9, 0.4, 0.8, 0.5, 0.7, 0.3, 0.8, 0.5, 0.6].map(
                (h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ["4px", `${h * 20}px`, "4px"] }}
                    transition={{
                      duration: 0.8 + (i % 3) * 0.15,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-[3px] bg-primary/70 rounded-full"
                  />
                ),
              )}
            </div>

            <div className="w-px h-5 bg-border/20" />

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                title="Discard Recording"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                onClick={stopRecording}
                className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 cursor-pointer"
                title="Save & Insert Recording"
              >
                <Square className="w-4 h-4 fill-white" strokeWidth={3} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ContextMenu
        x={editorContextMenu.x}
        y={editorContextMenu.y}
        isOpen={editorContextMenu.isOpen}
        onClose={editorContextMenu.closeMenu}
        items={editorMenuItems}
      />
    </>
  );
}
