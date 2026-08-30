import { type Note, type NoteFolder } from '@/stores/noteStore'

export interface TreeNode {
  type: 'folder' | 'note'
  id: string
  name: string
  path: string
  children: TreeNode[]
  noteCount?: number
  note?: Note
  folder?: NoteFolder
}

/**
 * Builds a nested folder and file tree from flat arrays of folders and notes.
 * Supports slashes in folder names (e.g. 'dev/back/asp') to represent nested directories.
 */
export function buildTree(folders: NoteFolder[], notes: Note[]): TreeNode[] {
  const folderMap = new Map<string, TreeNode>()
  const realFoldersByName = new Map<string, NoteFolder>()

  // Map all real folders by their name for quick prefix check
  folders.forEach((f) => {
    realFoldersByName.set(f.name, f)
  })

  // Ensure all folder paths and their parent paths exist in folderMap
  folders.forEach((folder) => {
    const parts = folder.name.split('/')
    for (let i = 0; i < parts.length; i++) {
      const currentPath = parts.slice(0, i + 1).join('/')
      if (!folderMap.has(currentPath)) {
        const realFolder = realFoldersByName.get(currentPath)
        if (realFolder) {
          folderMap.set(currentPath, {
            type: 'folder',
            id: realFolder.id,
            name: parts[i],
            path: currentPath,
            children: [],
            folder: realFolder,
            noteCount: 0
          })
        } else {
          folderMap.set(currentPath, {
            type: 'folder',
            id: `virtual:${currentPath}`,
            name: parts[i],
            path: currentPath,
            children: [],
            noteCount: 0
          })
        }
      }
    }
  })

  const rootNodes: TreeNode[] = []

  // Link child folders to parent folders
  folderMap.forEach((node, path) => {
    const lastSlash = path.lastIndexOf('/')
    if (lastSlash !== -1) {
      const parentPath = path.substring(0, lastSlash)
      const parentNode = folderMap.get(parentPath)
      if (parentNode) {
        parentNode.children.push(node)
      } else {
        rootNodes.push(node)
      }
    } else {
      rootNodes.push(node)
    }
  })

  // Distribute notes into folder nodes
  notes.forEach((note) => {
    let folderName = 'Hola'
    const parentFolder = folders.find((f) => f.id === note.folderId)
    if (parentFolder) {
      folderName = parentFolder.name
    }

    const folderNode = folderMap.get(folderName)
    if (folderNode) {
      folderNode.children.push({
        type: 'note',
        id: note.id,
        name: note.title || 'Untitled',
        path: `${folderNode.path}/${note.title || 'Untitled'}`,
        note: note,
        children: []
      })

      // Increment noteCount of parent folders recursively
      let currentPath = folderNode.path
      while (currentPath) {
        const node = folderMap.get(currentPath)
        if (node) {
          node.noteCount = (node.noteCount || 0) + 1
        }
        const lastSlash = currentPath.lastIndexOf('/')
        currentPath = lastSlash !== -1 ? currentPath.substring(0, lastSlash) : ''
      }
    } else {
      rootNodes.push({
        type: 'note',
        id: note.id,
        name: note.title || 'Untitled',
        path: note.title || 'Untitled',
        note: note,
        children: []
      })
    }
  })

  return rootNodes
}
