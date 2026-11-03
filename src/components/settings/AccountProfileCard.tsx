import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle,
  Clock,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { api } from "../../lib/api.js";
import { enableWebPush } from "../../lib/push.js";
import { db } from "../../db/db.js";

interface AccountProfileCardProps {
  user: { id?: string; name?: string; email?: string } | null;
  isGuestMode: boolean;
  onNavigate: (path: string) => void;
  onNotice: (msg: string) => void;
  onLogout: () => Promise<void>;
}

export default function AccountProfileCard({
  user,
  isGuestMode,
  onNavigate,
  onNotice,
  onLogout,
}: AccountProfileCardProps) {
  const isNative = Capacitor.isNativePlatform();

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Push Notifications State
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Danger Zone Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      ("PushManager" in window || "Notification" in window);
    setPushSupported(isSupported);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          if (reg.pushManager) {
            reg.pushManager.getSubscription().then((sub) => {
              setPushSubscribed(Boolean(sub));
            });
          }
        })
        .catch((err) => {
          console.warn("Service Worker registration check:", err);
        });
    }
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(res.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 5000);
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : "Failed to update password. Please check your current password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSubscribePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      const sub = await enableWebPush();
      if (sub) {
        setPushSubscribed(true);
        onNotice("Push notifications successfully enabled on this device.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to enable push: " + msg);
    } finally {
      setPushLoading(false);
    }
  };

  const handleUnsubscribePush = async () => {
    setPushLoading(true);
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          setPushSubscribed(false);
          onNotice("Push notifications disabled on this device.");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to unsubscribe: " + msg);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    try {
      if (isGuestMode) {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Markbel Push Test", {
            body: "Local notification test successful! Notifications are active on this device.",
            icon: "/pwa-192x192.png",
          });
          onNotice("Local notification dispatched.");
        } else {
          onNotice("Push notifications require an account for cloud dispatch or permission grant.");
        }
        return;
      }
      await api.post("/notifications/test", {});
      onNotice("Test push notification dispatched.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to send test push: " + msg);
    } finally {
      setPushLoading(false);
    }
  };

  const handlePurgeAccountData = async () => {
    setIsDeleting(true);
    try {
      await Promise.all([
        db.bookmarks.clear(),
        db.groups.clear(),
        db.syncOutbox.clear(),
      ]);
      localStorage.removeItem("markbel_token");
      localStorage.removeItem("markbel_user");
      setShowDeleteModal(false);
      onNotice("Local vault database purged successfully.");
      await onLogout();
    } catch (err) {
      console.error("Purge account data error:", err);
      alert("Failed to purge data: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Account Details Card */}
      <section className="studio-card p-4 sm:p-6 relative space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Account Profile
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {isGuestMode ? "Local offline vault status" : "Authenticated session information"}
              </p>
            </div>
          </div>
          {isGuestMode && (
            <span className="text-[10px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-2.5 py-1 rounded uppercase tracking-wider">
              Guest Mode
            </span>
          )}
        </div>

        {isGuestMode ? (
          <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                  Local Vault (Guest Mode)
                </h4>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xl leading-relaxed">
                  Bookmarks, presets, and auto-categorization rules are saved locally on this device in IndexedDB. Sign in or sign up to synchronize your bookmarks across all devices via Cloudflare D1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("/login?redirect=/settings")}
                className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-center"
              >
                <span>Sign In or Sign Up</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]">
              <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-bold mb-1">
                Full Name
              </span>
              <span className="text-[var(--color-text-primary)] font-semibold">
                {user?.name || "Markbel User"}
              </span>
            </div>

            <div className="p-3 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]">
              <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-bold mb-1">
                Email Address
              </span>
              <span className="text-[var(--color-text-primary)] font-semibold">
                {user?.email}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 2. Security & Password Card */}
      <section className="studio-card p-4 sm:p-6 relative space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border-default)] pb-4">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-border-default)] text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Security & Password
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Update your account password
            </p>
          </div>
        </div>

        {isGuestMode ? (
          <div className="p-4 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-muted)] flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--color-text-muted)] shrink-0" />
            <p>
              Password management is only applicable for Cloudflare D1 synchronized accounts. Local vault data on this device does not require a cloud password.
            </p>
          </div>
        ) : (
          <>
            {passwordSuccess && (
              <div className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-status-success)]/40 text-[var(--color-text-primary)] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle className="w-4 h-4 text-[var(--color-status-success)] shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-status-error)]/40 text-[var(--color-text-primary)] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-[var(--color-status-error)] shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3.5 max-w-md">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase block mb-1">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                  className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {passwordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {/* 3. Cross-Device Web Push Card */}
      {!isNative && (
        <section className="studio-card p-4 sm:p-6 relative space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold rounded">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
                  Cross-Device Web Push
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Receive due reminders and instant save alerts on your device
                </p>
              </div>
            </div>

            <div>
              {pushSubscribed ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-status-success)] bg-[var(--color-bg-element)] border border-[var(--color-status-success)]/30 px-2.5 py-1 rounded uppercase">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Active Device</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-[var(--color-bg-element)] border border-amber-500/30 px-2.5 py-1 rounded uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Inactive</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed font-medium">
              Enable browser Service Worker push notifications on this device to
              receive scheduled reminder alerts and quick-save confirmations.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              {pushSubscribed ? (
                <>
                  <button
                    onClick={handleUnsubscribePush}
                    disabled={pushLoading}
                    className="btn-secondary px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Disable Push On This Device
                  </button>
                  <button
                    onClick={handleTestPush}
                    disabled={pushLoading}
                    className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Send Test Push Now</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSubscribePush}
                  disabled={pushLoading || !pushSupported}
                  className="btn-primary px-5 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  {pushLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                  <span>
                    {pushSupported
                      ? "Enable Push Notifications"
                      : "Push Not Supported"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Danger Zone */}
      <section className="studio-card p-4 sm:p-6 relative space-y-4 border-red-500/30 bg-red-500/5">
        <div className="flex items-center gap-2.5 border-b border-red-500/20 pb-4">
          <div className="w-7 h-7 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold rounded">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">
              Danger Zone
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Destructive local storage and account operations
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-[var(--color-bg-surface)] border border-red-500/20">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
              {isGuestMode ? "Purge Local Vault Data" : "Clear Device Vault & Sign Out"}
            </h4>
            <p className="text-xs text-[var(--color-text-muted)] max-w-xl">
              Permanently purges all bookmarks, groups, and sync queues cached in IndexedDB on this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="btn-danger px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Local Data</span>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 border-b border-[var(--color-border-default)] pb-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Confirm Local Vault Purge
              </h3>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Are you sure you want to purge all local bookmarks and cached vault data from this device? This action is irreversible unless your data has already been synchronized to Cloudflare D1.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeAccountData}
                disabled={isDeleting}
                className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
