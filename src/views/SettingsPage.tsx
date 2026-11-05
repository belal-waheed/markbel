import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  LogOut,
  User as UserIcon,
  Palette,
  Folder,
  Users,
  Database,
  Key,
  Search,
  X,
  Tv,
  CheckSquare,
  Cloud,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import MarkbelLogo from "../components/MarkbelLogo.js";
import {
  api,
  ApiToken,
  CreateTokenResponse,
  agentApi,
  VaultCollaborator,
} from "../lib/api.js";
import { useAuth } from "../lib/auth.js";
import { syncManager } from "../db/SyncManager.js";
import { SyncState } from "../sync/index.js";
import { useModalBackNavigation } from "../lib/useModalBackNavigation.js";
import {
  getNavigationPreferences,
  setNavigationPreferences,
  toggleGroupVisibility,
  toggleGroupPin,
  NavigationPreferences,
} from "../lib/navigationPreferences.js";
import {
  getCustomSmartGroupRules,
  CompoundSmartGroupRule,
} from "../lib/smartGroups.js";
import { db, deduplicateLocalGroups } from "../db/db.js";

// Feature Cards
import AccountProfileCard from "../components/settings/AccountProfileCard.js";
import AppearanceCard from "../components/settings/AppearanceCard.js";
import NavigationPreferencesCard from "../components/settings/NavigationPreferencesCard.js";
import SmartGroupsCard from "../components/settings/SmartGroupsCard.js";
import ApiTokensCard from "../components/settings/ApiTokensCard.js";
import McpStudioCard from "../components/settings/McpStudioCard.js";
import VaultCollaborationCard from "../components/settings/VaultCollaborationCard.js";
import DataBackupCard from "../components/settings/DataBackupCard.js";
import TickTickIntegrationCard from "../components/settings/TickTickIntegrationCard.js";
import SeriesProgressionCard from "../components/settings/SeriesProgressionCard.js";
import LogoutModal from "../components/settings/LogoutModal.js";

export type SettingsTab = "general" | "groups" | "sync" | "storage" | "api" | "series";

