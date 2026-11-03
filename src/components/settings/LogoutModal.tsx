import React from "react";
import { Loader2, LogOut, X as CloseIcon } from "lucide-react";

interface LogoutModalProps {
  isOpen: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  onClose: () => void;
  onDiscardAndLogout: () => Promise<void>;
  onSyncAndLogout: () => Promise<void>;
}

export default function LogoutModal({
  isOpen,
  unsyncedCount,
  isSyncing,
  onClose,
  onDiscardAndLogout,
  onSyncAndLogout,
}: LogoutModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSyncing) {
          onClose();
        }
      }}
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <LogOut className="w-5 h-5" />
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Unsynced Changes Warning
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          You have <strong className="text-[var(--color-text-primary)] font-semibold">{unsyncedCount}</strong> unsynced change{unsyncedCount === 1 ? "" : "s"} in your offline outbox. If you sign out now without syncing, these offline changes will be purged from this device.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSyncing}
            className="min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer order-3 sm:order-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscardAndLogout}
            disabled={isSyncing}
            className="min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-status-error)] hover:bg-red-500/10 cursor-pointer order-2"
          >
            Discard and Sign Out
          </button>
          <button
            type="button"
            onClick={onSyncAndLogout}
            disabled={isSyncing}
            className="btn-primary min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer order-1 sm:order-3"
          >
            {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Sync Now and Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
