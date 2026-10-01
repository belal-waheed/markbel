import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCircle,
  Clock,
  Code,
  Copy,
  FileText,
  FlaskConical,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  User as UserIcon,
  Video,
  X as CloseIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarkbelLogo from "../components/MarkbelLogo.js";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { enableWebPush } from "../lib/push.js";
import {
  getCustomSmartGroupRules,
  saveCustomSmartGroupRules,
  installPresetRule,
  uninstallPresetRule,
  inspectSmartGroupMatch,
  calculateRuleSpecificity,
  CompoundSmartGroupRule,
  RuleConstraint,
  ConstraintOperator,
  PRESET_SMART_RULES,
} from "../lib/smartGroups.js";
import { db } from "../db/db.js";

const COLOR_OPTIONS = [
  { name: "blue", label: "Blue", bg: "bg-blue-500" },
  { name: "emerald", label: "Emerald", bg: "bg-emerald-500" },
  { name: "amber", label: "Amber", bg: "bg-amber-500" },
  { name: "red", label: "Red", bg: "bg-red-500" },
  { name: "purple", label: "Purple", bg: "bg-purple-500" },
  { name: "pink", label: "Pink", bg: "bg-pink-500" },
  { name: "orange", label: "Orange", bg: "bg-orange-500" },
  { name: "slate", label: "Slate", bg: "bg-slate-500" },
];

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  red: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
};

function getGroupBadgeClass(colorName?: string) {
  const c = (colorName || "blue").toLowerCase();
  const style = COLOR_STYLES[c] || COLOR_STYLES.blue;
  return `${style.bg} ${style.text} ${style.border}`;
}

const OPERATOR_CONFIG: Record<
  ConstraintOperator,
  { label: string; placeholder: string; prefix: string }
> = {
  domain_equals: {
    label: "Domain equals",
    placeholder: "e.g. youtube.com or github.com",
    prefix: "Domain =",
  },
  domain_contains: {
    label: "Domain contains",
    placeholder: "e.g. substack or notion",
    prefix: "Domain contains",
  },
  url_contains: {
    label: "URL contains",
    placeholder: "e.g. list= or /playlist or .pdf",
    prefix: "URL contains",
  },
  path_starts_with: {
    label: "Path starts with",
    placeholder: "e.g. /watch or /pull/ or /r/",
    prefix: "Path starts with",
  },
  query_param_exists: {
    label: "Query parameter",
    placeholder: "e.g. list or v=123",
    prefix: "Query param",
  },
};

