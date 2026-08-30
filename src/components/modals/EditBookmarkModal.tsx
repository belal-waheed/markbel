import React, { useState, useEffect } from "react";
import { X, Loader2, Edit3, Globe, Calendar, Pin } from "lucide-react";
import { LocalBookmark } from "../../db/db";

interface EditBookmarkModalProps {
  isOpen: boolean;
  bookmark: LocalBookmark | null;
  onClose: () => void;
  onSave: (id: string, updates: Partial<LocalBookmark>) => Promise<void>;
  groups: string[];
}

export const EditBookmarkModal: React.FC<EditBookmarkModalProps> = ({
  isOpen,
  bookmark,
  onClose,
  onSave,
  groups,
}) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [group, setGroup] = useState("Unsorted");
  const [remindAt, setRemindAt] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && bookmark) {
      setTitle(bookmark.title || "");
      setUrl(bookmark.url || "");
      setDescription(bookmark.description || "");
      setImage(bookmark.image || "");
      setGroup(bookmark.group || "Unsorted");
      setRemindAt(
        bookmark.remindAt ? new Date(bookmark.remindAt).toISOString().split("T")[0] : ""
      );
      setIsPinned(!!bookmark.isPinned);
    }
  }, [isOpen, bookmark]);

  if (!isOpen || !bookmark) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(bookmark.id, {
        title: title.trim() || url.trim(),
        url: url.trim(),
        description: description.trim(),
        image: image.trim(),
        group: group || "Unsorted",
        remindAt: remindAt ? new Date(remindAt).toISOString() : "",
        isPinned,
      });
      onClose();
    } catch (err) {
      console.error("[Edit Bookmark Error]:", err);
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
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Edit Bookmark
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
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2.5 px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2.5 px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                Group
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)]"
              >
                <option value="Unsorted">Unsorted</option>
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

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editIsPinnedCheck"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-[var(--color-border-default)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <label htmlFor="editIsPinnedCheck" className="text-xs font-medium text-[var(--color-text-primary)] flex items-center gap-1 cursor-pointer">
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
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
