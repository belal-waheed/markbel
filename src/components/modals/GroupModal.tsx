import React, { useState, useEffect } from "react";
import { X, Folder, FolderPlus } from "lucide-react";

interface GroupModalProps {
  isOpen: boolean;
  initialName?: string;
  onClose: () => void;
  onSave: (name: string, oldName?: string) => Promise<void>;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  initialName = "",
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(name.trim(), initialName || undefined);
      onClose();
    } catch (err) {
      console.error("[Group Save Error]:", err);
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)]">
              {initialName ? <Folder className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {initialName ? "Edit Group Name" : "Create New Group"}
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
              Group Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI Research, Design, Tools"
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-focused)] focus:ring-1 focus:ring-[var(--color-border-focused)]"
              required
              autoFocus
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
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="btn-primary px-5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {initialName ? "Save Changes" : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
