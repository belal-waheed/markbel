import React, { useRef, useState } from "react";
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  Database,
  FileCode,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { db } from "../../db/db.js";
import { syncManager } from "../../db/SyncManager.js";
import { useAuth } from "../../lib/auth.js";

interface DataBackupCardProps {
  onNotice: (msg: string) => void;
  onRefresh?: () => Promise<void>;
}

export default function DataBackupCard({
  onNotice,
  onRefresh,
}: DataBackupCardProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportingJson, setExportingJson] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);
  const [importingHtml, setImportingHtml] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // 1. Export as JSON
  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const [bookmarks, groups] = await Promise.all([
        db.bookmarks.filter((b) => !b.deletedAt).toArray(),
        db.groups.filter((g) => !g.deletedAt).toArray(),
      ]);

      const backup = {
        app: "Markbel",
        version: "2.5.16",
        exportedAt: new Date().toISOString(),
        totalBookmarks: bookmarks.length,
        totalGroups: groups.length,
        groups,
        bookmarks,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `markbel-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onNotice(`Exported ${bookmarks.length} bookmarks to JSON.`);
    } catch (err) {
      console.error("JSON export error:", err);
      alert("Failed to export JSON: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingJson(false);
    }
  };

  // 2. Export as Netscape HTML
  const handleExportNetscape = async () => {
    setExportingHtml(true);
    try {
      const [bookmarks, groups] = await Promise.all([
        db.bookmarks.filter((b) => !b.deletedAt).toArray(),
        db.groups.filter((g) => !g.deletedAt).toArray(),
      ]);

      // Group bookmarks by group name
      const groupedMap = new Map<string, typeof bookmarks>();
      for (const b of bookmarks) {
        const groupName = b.group || "Unsorted";
        if (!groupedMap.has(groupName)) {
          groupedMap.set(groupName, []);
        }
        groupedMap.get(groupName)!.push(b);
      }

      const lines: string[] = [
        "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
        "<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->",
        '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
        "<TITLE>Bookmarks</TITLE>",
        "<H1>Bookmarks</H1>",
        "<DL><p>",
      ];

      for (const [groupName, bList] of groupedMap.entries()) {
        lines.push(`    <DT><H3 ADD_DATE="${Math.floor(Date.now() / 1000)}">${escapeHtml(groupName)}</H3>`);
        lines.push("    <DL><p>");
        for (const b of bList) {
          const timestamp = b.createdAt
            ? Math.floor(new Date(b.createdAt).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          const iconAttr = b.favicon ? ` ICON="${escapeHtml(b.favicon)}"` : "";
          lines.push(
            `        <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${timestamp}"${iconAttr}>${escapeHtml(
              b.title || b.url
            )}</A>`
          );
        }
        lines.push("    </DL><p>");
      }

      lines.push("</DL><p>");
      const htmlContent = lines.join("\n");

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `markbel-bookmarks-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onNotice(`Exported ${bookmarks.length} bookmarks to Netscape HTML.`);
    } catch (err) {
      console.error("Netscape export error:", err);
      alert("Failed to export HTML: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingHtml(false);
    }
  };

  // Helper escape
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 3. Import Netscape HTML file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingHtml(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");

      const anchors = Array.from(doc.querySelectorAll("a"));
      if (anchors.length === 0) {
        alert("No bookmarks found in the uploaded file.");
        return;
      }

      const now = new Date().toISOString();
      const userId = user?.id || "local-user";
      let importedCount = 0;

      // Existing URLs to prevent duplicates
      const existingBookmarks = await db.bookmarks.toArray();
      const existingUrls = new Set(existingBookmarks.map((b) => b.url.toLowerCase()));

      for (const a of anchors) {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("javascript:") || href.startsWith("data:")) continue;

        if (existingUrls.has(href.toLowerCase())) {
          continue;
        }

        const title = a.textContent?.trim() || href;

        // Traverse upwards to find folder name if within a <DL>
        let groupName = "Unsorted";
        let parentDl = a.closest("dl");
        if (parentDl) {
          const prevHeader = parentDl.previousElementSibling;
          if (prevHeader && /^H[1-6]$/i.test(prevHeader.tagName)) {
            const hText = prevHeader.textContent?.trim();
            if (hText && hText !== "Bookmarks" && hText !== "Bookmarks Bar") {
              groupName = hText;
            }
          }
        }

        const bookmarkId = crypto.randomUUID();
        const newRecord = {
          id: bookmarkId,
          userId,
          url: href,
          title,
          description: "",
          group: groupName,
          isRead: false,
          isArchived: false,
          contentType: "article" as const,
          tags: [],
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        await db.transaction("rw", [db.bookmarks, db.syncOutbox], async () => {
          await db.bookmarks.add(newRecord);
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: "bookmark",
            entityId: bookmarkId,
            operation: "create",
            baseVersion: 0,
            payload: newRecord,
            status: "pending",
            attempts: 0,
            createdAt: now,
          });
        });

        existingUrls.add(href.toLowerCase());
        importedCount++;
      }

      syncManager.sync(true);
      if (onRefresh) {
        await onRefresh();
      }

      onNotice(`Import complete: Added ${importedCount} bookmarks.`);
    } catch (err) {
      console.error("Netscape import error:", err);
      alert("Failed to parse Netscape bookmark file: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImportingHtml(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 4. Clear Local Cache
  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await db.cachedThumbnails.clear();
      onNotice("Local thumbnail cache purged successfully.");
    } catch (err) {
      console.error("Cache purge error:", err);
      alert("Failed to clear thumbnail cache: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <section className="studio-card p-4 sm:p-6 relative space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-border-default)] text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Data Portability & Backup
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Export and import your library in open formats, or reset local device cache
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-2.5 py-0.5 rounded">
          Local-First Storage
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Bookmarks */}
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-3">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <ArrowDownToLine className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Export Vault Data</span>
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Download your complete library including categorization, reading states, and metadata tags.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={exportingJson}
              className="btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {exportingJson ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCode className="w-3.5 h-3.5" />
              )}
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportNetscape}
              disabled={exportingHtml}
              className="btn-secondary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {exportingHtml ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Export Netscape HTML</span>
            </button>
          </div>
        </div>

        {/* Import Bookmarks */}
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-3">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <ArrowUpFromLine className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Import Netscape HTML</span>
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Import bookmark exports from Chrome, Firefox, Safari, Edge, or Brave directly into your vault.
            </p>
          </div>

          <div className="pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importingHtml}
              className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {importingHtml ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>Choose Bookmark HTML File</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clear Cache */}
      <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <Trash2 className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span>Clear Local Image & Thumbnail Cache</span>
          </h4>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-xl">
            Frees local storage on this device by removing cached preview thumbnails. Thumbnails will re-cache on demand.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClearCache}
          disabled={clearingCache}
          className="btn-secondary px-4 py-2 text-xs font-bold shrink-0 self-start sm:self-center cursor-pointer disabled:opacity-50"
        >
          {clearingCache ? (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Clearing...</span>
            </span>
          ) : (
            <span>Purge Thumbnail Cache</span>
          )}
        </button>
      </div>
    </section>
  );
}
