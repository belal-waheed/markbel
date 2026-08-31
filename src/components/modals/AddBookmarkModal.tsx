import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, Globe, Sparkles, Plus, Calendar, Pin } from "lucide-react";
import { api } from "../../lib/api";
import { useDebounce } from "../../lib/useDebounce";
import { resolveSmartGroup } from "../../lib/smartGroups";

interface AddBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    url: string;
    title: string;
    description: string;
    image: string;
    group: string;
    remindAt?: string;
    isPinned?: boolean;
  }) => Promise<void>;
  groups: string[];
}

export const AddBookmarkModal: React.FC<AddBookmarkModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  groups,
}) => {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [group, setGroup] = useState("Unsorted");
  const [hasManuallyChangedGroup, setHasManuallyChangedGroup] = useState(false);
  const [isAutoGrouped, setIsAutoGrouped] = useState(false);
  const [remindAt, setRemindAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debouncedUrl = useDebounce(url, 500);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl("");
      setTitle("");
      setDescription("");
      setImage("");
      setGroup("Unsorted");
      setHasManuallyChangedGroup(false);
      setIsAutoGrouped(false);
      setRemindAt("");
      setIsPinned(false);
      setTimeout(() => urlInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!debouncedUrl || !debouncedUrl.startsWith("http")) return;

    // Smart Auto-Group pre-selection
    if (!hasManuallyChangedGroup) {
      const smartGroup = resolveSmartGroup(debouncedUrl, groups);
      if (smartGroup && smartGroup !== "Unsorted") {
        setGroup(smartGroup);
        setIsAutoGrouped(true);
      }
    }

    let isMounted = true;
    const fetchMetadata = async () => {
      setIsLoadingMeta(true);
      try {
        const meta = await api.get<{ title?: string; description?: string; image?: string }>(
          `/metadata?url=${encodeURIComponent(debouncedUrl)}`
        );
        if (isMounted && meta) {
          if (meta.title && !title) setTitle(meta.title);
          if (meta.description && !description) setDescription(meta.description);
          if (meta.image && !image) setImage(meta.image);
        }
      } catch (err) {
        // Fallback title from hostname
        try {
          const parsed = new URL(debouncedUrl);
          if (!title) setTitle(parsed.hostname.replace("www.", ""));
        } catch {}
      } finally {
        if (isMounted) setIsLoadingMeta(false);
      }
    };

    fetchMetadata();
    return () => {
      isMounted = false;
    };
  }, [debouncedUrl]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        url: url.trim(),
        title: title.trim() || url.trim(),
        description: description.trim(),
        image: image.trim(),
        group: group || "Unsorted",
        remindAt: remindAt ? new Date(remindAt).toISOString() : undefined,
        isPinned,
      });
      onClose();
    } catch (err) {
      console.error("[Add Bookmark Error]:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-5 border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Add Bookmark
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center justify-between">
              <span>URL</span>
              {isLoadingMeta && (
                <span className="flex items-center gap-1 text-[var(--color-accent)] text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" /> Fetching preview...
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <Globe className="w-4 h-4" />
              </div>
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2.5 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Principles for Fast Apps"
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2.5 px-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key notes or takeaways..."
              rows={2}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center justify-between">
                <span>Group</span>
                {isAutoGrouped && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent)] font-medium">
                    <Sparkles className="w-3 h-3" /> Auto: {group}
                  </span>
                )}
              </label>
              <select
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value);
                  setHasManuallyChangedGroup(true);
                  setIsAutoGrouped(false);
                }}
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)]"
              >
                <option value="Unsorted">Unsorted (Inbox)</option>
                {groups
                  .filter((g) => g !== "Unsorted")
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Remind Date
              </label>
              <input
                type="date"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPinnedCheck"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-[var(--color-border-default)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <label htmlFor="isPinnedCheck" className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1 cursor-pointer">
              <Pin className="w-3 h-3 text-amber-500" /> Pin to top of vault
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border-default)] mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="btn-primary px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                "Save Bookmark"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
