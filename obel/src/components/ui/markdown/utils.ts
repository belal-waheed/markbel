export interface MarkdownSection {
  id: string
  title: string
  level: number
  contentLines: string[]
  children: MarkdownSection[]
}

export interface ParsedMarkdown {
  rootContent: string
  sections: MarkdownSection[]
}

export function parseSections(content: string): ParsedMarkdown {
  const lines = content.split('\n')
  const root: MarkdownSection = {
    id: 'root',
    title: '',
    level: 0,
    contentLines: [],
    children: [],
  }

  const stack: MarkdownSection[] = [root]
  let insideCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('```')) {
      insideCodeBlock = !insideCodeBlock
      stack[stack.length - 1].contentLines.push(line)
      continue
    }

    if (!insideCodeBlock) {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const title = match[2].trim()
        const newSection: MarkdownSection = {
          id: `${level}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}-${i}`,
          title,
          level,
          contentLines: [],
          children: [],
        }

        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
          stack.pop()
        }

        const parent = stack[stack.length - 1]
        parent.children.push(newSection)
        stack.push(newSection)
        continue
      }
    }

    stack[stack.length - 1].contentLines.push(line)
  }

  return {
    rootContent: root.contentLines.join('\n'),
    sections: root.children,
  }
}
