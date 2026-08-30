import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { Extension, RangeSet } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

type DecorationSet = RangeSet<Decoration>;

/**
 * LivePreviewExtension
 * 
 * Provides Obsidian-like Live Preview features.
 */

class CheckboxWidget extends WidgetType {
  declare checked: boolean;
  constructor(checked: boolean) { 
    super(); 
    this.checked = checked;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-checkbox-container mr-2.5 cursor-pointer inline-flex items-center align-middle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "w-4 h-4 rounded-md border-border bg-muted/50 accent-primary cursor-pointer transition-all";
    wrap.appendChild(input);
    return wrap;
  }
}

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-bullet-widget inline-block w-1.5 h-1.5 rounded-full bg-foreground/40 mr-3.5 align-middle mb-0.5";
    return span;
  }
}

// Concealment Decoration
const hideDecoration = Decoration.mark({ class: "cm-concealed" });

// Header decorations matching Reading Mode (prose-obel)
const header1Deco = Decoration.line({ 
  attributes: { class: "text-4xl font-black tracking-tight pt-10 pb-9 text-primary border-b-2 border-border/40 block cm-heading-1" } 
});
const header2Deco = Decoration.line({ 
  attributes: { class: "text-2xl font-bold tracking-tight pt-8 pb-6 text-primary/95 border-b border-border/30 block cm-heading-2" } 
});
const header3Deco = Decoration.line({ 
  attributes: { class: "text-xl font-bold tracking-tight pt-6 pb-4 text-primary/85 block cm-heading-3" } 
});

// List and Blockquote decorations
const blockquoteLineDeco = Decoration.line({ 
  attributes: { class: "border-l-4 border-primary/30 bg-primary/5 pl-8 py-1.5 my-0 block italic text-muted-foreground/80" } 
});
const listLineDeco = Decoration.line({ 
  attributes: { class: "pl-1 block" } 
});

// Code Block Decorations - Using custom .cm-code-block-line for robust padding
const codeBlockFirstLineDeco = Decoration.line({ attributes: { class: "bg-muted/70 cm-code-block-line pt-8 font-mono text-[0.85em] border-x border-t border-border/20 rounded-t-2xl shadow-sm block" } });
const codeBlockMidLineDeco = Decoration.line({ attributes: { class: "bg-muted/70 cm-code-block-line py-0.5 font-mono text-[0.85em] border-x border-border/20 block" } });
const codeBlockLastLineDeco = Decoration.line({ attributes: { class: "bg-muted/70 cm-code-block-line pb-8 font-mono text-[0.85em] border-x border-b border-border/20 rounded-b-2xl shadow-sm block" } });
const codeBlockSingleLineDeco = Decoration.line({ attributes: { class: "bg-muted/70 cm-code-block-line py-8 font-mono text-[0.85em] border border-border/20 rounded-2xl shadow-sm block" } });

