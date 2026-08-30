import React, { useCallback } from 'react'

interface UseImagePasteProps {
  editorRef: React.RefObject<any>
  draftContentRef: React.MutableRefObject<string>
  handleContentChange: (val: string) => void
}

export function useImagePaste({
  editorRef,
  draftContentRef,
  handleContentChange,
}: UseImagePasteProps) {
  
  const compressAndInsertImage = useCallback((file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('Image is too large. Please use images smaller than 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const MAX_WIDTH = 1200
        const MAX_HEIGHT = 1200

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        const imageId = Math.random().toString(36).substring(2, 7)
        const imageMarkdown = `\n![img_${imageId}](${base64})\n`
        
        const view = editorRef.current?.view
        if (view) {
          const { from, to } = view.state.selection.main
          view.dispatch({
            changes: { from, to, insert: imageMarkdown },
            selection: { anchor: from + imageMarkdown.length }
          })
          view.focus()
        } else {
          handleContentChange(draftContentRef.current + imageMarkdown)
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [editorRef, draftContentRef, handleContentChange])

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const view = editorRef.current?.view
    if (view) {
      const { from, to } = view.state.selection.main
      if (from !== to) {
        const text = event.clipboardData?.getData('text/plain')
        if (text) {
          const trimmed = text.trim()
          const isUrl = /^(https?:\/\/[^\s]+)$/i.test(trimmed)
          if (isUrl) {
            const selectedText = view.state.doc.sliceString(from, to)
            const markdownLink = `[${selectedText}](${trimmed})`
            view.dispatch({
              changes: { from, to, insert: markdownLink },
              selection: { anchor: from + markdownLink.length }
            })
            event.preventDefault()
            return
          }
        }
      }
    }

    const items = event.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          compressAndInsertImage(file)
          event.preventDefault()
        }
      }
    }
  }, [compressAndInsertImage, editorRef])

  const handleInsertImageFromGallery = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      compressAndInsertImage(file)
    }
    event.target.value = ''
  }, [compressAndInsertImage])

  return {
    handlePaste,
    handleInsertImageFromGallery,
  }
}
