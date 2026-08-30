import { EditorView } from '@codemirror/view'

// CodeMirror Custom Command: Auto-continue lists on Enter
export const handleEnterKey = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  if (!selection.main.empty) return false;
  const pos = selection.main.head;
  const line = state.doc.lineAt(pos);
  const textBefore = line.text.slice(0, pos - line.from);
  const textAfter = line.text.slice(pos - line.from);

  // Check if line matches list pattern (bullet, checkbox, numbered)
  const checkboxMatch = /^\s*([-*+])\s+\[([ xX])\]\s*/.exec(textBefore);
  const bulletMatch = /^\s*([-*+])\s+/.exec(textBefore);
  const numberedMatch = /^\s*(\d+)\.\s+/.exec(textBefore);

  if (checkboxMatch) {
    const fullMatch = checkboxMatch[0];
    const marker = checkboxMatch[1];
    // If the checkbox item is empty, clear the list item on Enter
    if (textBefore.trim() === `${marker} [${checkboxMatch[2]}]` && !textAfter.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from }
      });
      return true;
    }
    // Continue checkbox list item
    const insertText = `\n${fullMatch.replace(/\[[ xX]\]/, '[ ]')}${textAfter}`;
    view.dispatch({
      changes: { from: pos, to: line.to, insert: insertText },
      selection: { anchor: pos + insertText.length - textAfter.length }
    });
    return true;
  } else if (bulletMatch) {
    const fullMatch = bulletMatch[0];
    const marker = bulletMatch[1];
    if (textBefore.trim() === marker && !textAfter.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from }
      });
      return true;
    }
    const insertText = `\n${fullMatch}${textAfter}`;
    view.dispatch({
      changes: { from: pos, to: line.to, insert: insertText },
      selection: { anchor: pos + insertText.length - textAfter.length }
    });
    return true;
  } else if (numberedMatch) {
    const fullMatch = numberedMatch[0];
    const num = parseInt(numberedMatch[1], 10);
    if (textBefore.trim() === `${num}.` && !textAfter.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from }
      });
      return true;
    }
    const nextNum = num + 1;
    const indent = /^\s*/.exec(textBefore)?.[0] || "";
    const insertText = `\n${indent}${nextNum}. ${textAfter}`;
    view.dispatch({
      changes: { from: pos, to: line.to, insert: insertText },
      selection: { anchor: pos + insertText.length - textAfter.length }
    });
    return true;
  }

  return false;
};

// CodeMirror Formatting Commands
export const handleBold = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  const insertText = `**${selectedText}**`;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: insertText },
    selection: { anchor: main.from + 2 + selectedText.length }
  });
  return true;
};

export const handleItalic = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  const insertText = `*${selectedText}*`;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: insertText },
    selection: { anchor: main.from + 1 + selectedText.length }
  });
  return true;
};

export const handleLink = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  if (selectedText) {
    const insertText = `[${selectedText}](url)`;
    view.dispatch({
      changes: { from: main.from, to: main.to, insert: insertText },
      selection: { anchor: main.from + 2 + selectedText.length + 4 }
    });
  } else {
    const insertText = `[](url)`;
    view.dispatch({
      changes: { from: main.from, to: main.to, insert: insertText },
      selection: { anchor: main.from + 1 }
    });
  }
  return true;
};

export const handleTabIndent = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const pos = selection.main.head;
  const line = state.doc.lineAt(pos);
  const isList = /^\s*([-*+]|\d+\.)\s+/.test(line.text);
  if (isList) {
    view.dispatch({
      changes: { from: line.from, insert: "  " },
      selection: { anchor: pos + 2 }
    });
    return true;
  }
  // Standard indentation at cursor for non-list lines
  view.dispatch({
    changes: { from: pos, insert: "  " },
    selection: { anchor: pos + 2 }
  });
  return true;
};

export const handleTabOutdent = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const pos = selection.main.head;
  const line = state.doc.lineAt(pos);
  if (line.text.startsWith("  ")) {
    view.dispatch({
      changes: { from: line.from, to: line.from + 2, insert: "" },
      selection: { anchor: Math.max(line.from, pos - 2) }
    });
    return true;
  } else if (line.text.startsWith(" ")) {
    view.dispatch({
      changes: { from: line.from, to: line.from + 1, insert: "" },
      selection: { anchor: Math.max(line.from, pos - 1) }
    });
    return true;
  }
  return false;
};

