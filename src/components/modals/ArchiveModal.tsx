import React, { useState } from "react";
import { X, Archive } from "lucide-react";
import { LocalBookmark } from "../../db/db";

interface ArchiveModalProps {
  isOpen: boolean;
  bookmark: LocalBookmark | null;
  onClose: () => void;
  onConfirm: (id: string, archiveGroup?: string) => Promise<void>;
}

export const ArchiveModal: React.FC<ArchiveModalProps> = ({
  isOpen,
  bookmark,
  onClose,
  onConfirm,
}) => {
  const [archiveGroup, setArchiveGroup] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !bookmark) return null;

  const handleArchive = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(bookmark.id, archiveGroup.trim() || undefined);
      onClose();
    } catch (err) {
      console.error("[Archive Error]:", err);
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
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Archive className="w-5 h-5" />
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Archive Bookmark
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Move <strong className="text-[var(--color-text-primary)] font-semibold">"{bookmark.title}"</strong> to your archive? You can restore it anytime.
          </p>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
              Archive Sub-Folder (Optional)
            </label>
            <input
              type="text"
              value={archiveGroup}
              onChange={(e) => setArchiveGroup(e.target.value)}
              placeholder="e.g. read-later-2026"
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border-default)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Confirm Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