class ImageWidget extends WidgetType {
  declare src: string;
  declare alt: string;
  constructor(src: string, alt: string) { 
    super(); 
    this.src = src;
    this.alt = alt;
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-image-widget-container my-8 block";
    const img = document.createElement("img");
    img.src = this.src;
    img.alt = this.alt;
    img.className = "max-w-full h-auto rounded-2xl shadow-2xl border border-border/20 transition-transform duration-300 hover:scale-[1.02]";
    wrap.appendChild(img);
    return wrap;
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(class {
  declare decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.getDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.getDecorations(update.view);
    }
  }

  getDecorations(view: EditorView) {
    const selection = view.state.selection.main;
    const tree = syntaxTree(view.state);
    const decoPairs: { from: number, to: number, deco: Decoration }[] = [];

    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter: (node) => {
          const nodeName = node.name;
          const nodeFrom = node.from;
          const nodeTo = node.to;

          // Images - The big one for "extremely simple" request
          if (nodeName === "Image") {
            const isCursorInNode = selection.from >= nodeFrom && selection.to <= nodeTo;
            const text = view.state.sliceDoc(nodeFrom, nodeTo);
            const match = text.match(/(!\[.*?\]\()(data:.*?;base64,)(.*?)(\))/);
            
            if (!isCursorInNode) {
              if (match) {
                const alt = match[1].slice(2, -2);
                const src = match[2] + match[3];
                decoPairs.push({ 
                  from: nodeFrom, 
                  to: nodeTo, 
                  deco: Decoration.replace({ widget: new ImageWidget(src, alt) }) 
                });
              }
            } else if (match) {
              // Even when expanded, truncate the massive base64 string visually
              const prefix = match[1] + match[2];
              const data = match[3];
              if (data.length > 100) {
                const startTruncate = nodeFrom + prefix.length + 30;
                const endTruncate = nodeFrom + prefix.length + data.length - 30;
                decoPairs.push({ from: startTruncate, to: endTruncate, deco: hideDecoration });
                // Add a small widget to show it's truncated
                decoPairs.push({ 
                  from: startTruncate, 
                  to: startTruncate, 
                  deco: Decoration.widget({ 
                    widget: new (class extends WidgetType {
                      toDOM() {
                        const span = document.createElement("span");
                        span.textContent = "...";
                        span.className = "text-muted-foreground bg-muted/30 px-1 rounded mx-1 select-none cursor-default";
                        return span;
                      }
                    })()
                  }) 
                });
              }
            }
          }

          // Headers
          if (nodeName.startsWith("ATXHeading")) {
            const level = parseInt(nodeName.slice(-1));
            if (level === 1) decoPairs.push({ from: nodeFrom, to: nodeFrom, deco: header1Deco });
            else if (level === 2) decoPairs.push({ from: nodeFrom, to: nodeFrom, deco: header2Deco });
            else if (level === 3) decoPairs.push({ from: nodeFrom, to: nodeFrom, deco: header3Deco });

            const line = view.state.doc.lineAt(nodeFrom);
            if (selection.from < line.from || selection.to > line.to) {
              const markerMatch = view.state.sliceDoc(nodeFrom, nodeTo).match(/^#+\s*/);
              if (markerMatch) decoPairs.push({ from: nodeFrom, to: nodeFrom + markerMatch[0].length, deco: hideDecoration });
            }
          }

          // Blockquotes
          if (nodeName === "Blockquote") {
            const startLine = view.state.doc.lineAt(nodeFrom).number;
            const endLine = view.state.doc.lineAt(nodeTo).number;
            for (let i = startLine; i <= endLine; i++) {
              const line = view.state.doc.line(i);
              if (line.from >= from && line.from <= to) {
                decoPairs.push({ from: line.from, to: line.from, deco: blockquoteLineDeco });
                const isCursorInLine = selection.from >= line.from && selection.to <= line.to;
                if (!isCursorInLine && line.text.trim().startsWith(">")) {
                    const markerPos = line.from + line.text.indexOf(">");
                    decoPairs.push({ from: markerPos, to: markerPos + 1, deco: hideDecoration });
                }
              }
            }
          }

          // Lists
          if (nodeName === "ListItem") {
            const line = view.state.doc.lineAt(nodeFrom);
            if (line.from >= from && line.from <= to) {
                decoPairs.push({ from: line.from, to: line.from, deco: listLineDeco });
                const text = line.text;
                const isTask = /^\s*(-|\*|\+)\s*\[( |x)\]/.test(text);
                const isCursorInLine = selection.from >= line.from && selection.to <= line.to;
                if (!isCursorInLine) {
                   const markerMatch = text.match(/^\s*(-|\*|\+)\s*/);
                   if (markerMatch) {
                      const markerStart = line.from + markerMatch.index! + markerMatch[0].indexOf(markerMatch[1]);
                      const markerEnd = markerStart + 1;
                      if (isTask) decoPairs.push({ from: markerStart, to: markerEnd, deco: hideDecoration });
                      else decoPairs.push({ from: markerStart, to: markerEnd, deco: Decoration.replace({ widget: new BulletWidget() }) });
                   }
                }
            }
          }

          // Inline Styles
          if (nodeName === "Emphasis" || nodeName === "StrongEmphasis" || nodeName === "InlineCode") {
            const line = view.state.doc.lineAt(nodeFrom);
            const isCursorInLine = selection.from >= line.from && selection.to <= line.to;
            if (nodeName === "InlineCode") {
                decoPairs.push({ from: nodeFrom, to: nodeTo, deco: Decoration.mark({ class: "bg-muted px-2 py-1 rounded-lg font-mono text-[0.85em] border border-border/20 shadow-sm" }) });
            }
            if (!isCursorInLine) {
              const markerLen = nodeName === "StrongEmphasis" ? 2 : 1;
              decoPairs.push({ from: nodeFrom, to: nodeFrom + markerLen, deco: hideDecoration });
              decoPairs.push({ from: nodeTo - markerLen, to: nodeTo, deco: hideDecoration });
            }
          }

          // Code Blocks
          if (nodeName === "FencedCode" || nodeName === "CodeBlock") {
            const startLineNum = view.state.doc.lineAt(nodeFrom).number;
            const endLineNum = view.state.doc.lineAt(nodeTo).number;
            for (let i = startLineNum; i <= endLineNum; i++) {
              const line = view.state.doc.line(i);
              if (line.from >= from && line.from <= to) {
                let deco = codeBlockMidLineDeco;
                if (startLineNum === endLineNum) deco = codeBlockSingleLineDeco;
                else if (i === startLineNum) deco = codeBlockFirstLineDeco;
                else if (i === endLineNum) deco = codeBlockLastLineDeco;
                decoPairs.push({ from: line.from, to: line.from, deco });
              }
            }
            if (selection.from < nodeFrom || selection.to > nodeTo) {
              const firstLine = view.state.doc.lineAt(nodeFrom);
              const lastLine = view.state.doc.lineAt(nodeTo);
              if (firstLine.from >= from && firstLine.from <= to && firstLine.text.startsWith("```")) {
                decoPairs.push({ from: firstLine.from, to: firstLine.to, deco: hideDecoration });
              }
              if (lastLine.from >= from && lastLine.from <= to && lastLine.text.startsWith("```")) {
                decoPairs.push({ from: lastLine.from, to: lastLine.to, deco: hideDecoration });
              }
            }
          }

          // Horizontal Rules
          if (nodeName === "HorizontalRule") {
              decoPairs.push({ from: nodeFrom, to: nodeTo, deco: Decoration.replace({ widget: new (class extends WidgetType {
                  toDOM() {
                      const hr = document.createElement("hr");
                      hr.className = "border-t border-border/40 my-10";
                      return hr;
                  }
              })() }) });
          }

          // Tasks
          if (nodeName === "Task") {
            const text = view.state.sliceDoc(nodeFrom, nodeTo);
            const isChecked = text.includes("[x]");
            const markerMatch = text.match(/\[( |x)\]/);
            if (markerMatch) {
              const start = nodeFrom + markerMatch.index!;
              if (start >= from && start <= to) {
                decoPairs.push({ from: start, to: start + 3, deco: Decoration.replace({ widget: new CheckboxWidget(isChecked) }) });
              }
            }
          }
        }
      });
    }

