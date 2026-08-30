import React from "react";
import { X, Trash2 } from "lucide-react";
import { LocalBookmark } from "../../db/db";

interface DeleteModalProps {
  isOpen: boolean;
  bookmark: LocalBookmark | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  bookmark,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !bookmark) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2 text-[var(--color-status-error)]">
            <Trash2 className="w-5 h-5" />
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Delete Bookmark
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mb-5 leading-relaxed">
          Are you sure you want to permanently delete{" "}
          <strong className="text-[var(--color-text-primary)] font-semibold">
            "{bookmark.title}"
          </strong>
          ? This change will sync across all your devices.
        </p>

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
            onClick={() => onConfirm(bookmark.id)}
            className="btn-danger px-5 py-2 rounded-lg text-xs font-bold"
          >
            Delete Forever
          </button>
        </div>
      </div>
    </div>
  );
};