const getTabFromHash = (hash: string): SettingsTab => {
  const clean = hash.replace(/^#/, "").toLowerCase();
  if (clean === "groups" || clean === "categories") return "groups";
  if (clean === "navigation") return "general";
  if (clean === "sync" || clean === "collaboration") return "sync";
  if (clean === "storage" || clean === "backup" || clean === "data") return "storage";
  if (clean === "series" || clean === "episodic" || clean === "anime") return "series";
  if (clean === "api" || clean === "mcp" || clean === "tokens" || clean === "integrations" || clean === "ticktick") return "api";
  return "general";
};

export default function SettingsPage() {
  const { user, token, isGuest, logout } = useAuth();
  const isGuestMode = isGuest || !token || !user;
  const navigate = useNavigate();

  // Settings Search Omnibox State
  const [searchQuery, setSearchQuery] = useState("");

  // Sync Manager Status
  const [syncStatus, setSyncStatus] = useState<SyncState>(SyncState.Idle);

  useEffect(() => {
    return syncManager.subscribe((st) => setSyncStatus(st));
  }, []);

  // Active Tab State with URL Hash Synchronization
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      return getTabFromHash(window.location.hash);
    }
    return "general";
  });

  const handleSelectTab = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.location.hash = tab;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== "undefined") {
        setActiveTab(getTabFromHash(window.location.hash));
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Notice Toast State
  const [noticeMessage, setNoticeMessage] = useState("");
  const showNotice = (msg: string) => {
    setNoticeMessage(msg);
    setTimeout(() => setNoticeMessage(""), 4000);
  };

  // Logout Modal State
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [unsyncedLogoutCount, setUnsyncedLogoutCount] = useState(0);
  const [isSyncingAndLoggingOut, setIsSyncingAndLoggingOut] = useState(false);

  // Navigation Preferences State
  const [navPrefs, setNavPrefs] = useState<NavigationPreferences>(() =>
    getNavigationPreferences()
  );
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});

  const handleUpdateNavPrefs = (
    updates: Partial<NavigationPreferences>,
    feedbackMsg?: string
  ) => {
    const updated = setNavigationPreferences(updates);
    setNavPrefs(updated);
    if (feedbackMsg) showNotice(feedbackMsg);
  };

  const handleToggleVisibility = (groupName: string) => {
    const updated = toggleGroupVisibility(groupName);
    setNavPrefs(updated);
    const isHidden = updated.hiddenGroupNames.includes(groupName);
    showNotice(
      `Group "${groupName}" ${isHidden ? "hidden from" : "visible in"} sidebar.`
    );
  };

  const handleTogglePin = (groupName: string) => {
    const updated = toggleGroupPin(groupName);
    setNavPrefs(updated);
    const isPinned = updated.pinnedGroupNames.includes(groupName);
    showNotice(
      `Group "${groupName}" ${isPinned ? "pinned to top" : "unpinned from top"}.`
    );
  };

  // Smart Groups Rules & Available Groups
  const [customRules, setCustomRules] = useState<CompoundSmartGroupRule[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [groupColorMap, setGroupColorMap] = useState<Record<string, string>>({});

  const refreshGroupsAndRules = async () => {
    try {
      const [rules, groups, bookmarks] = await Promise.all([
        getCustomSmartGroupRules(),
        db.groups.filter((g) => !g.deletedAt).toArray(),
        db.bookmarks.filter((b) => !b.deletedAt && !b.isArchived).toArray(),
      ]);
      setCustomRules(rules);

      const uniqueGroupsMap = new Map<string, (typeof groups)[0]>();
      groups.forEach((g) => {
        const key = (g.name || "").trim().toLowerCase();
        if (key && !uniqueGroupsMap.has(key)) {
          uniqueGroupsMap.set(key, g);
        }
      });
      const uniqueGroups = Array.from(uniqueGroupsMap.values());

      const names = uniqueGroups.map((g) => g.name);
      const colorMap: Record<string, string> = {};
      uniqueGroups.forEach((g) => {
        colorMap[g.name.toLowerCase()] = g.color;
      });
      const counts: Record<string, number> = {};
      bookmarks.forEach((b) => {
        const g = b.group || "Unsorted";
        counts[g] = (counts[g] || 0) + 1;
      });
      setGroupCounts(counts);
      setAvailableGroups(names);
      setGroupColorMap(colorMap);
    } catch (err) {
      console.warn("Failed to load rules and groups:", err);
    }
  };

  useEffect(() => {
    deduplicateLocalGroups().finally(() => {
      refreshGroupsAndRules();
    });
    if (typeof window !== "undefined" && window.location.hash === "#navigation") {
      const el = document.getElementById("navigation");
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 150);
      }
    }
  }, []);

  // API Tokens State
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<CreateTokenResponse | null>(null);

  const loadTokens = async () => {
    if (isGuestMode) return;
    setTokensLoading(true);
    setTokenError("");
    try {
      const data = await api.getTokens();
      setTokens(data);
    } catch (err: unknown) {
      console.warn("Failed to load API tokens:", err);
      setTokenError(err instanceof Error ? err.message : "Failed to load API tokens");
    } finally {
      setTokensLoading(false);
    }
  };

  // Collaborators State
  const [collaborators, setCollaborators] = useState<VaultCollaborator[]>([]);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState("");

  const loadCollaborators = async () => {
    if (isGuestMode) return;
    setCollabLoading(true);
    setCollabError("");
    try {
      const res = await agentApi.listCollaborators();
      setCollaborators(res.collaborators || []);
    } catch (err: unknown) {
      console.warn("Failed to load collaborators:", err);
      setCollabError(err instanceof Error ? err.message : "Failed to load collaborators");
    } finally {
      setCollabLoading(false);
    }
  };

  useEffect(() => {
    if (!isGuestMode) {
      loadTokens();
      loadCollaborators();
    }
  }, [isGuestMode]);

  useModalBackNavigation([
    { isOpen: showLogoutModal, close: () => setShowLogoutModal(false) },
  ]);

  const handleInitiateLogout = async () => {
    try {
      const count = await db.syncOutbox.count();
      if (count > 0) {
        setUnsyncedLogoutCount(count);
        setShowLogoutModal(true);
        return;
      }
    } catch (e) {
      console.warn("Failed to check sync outbox count:", e);
    }
    await logout();
    navigate("/login");
  };

  const handleSyncAndLogout = async () => {
    setIsSyncingAndLoggingOut(true);
    try {
      await syncManager.sync(true);
    } catch (err) {
      console.warn("Sync before logout failed:", err);
    }
    await logout();
    setIsSyncingAndLoggingOut(false);
    setShowLogoutModal(false);
    navigate("/login");
  };

  const handleDiscardAndLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    navigate("/login");
  };

  const tabsConfig = [
    { id: "general" as SettingsTab, label: "General & Appearance", icon: Palette },
    { id: "groups" as SettingsTab, label: "Smart Groups & Rules", icon: Folder },
    { id: "series" as SettingsTab, label: "Series Progression", icon: Tv },
    { id: "sync" as SettingsTab, label: "Sync & Collaboration", icon: Users },
    { id: "api" as SettingsTab, label: "Integrations & API", icon: Key },
    { id: "storage" as SettingsTab, label: "Storage & Data", icon: Database },
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] space-y-6">
      {/* Toast Notice */}
      {noticeMessage && (
        <div className="p-3 bg-[var(--color-bg-muted)] border border-[var(--color-accent)]/40 text-[var(--color-text-primary)] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Mobile Top Header (< lg:) */}
      <div className="lg:hidden flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/app")}
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95 shrink-0 cursor-pointer"
            title="Back to Bookmarks"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <MarkbelLogo size={24} className="shadow-xs shrink-0" />
            <h1 className="text-base font-bold tracking-tight text-[var(--color-text-primary)] truncate">
              Settings
            </h1>
          </div>
        </div>

        {!isGuestMode ? (
          <button
            onClick={handleInitiateLogout}
            className="min-h-[36px] px-3 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold text-[var(--color-status-error)] hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            onClick={() => navigate("/login?redirect=/settings")}
            className="min-h-[36px] px-3 py-1 flex items-center gap-1 rounded-lg text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] active:scale-95 transition-all cursor-pointer border border-[var(--color-accent)]/20"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      {/* Mobile Search Omnibox (< lg:) */}
      <div className="lg:hidden relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search settings, tokens, rules, themes..."
          className="w-full bg-[var(--color-bg-muted)]/70 hover:bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] rounded-lg py-2 pl-9 pr-8 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-sans transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Mobile Horizontal Pill Selector (< lg:) */}
      <div className="lg:hidden flex items-center gap-1.5 p-1 bg-[var(--color-bg-muted)]/80 border border-[var(--color-border-subtle)] rounded-xl overflow-x-auto custom-scrollbar">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)]/60 border border-transparent"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)]"
                }`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Master-Detail Split Layout (Desktop & Tablet) */}
      <div className="lg:flex lg:gap-8 lg:items-start">
        {/* Left Sticky Master Navigation Rail (Desktop >= lg:) */}
        <aside className="hidden lg:flex flex-col w-[280px] shrink-0 sticky top-6 space-y-5 studio-card p-4">
          {/* Header Link */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
            <button
              onClick={() => navigate("/app")}
              className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer select-none"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Vault</span>
            </button>
            <MarkbelLogo size={22} className="shadow-xs" />
          </div>

          {/* Account Profile Summary Badge */}
          <div className="p-3 rounded-lg bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] space-y-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold text-xs flex items-center justify-center shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "MB"}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-[var(--color-text-primary)] block truncate">
                  {user?.name || (isGuestMode ? "Guest Vault" : "Authenticated User")}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] block truncate">
                  {user?.email || (isGuestMode ? "Local device storage" : "Cloud synchronized")}
                </span>
              </div>
            </div>

            {/* Sync State Badge */}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border-subtle)] text-[10px]">
              <span className="text-[var(--color-text-tertiary)]">Cloud Sync</span>
              <span className="flex items-center gap-1 font-mono text-[var(--color-text-secondary)]">
                {syncStatus === SyncState.Syncing ? (
                  <>
                    <RefreshCw className="w-2.5 h-2.5 animate-spin text-[var(--color-accent)]" />
                    <span>Syncing</span>
                  </>
                ) : syncStatus === SyncState.Error ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Error</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-2.5 h-2.5 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Ready</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Search Omnibox */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[var(--color-text-tertiary)]">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter settings & tools..."
              className="w-full bg-[var(--color-bg-muted)]/70 hover:bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] rounded-lg py-1.5 pl-8 pr-7 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-sans transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Vertical Master Tabs Navigation */}
          <nav className="space-y-1">
            {tabsConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                    isActive
                      ? "bg-[var(--color-accent)] text-white shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sign Out / Sign In Footer */}
          <div className="pt-3 border-t border-[var(--color-border-subtle)]">
            {!isGuestMode ? (
              <button
                onClick={handleInitiateLogout}
                className="w-full py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[var(--color-status-error)] hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer border border-transparent hover:border-red-500/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate("/login?redirect=/settings")}
                className="w-full py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-brand-subtle)] active:scale-95 transition-all cursor-pointer border border-[var(--color-accent)]/20"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </aside>

        {/* Right Detail Workbench */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* TAB 1: General & Appearance */}
          {activeTab === "general" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <AccountProfileCard
                user={user}
                isGuestMode={isGuestMode}
                onNavigate={navigate}
                onNotice={showNotice}
                onLogout={logout}
              />

              <AppearanceCard onNotice={showNotice} />

              <NavigationPreferencesCard
                navPrefs={navPrefs}
                availableGroups={availableGroups}
                groupCounts={groupCounts}
                groupColorMap={groupColorMap}
                onUpdateNavPrefs={handleUpdateNavPrefs}
                onToggleVisibility={handleToggleVisibility}
                onTogglePin={handleTogglePin}
              />

              <SeriesProgressionCard onNotice={showNotice} />
            </div>
          )}

          {/* TAB 2: Smart Groups & Categories */}
          {activeTab === "groups" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <SmartGroupsCard
                customRules={customRules}
                availableGroups={availableGroups}
                groupColorMap={groupColorMap}
                onRefresh={refreshGroupsAndRules}
                onNotice={showNotice}
              />
            </div>
          )}

          {/* TAB 3: Series Progression */}
          {activeTab === "series" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <SeriesProgressionCard onNotice={showNotice} />
            </div>
          )}

          {/* TAB 4: Sync & Collaboration */}
          {activeTab === "sync" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <VaultCollaborationCard
                collaborators={collaborators}
                collabLoading={collabLoading}
                collabError={collabError}
                isGuestMode={isGuestMode}
                onNotice={showNotice}
                loadCollaborators={loadCollaborators}
              />

              <TickTickIntegrationCard onNotice={showNotice} />
            </div>
          )}

          {/* TAB 5: API & Integrations */}
          {activeTab === "api" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <TickTickIntegrationCard onNotice={showNotice} />

              <ApiTokensCard
                tokens={tokens}
                tokensLoading={tokensLoading}
                tokenError={tokenError}
                isGuestMode={isGuestMode}
                onNavigate={navigate}
                onNotice={showNotice}
                onTokenCreated={(tok) => setNewlyCreatedToken(tok)}
                loadTokens={loadTokens}
              />

              <McpStudioCard
                newlyCreatedToken={newlyCreatedToken}
                hasTokens={tokens.length > 0}
              />
            </div>
          )}

          {/* TAB 6: Storage & Data Manager */}
          {activeTab === "storage" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <DataBackupCard
                onNotice={showNotice}
                onRefresh={refreshGroupsAndRules}
              />
            </div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        unsyncedCount={unsyncedLogoutCount}
        isSyncing={isSyncingAndLoggingOut}
        onClose={() => setShowLogoutModal(false)}
        onDiscardAndLogout={handleDiscardAndLogout}
        onSyncAndLogout={handleSyncAndLogout}
      />
    </div>
  );
}