    decoPairs.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      const aIsLine = a.to === a.from;
      const bIsLine = b.to === b.from;
      if (aIsLine && !bIsLine) return -1;
      if (!aIsLine && bIsLine) return 1;
      return 0;
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to, deco } of decoPairs) {
      builder.add(from, to, deco);
    }
    return builder.finish();
  }
}, {
  decorations: v => v.decorations,
  eventHandlers: {
    mousedown: (e, view) => {
      const target = e.target as HTMLElement;
      if (target.closest(".cm-checkbox-container")) {
        const pos = view.posAtDOM(target);
        const line = view.state.doc.lineAt(pos);
        const text = line.text;
        const isChecked = text.includes("[x]");
        const newText = isChecked ? text.replace("[x]", "[ ]") : text.replace("[ ]", "[x]");
        view.dispatch({ changes: { from: line.from, to: line.to, insert: newText } });
        return true;
      }
    }
  }
});

const livePreviewTheme = EditorView.theme({
  ".cm-heading-1": { fontSize: "2.25rem", fontWeight: "900" },
  ".cm-heading-2": { fontSize: "1.5rem", fontWeight: "700" },
  ".cm-heading-3": { fontSize: "1.25rem", fontWeight: "600" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection) !important"
  },
  ".cm-concealed": {
    display: "inline-block",
    width: "0.01px",
    height: "1px",
    opacity: "0",
    overflow: "hidden",
    verticalAlign: "middle"
  }
});

export function livePreview(): Extension {
  return [livePreviewPlugin, livePreviewTheme];
}