export const CODEMIRROR_BASIC_SETUP = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLine: false,
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  history: true,
};

export const getExcerpt = (content: string, maxLen = 80) => {
  if (!content) return 'Empty note'
  
  // Efficiently strip massive data URLs and markdown images
  const plain = content
    .replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Image]')
    .replace(/!\[.*?\]\(.*?\)/g, '[Image]')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#*_~`>[\]!()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) return 'Empty note'
  return plain.length > maxLen ? plain.substring(0, maxLen) + '…' : plain
}

export const handleStrikethrough = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  const insertText = `~~${selectedText}~~`;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: insertText },
    selection: { anchor: main.from + 2 + selectedText.length }
  });
  return true;
};

export const handleInlineCode = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  const insertText = `\`${selectedText}\``;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: insertText },
    selection: { anchor: main.from + 1 + selectedText.length }
  });
  return true;
};

export const handleCodeBlock = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  const selectedText = state.doc.sliceString(main.from, main.to);
  const insertText = `\`\`\`\n${selectedText}\n\`\`\``;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: insertText },
    selection: { anchor: main.from + 4 + selectedText.length }
  });
  return true;
};

export const handleHeader = (view: EditorView, level: 1 | 2 | 3): boolean => {
  const { state } = view;
  const { selection } = state;
  const pos = selection.main.head;
  const line = state.doc.lineAt(pos);
  const prefix = "#".repeat(level) + " ";
  
  const match = /^(#+)\s+/.exec(line.text);
  if (match) {
    view.dispatch({
      changes: { from: line.from, to: line.from + match[0].length, insert: prefix },
      selection: { anchor: pos - match[0].length + prefix.length }
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: pos + prefix.length }
    });
  }
  return true;
};

export const handleList = (view: EditorView, type: 'bullet' | 'numbered' | 'checklist'): boolean => {
  const { state } = view;
  const { selection } = state;
  const pos = selection.main.head;
  const line = state.doc.lineAt(pos);
  
  let prefix = "";
  if (type === 'bullet') prefix = "- ";
  else if (type === 'numbered') prefix = "1. ";
  else if (type === 'checklist') prefix = "- [ ] ";
  
  const match = /^\s*([-*+]|\d+\.|\s*[-*+]\s+\[[ xX]\])\s+/.exec(line.text);
  if (match) {
    view.dispatch({
      changes: { from: line.from, to: line.from + match[0].length, insert: prefix },
      selection: { anchor: pos - match[0].length + prefix.length }
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: pos + prefix.length }
    });
  }
  return true;
};

export const handleTextCase = (view: EditorView, mode: 'upper' | 'lower' | 'title'): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  if (main.empty) return false;
  
  const selectedText = state.doc.sliceString(main.from, main.to);
  let newText = "";
  if (mode === 'upper') {
    newText = selectedText.toUpperCase();
  } else if (mode === 'lower') {
    newText = selectedText.toLowerCase();
  } else {
    newText = selectedText.replace(/\b\w/g, c => c.toUpperCase());
  }
  
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: newText },
    selection: { anchor: main.to }
  });
  return true;
};

export const handleCut = (view: EditorView): boolean => {
  const { state } = view;
  const { selection } = state;
  const main = selection.main;
  if (main.empty) return false;
  const selectedText = state.doc.sliceString(main.from, main.to);
  navigator.clipboard.writeText(selectedText).then(() => {
    view.dispatch({
      changes: { from: main.from, to: main.to, insert: "" },
      selection: { anchor: main.from }
    });
  });
  return true;
};

export const handlePasteFromMenu = (view: EditorView): boolean => {
  navigator.clipboard.readText().then((clipText) => {
    if (!clipText) return;
    const { state } = view;
    const { selection } = state;
    const main = selection.main;
    view.dispatch({
      changes: { from: main.from, to: main.to, insert: clipText },
      selection: { anchor: main.from + clipText.length }
    });
  }).catch((err) => {
    console.error("Failed to read clipboard:", err);
  });
  return true;
};

