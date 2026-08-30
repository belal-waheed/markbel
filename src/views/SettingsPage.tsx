import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Loader2,
  LogOut,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarkbelLogo from "../components/MarkbelLogo.js";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { enableWebPush } from "../lib/push.js";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isNative =
    navigator.userAgent.includes("Electron") || !!(window as any).ReactNativeWebView;

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState("");

  // Check Push status
  useEffect(() => {
    const isSupported =
      "serviceWorker" in navigator &&
      ("PushManager" in window || "Notification" in window);
    setPushSupported(isSupported);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
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

  const handleSubscribePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      const sub = await enableWebPush();
      if (sub) {
        setPushSubscribed(true);
        setNoticeMessage("Push notifications successfully enabled on this device!");
        setTimeout(() => setNoticeMessage(""), 4000);
      }
    } catch (err: any) {
      alert("Failed to enable push: " + err.message);
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
          setNoticeMessage("Push notifications disabled on this device.");
          setTimeout(() => setNoticeMessage(""), 4000);
        }
      }
    } catch (err: any) {
      alert("Failed to unsubscribe: " + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    setPushLoading(true);
    try {
      await api.post("/notifications/test", {});
      setNoticeMessage("Test push notification dispatched!");
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      alert("Failed to send test push: " + err.message);
    } finally {
      setPushLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95"
            title="Back to Bookmarks"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <MarkbelLogo size={28} />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                Settings & Integrations
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Manage your account, device push notifications, and vault preferences
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-[var(--color-status-error)] hover:bg-red-50 active:scale-95 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {noticeMessage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Account Details Card */}
      <section className="studio-card p-6 relative space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border-default)] pb-4">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <UserIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Account Profile
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Authenticated session information
            </p>
          </div>
        </div>

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
      </section>

      {/* Web Push Notifications Card */}
      {!isNative && (
        <section className="studio-card p-6 relative space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center font-bold rounded">
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
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-status-success)] bg-green-50 border border-green-200 px-2.5 py-1 rounded uppercase">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Active Device</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded uppercase">
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
    </div>
  );
}