function getPresetIcon(presetId: string) {
  switch (presetId) {
    case "preset-yt-playlists":
      return <Layers className="w-4 h-4 text-amber-500" />;
    case "preset-yt-videos":
      return <Video className="w-4 h-4 text-red-500" />;
    case "preset-github-repos":
      return <Code className="w-4 h-4 text-emerald-500" />;
    case "preset-reddit":
      return <MessageSquare className="w-4 h-4 text-orange-500" />;
    case "preset-x-twitter":
      return <Share2 className="w-4 h-4 text-slate-500" />;
    case "preset-newsletters":
      return <BookOpen className="w-4 h-4 text-purple-500" />;
    case "preset-academic-pdf":
      return <FileText className="w-4 h-4 text-blue-500" />;
    case "preset-instagram":
      return <Camera className="w-4 h-4 text-pink-500" />;
    default:
      return <Sparkles className="w-4 h-4 text-indigo-500" />;
  }
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isNative =
    navigator.userAgent.includes("Electron") || !!(window as any).ReactNativeWebView;

  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");

  // Auto-Categorization Custom Rules State
  const [customRules, setCustomRules] = useState<CompoundSmartGroupRule[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [groupColorMap, setGroupColorMap] = useState<Record<string, string>>({});
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleError, setRuleError] = useState("");

  // Live Test Sandbox State
  const [sandboxUrl, setSandboxUrl] = useState("");

  // Compound Constraint Builder State
  const [builderRuleName, setBuilderRuleName] = useState("");
  const [builderTargetGroup, setBuilderTargetGroup] = useState("");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("blue");
  const [builderConstraints, setBuilderConstraints] = useState<RuleConstraint[]>([
    { id: crypto.randomUUID(), operator: "domain_equals", value: "" },
  ]);

  const refreshGroupsAndRules = async () => {
    try {
      const [rules, groups] = await Promise.all([
        getCustomSmartGroupRules(),
        db.groups.filter((g) => !g.deletedAt).toArray(),
      ]);
      setCustomRules(rules);
      const names = groups.map((g) => g.name);
      const colorMap: Record<string, string> = {};
      groups.forEach((g) => {
        colorMap[g.name.toLowerCase()] = g.color;
      });
      setAvailableGroups(names);
      setGroupColorMap(colorMap);
      if (names.length > 0 && !builderTargetGroup) {
        setBuilderTargetGroup(names[0]);
      }
    } catch (err) {
      console.warn("Failed to load rules and groups:", err);
    }
  };

  useEffect(() => {
    refreshGroupsAndRules();
  }, []);

  // 1-Click Preset Installation & Removal
  const handleInstallPreset = async (presetId: string) => {
    setRulesLoading(true);
    setRuleError("");
    try {
      const installed = await installPresetRule(presetId);
      await refreshGroupsAndRules();
      setNoticeMessage(`Preset "${installed.name}" installed and group "${installed.group}" activated.`);
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      setRuleError("Failed to install preset: " + (err.message || String(err)));
    } finally {
      setRulesLoading(false);
    }
  };

  const handleUninstallPreset = async (presetId: string) => {
    setRulesLoading(true);
    setRuleError("");
    try {
      await uninstallPresetRule(presetId);
      await refreshGroupsAndRules();
      setNoticeMessage("Preset rule removed.");
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      setRuleError("Failed to remove preset: " + (err.message || String(err)));
    } finally {
      setRulesLoading(false);
    }
  };

  // Constraint Builder Dynamic Form Handlers
  const handleAddConstraintRow = () => {
    setBuilderConstraints((prev) => [
      ...prev,
      { id: crypto.randomUUID(), operator: "url_contains", value: "" },
    ]);
  };

  const handleUpdateConstraintRow = (
    id: string,
    field: "operator" | "value",
    val: string
  ) => {
    setBuilderConstraints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const handleRemoveConstraintRow = (id: string) => {
    if (builderConstraints.length <= 1) return;
    setBuilderConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveCompoundRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError("");

    const trimmedName = builderRuleName.trim();
    if (!trimmedName) {
      setRuleError("Please provide a name for this auto-categorization rule.");
      return;
    }

    let finalGroup = builderTargetGroup.trim();
    let finalColor = groupColorMap[finalGroup.toLowerCase()] || "blue";

    if (isCreatingNewGroup) {
      finalGroup = newGroupName.trim();
      finalColor = newGroupColor;
      if (!finalGroup) {
        setRuleError("Please enter a name for the new target group.");
        return;
      }

      const existingGroup = availableGroups.find(
        (g) => g.toLowerCase() === finalGroup.toLowerCase()
      );
      if (!existingGroup) {
        const now = new Date().toISOString();
        const newGroupId = crypto.randomUUID();
        const groupRecord = {
          id: newGroupId,
          userId: user?.id || "local-user",
          name: finalGroup,
          color: finalColor,
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        await db.transaction("rw", [db.groups, db.syncOutbox], async () => {
          await db.groups.add(groupRecord);
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: "group",
            entityId: newGroupId,
            operation: "create",
            baseVersion: 0,
            payload: groupRecord,
            status: "pending",
            attempts: 0,
            createdAt: now,
          });
        });
      }
    }

    if (!finalGroup) {
      setRuleError("Please specify or select a target group.");
      return;
    }

    const validConstraints = builderConstraints
      .map((c) => ({
        ...c,
        value: c.value.trim(),
      }))
      .filter((c) => c.value.length > 0);

    if (validConstraints.length === 0) {
      setRuleError("Please add at least one constraint with a non-empty value.");
      return;
    }

    const newRule: CompoundSmartGroupRule = {
      id: crypto.randomUUID(),
      name: trimmedName,
      group: finalGroup,
      groupColor: finalColor,
      constraints: validConstraints,
      isPreset: false,
      createdAt: new Date().toISOString(),
    };

    setRulesLoading(true);
    try {
      const updated = [newRule, ...customRules];
      await saveCustomSmartGroupRules(updated);
      await refreshGroupsAndRules();

      setBuilderRuleName("");
      setIsCreatingNewGroup(false);
      setNewGroupName("");
      setBuilderConstraints([
        { id: crypto.randomUUID(), operator: "domain_equals", value: "" },
      ]);
      setNoticeMessage(`Rule "${trimmedName}" created and active.`);
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      setRuleError("Failed to save rule: " + (err.message || String(err)));
    } finally {
      setRulesLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const updated = customRules.filter((r) => r.id !== id);
    setRulesLoading(true);
    try {
      await saveCustomSmartGroupRules(updated);
      setCustomRules(updated);
      setNoticeMessage("Auto-categorization rule removed.");
      setTimeout(() => setNoticeMessage(""), 4000);
    } catch (err: any) {
      alert("Failed to delete rule: " + (err.message || String(err)));
    } finally {
      setRulesLoading(false);
    }
  };

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

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
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

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

  // Live Sandbox resolution computation
  const sandboxResult = sandboxUrl.trim()
    ? inspectSmartGroupMatch(sandboxUrl.trim(), availableGroups, customRules)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app")}
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
                Manage your account, auto-categorization engine, and device alerts
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

      {/* Security & Password Card */}
      <section className="studio-card p-6 relative space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border-default)] pb-4">
          <div className="w-7 h-7 bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center font-bold rounded">
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

        {passwordSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
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
      </section>

      {/* Multi-Constraint Auto-Categorization & Preset Library */}
      <section className="studio-card p-6 relative space-y-6">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold rounded">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
                Auto-Categorization Engine
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Route bookmarks automatically with multi-constraint rules, 1-click presets, and live testing
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-element)] px-2.5 py-1 rounded border border-[var(--color-border-default)]">
            {customRules.length} {customRules.length === 1 ? "Active Rule" : "Active Rules"}
          </span>
        </div>

        {ruleError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{ruleError}</span>
          </div>
        )}

        {/* 1. Live Sandbox / Rule Tester */}
        <div className="p-4 bg-[var(--color-bg-element)]/60 border border-[var(--color-border-default)] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
              <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
              <span>Live Test Sandbox</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
              Real-Time Heuristics
            </span>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Paste any URL to test how your configured rules and defaults evaluate before saving.
          </p>

          <div className="relative">
            <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={sandboxUrl}
              onChange={(e) => setSandboxUrl(e.target.value)}
              placeholder="e.g. https://www.youtube.com/watch?v=123&list=PLabc"
              className="w-full pl-9 pr-9 py-2 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
            />
            {sandboxUrl && (
              <button
                type="button"
                onClick={() => setSandboxUrl("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-0.5"
                title="Clear input"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {sandboxResult ? (
            <div className="p-3 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg space-y-2 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                    Resolved Group:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-xs border ${getGroupBadgeClass(
                      groupColorMap[sandboxResult.group.toLowerCase()] ||
                        sandboxResult.matchedRule?.groupColor
                    )}`}
                  >
                    <Tag className="w-3 h-3" />
                    <span>{sandboxResult.group}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                    Matched Rule:
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {sandboxResult.ruleName || "Unsorted"}
                  </span>
                  {sandboxResult.isDefault && (
                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] px-2 py-0.5 rounded border border-[var(--color-border-default)]">
                      Default Heuristic
                    </span>
                  )}
                </div>
              </div>

              {sandboxResult.matchedRule && (
                <div className="pt-2 border-t border-[var(--color-border-default)]/60 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-semibold mr-1">
                    Matched Conditions:
                  </span>
                  {sandboxResult.matchedRule.constraints.map((c, idx) => (
                    <span
                      key={c.id || idx}
                      className="inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--color-bg-element)] text-[var(--color-text-primary)] px-2 py-0.5 rounded border border-[var(--color-border-default)]"
                    >
                      <span className="text-[var(--color-text-muted)]">
                        {OPERATOR_CONFIG[c.operator]?.prefix || c.operator}:
                      </span>
                      <span>{c.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--color-text-muted)] italic">
              Awaiting URL input to evaluate resolution logic.
            </p>
          )}
        </div>

        {/* 2. 1-Click Quick Presets Gallery */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>1-Click Preset Library</span>
              </h4>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Instantly activate curated routing workflows with automatic group provisioning
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESET_SMART_RULES.map((preset) => {
              const isInstalled = customRules.some(
                (r) =>
                  r.id === preset.id ||
                  r.name.toLowerCase() === preset.name.toLowerCase()
              );

              return (
                <div
                  key={preset.id}
                  className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-xl flex flex-col justify-between space-y-3 hover:border-[var(--color-accent)]/50 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)]">
                          {getPresetIcon(preset.id)}
                        </div>
                        <span className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">
                          {preset.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getGroupBadgeClass(
                          preset.groupColor
                        )}`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{preset.group}</span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      {preset.constraints.map((c, i) => (
                        <div
                          key={i}
                          className="font-mono text-[9px] text-[var(--color-text-muted)] truncate bg-[var(--color-bg-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-border-default)]/60"
                        >
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {OPERATOR_CONFIG[c.operator]?.prefix}:
                          </span>{" "}
                          {c.value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {isInstalled ? (
                      <button
                        type="button"
                        onClick={() => handleUninstallPreset(preset.id)}
                        disabled={rulesLoading}
                        className="w-full py-1.5 px-2 bg-emerald-500/10 hover:bg-red-500/10 text-emerald-600 hover:text-red-600 border border-emerald-500/20 hover:border-red-500/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                        title="Click to remove preset"
                      >
                        <Check className="w-3 h-3 group-hover:hidden" />
                        <Trash2 className="w-3 h-3 hidden group-hover:inline" />
                        <span className="group-hover:hidden">Installed</span>
                        <span className="hidden group-hover:inline">Uninstall</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallPreset(preset.id)}
                        disabled={rulesLoading}
                        className="w-full py-1.5 px-2 bg-[var(--color-bg-canvas)] hover:bg-[var(--color-accent)] hover:text-white border border-[var(--color-border-default)] hover:border-transparent rounded-lg text-[10px] font-bold text-[var(--color-text-primary)] flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Preset</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Custom Compound Constraint Builder */}
        <form
          onSubmit={handleSaveCompoundRule}
          className="pt-4 border-t border-[var(--color-border-default)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                <span>Compound Constraint Builder</span>
              </h4>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Create custom rules combining multiple conditions evaluated with logical AND
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                Rule Label / Name
              </label>
              <input
                type="text"
                value={builderRuleName}
                onChange={(e) => setBuilderRuleName(e.target.value)}
                placeholder="e.g. YouTube Dev Playlists"
                required
                className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                Target Group
              </label>
              <select
                value={isCreatingNewGroup ? "__NEW__" : builderTargetGroup}
                onChange={(e) => {
                  if (e.target.value === "__NEW__") {
                    setIsCreatingNewGroup(true);
                  } else {
                    setIsCreatingNewGroup(false);
                    setBuilderTargetGroup(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
              >
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__NEW__">+ Create New Group...</option>
              </select>
            </div>
          </div>

          {/* Inline New Group Provisioning */}
          {isCreatingNewGroup && (
            <div className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-accent)]/30 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-text-primary)]">
                  Provision New Vault Group
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewGroup(false)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                    New Group Name
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Tutorials"
                    className="w-full px-3 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                    Group Color Tag
                  </label>
                  <div className="flex items-center gap-2 pt-1">
                    {COLOR_OPTIONS.map((col) => (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setNewGroupColor(col.name)}
                        className={`w-6 h-6 rounded-full ${col.bg} transition-all ${
                          newGroupColor === col.name
                            ? "ring-2 ring-offset-2 ring-[var(--color-accent)] scale-110"
                            : "opacity-75 hover:opacity-100"
                        }`}
                        title={col.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Condition Rows List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
                Constraints (All must match - AND)
              </label>
              <button
                type="button"
                onClick={handleAddConstraintRow}
                className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Condition</span>
              </button>
            </div>

            <div className="space-y-2">
              {builderConstraints.map((constraint, index) => {
                const config = OPERATOR_CONFIG[constraint.operator];

                return (
                  <div
                    key={constraint.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]"
                  >
                    {index > 0 && (
                      <span className="text-[10px] font-bold text-[var(--color-accent)] px-2 py-1 bg-[var(--color-accent)]/10 rounded self-start sm:self-center">
                        AND
                      </span>
                    )}

                    <select
                      value={constraint.operator}
                      onChange={(e) =>
                        handleUpdateConstraintRow(
                          constraint.id,
                          "operator",
                          e.target.value as ConstraintOperator
                        )
                      }
                      className="px-2.5 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-md text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] shrink-0 sm:w-44"
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      value={constraint.value}
                      onChange={(e) =>
                        handleUpdateConstraintRow(
                          constraint.id,
                          "value",
                          e.target.value
                        )
                      }
                      placeholder={config.placeholder}
                      required
                      className="grow px-3 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-md text-xs text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-accent)]"
                    />

                    {builderConstraints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveConstraintRow(constraint.id)}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 rounded hover:bg-red-500/10 transition-colors self-end sm:self-center cursor-pointer"
                        title="Remove condition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={rulesLoading || !builderRuleName.trim()}
              className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {rulesLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Save Compound Rule</span>
            </button>
          </div>
        </form>

        {/* 4. Active Rules List */}
        <div className="pt-4 border-t border-[var(--color-border-default)] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide">
              Active Configured Rules ({customRules.length})
            </h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Compound rules evaluate with higher specificity priority
            </span>
          </div>

          <div className="space-y-2">
            {customRules.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-[var(--color-border-default)] rounded-lg">
                <Globe className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  No custom auto-categorization constraints configured yet.
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Activate a 1-click preset above or create a multi-condition rule to start.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-xl overflow-hidden bg-[var(--color-bg-element)]/40">
                {customRules.map((rule) => {
                  const specificity = calculateRuleSpecificity(rule);
                  const targetGroupColor =
                    groupColorMap[rule.group.toLowerCase()] ||
                    rule.groupColor ||
                    "blue";

                  return (
                    <div
                      key={rule.id}
                      className="p-3.5 hover:bg-[var(--color-bg-hover)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-[var(--color-text-primary)]">
                            {rule.name}
                          </span>

                          {rule.isPreset && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase">
                              Preset
                            </span>
                          )}

                          <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />

                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${getGroupBadgeClass(
                              targetGroupColor
                            )}`}
                          >
                            <Tag className="w-2.5 h-2.5 shrink-0" />
                            <span>{rule.group}</span>
                          </span>

                          <span className="text-[9px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-canvas)] px-1.5 py-0.2 rounded border border-[var(--color-border-default)]">
                            Specificity: {specificity}
                          </span>
                        </div>

                        {/* Connected Condition Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {rule.constraints.map((c, i) => (
                            <span key={c.id || i} className="inline-flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-[9px] font-bold text-[var(--color-accent)] px-1">
                                  AND
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)] px-2 py-0.5 rounded border border-[var(--color-border-default)]">
                                <span className="text-[var(--color-text-muted)]">
                                  {OPERATOR_CONFIG[c.operator]?.prefix || c.operator}:
                                </span>
                                <span>{c.value}</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={rulesLoading}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-500/10 rounded-md transition-colors active:scale-95 disabled:opacity-50 self-end sm:self-center cursor-pointer shrink-0"
                        title="Remove rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
