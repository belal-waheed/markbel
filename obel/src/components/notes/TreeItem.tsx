import React from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { type Note, type NoteFolder } from '@/stores/noteStore'
import { type TreeNode } from '@/lib/treeHelpers'

interface TreeItemProps {
  node: TreeNode
  depth: number
  expandedPaths: Set<string>
  activeNoteId: string | null
  onSelectNote: (id: string) => void
  onToggleExpand: (path: string) => void
  onNoteContextMenu: (e: React.MouseEvent, note: Note) => void
  onFolderContextMenu: (e: React.MouseEvent, folder: NoteFolder) => void
  sortTreeNodes: (nodes: TreeNode[]) => TreeNode[]
}

export function TreeItem({
  node,
  depth,
  expandedPaths,
  activeNoteId,
  onSelectNote,
  onToggleExpand,
  onNoteContextMenu,
  onFolderContextMenu,
  sortTreeNodes
}: TreeItemProps) {
  const isFolder = node.type === 'folder'
  const isExpanded = isFolder && expandedPaths.has(node.path)
  const isActive = node.type === 'note' && activeNoteId === node.id

  if (isFolder) {
    return (
      <div className="select-none">
        {/* Folder Row */}
        <div
          onClick={() => onToggleExpand(node.path)}
          onContextMenu={(e) => {
            if (node.folder) {
              onFolderContextMenu(e, node.folder)
            }
          }}
          className="flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-muted/40 cursor-pointer text-muted-foreground/80 hover:text-foreground transition-all duration-150 group text-sm font-medium"
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
            {node.children.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              )
            ) : (
              // Empty folder spacing or small dot
              <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
            )}
          </span>
          <span className="truncate flex-grow">{node.name}</span>
          {node.noteCount !== undefined && node.noteCount > 0 && (
            <span className="text-[10px] opacity-40 px-1.5 py-0.5 rounded-full bg-muted/40 hidden group-hover:inline-block">
              {node.noteCount}
            </span>
          )}
        </div>

        {/* Children Render */}
        {isExpanded && node.children.length > 0 && (
          <div className="border-l border-border/10 ml-3 pl-3 py-0.5 space-y-0.5">
            {sortTreeNodes(node.children).map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                activeNoteId={activeNoteId}
                onSelectNote={onSelectNote}
                onToggleExpand={onToggleExpand}
                onNoteContextMenu={onNoteContextMenu}
                onFolderContextMenu={onFolderContextMenu}
                sortTreeNodes={sortTreeNodes}
              />
            ))}
          </div>
        )}
      </div>
    )
  } else {
    // Note Row
    return (
      <div
        onClick={() => onSelectNote(node.id)}
        onContextMenu={(e) => {
          if (node.note) {
            onNoteContextMenu(e, node.note)
          }
        }}
        className={`flex items-center py-1 px-5 rounded-md cursor-pointer transition-all duration-150 text-sm font-medium border border-transparent ${
          isActive
            ? 'bg-primary/10 text-primary font-bold shadow-sm'
            : 'text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground hover:border-border/5'
        }`}
      >
        <span className="truncate">{node.name}</span>
      </div>
    )
  }
}
