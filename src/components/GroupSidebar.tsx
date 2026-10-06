import React, { useMemo, useEffect, useState } from 'react'
import {
  Folder,
  FolderOpen,
  Archive,
  Settings,
  Plus,
  Pencil,
  Trash2,
  X,
  LogOut,
  LogIn,
  ShieldAlert,
  User,
  Sparkles,
  Smartphone,
  Pin,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import MarkbelLogo from './MarkbelLogo'
import {
  getNavigationPreferences,
  toggleGroupVisibility,
  toggleGroupPin,
  filterAndSortGroups,
  NavigationPreferences,
} from '../lib/navigationPreferences'

interface GroupSidebarProps {
  isSidebarOpen: boolean
  setIsSidebarOpen: (v: boolean) => void
  activeGroup: string | null
  setActiveGroup: (g: string | null) => void
  bookmarks: any[]
  dbGroups: any[]
  logout: () => void
  openEditGroup: (name: string) => void
  deleteGroup: (name: string, e: React.MouseEvent) => void
  openNewGroup: () => void
  onAutoOrganize?: () => void
  pinnedCategoryNames?: string[]
  onTogglePin?: (name: string) => void
}

export const GroupSidebar: React.FC<GroupSidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activeGroup,
  setActiveGroup,
  bookmarks,
  dbGroups,
  logout,
  openEditGroup,
  deleteGroup,
  openNewGroup,
  onAutoOrganize,
  pinnedCategoryNames = [],
  onTogglePin,
}) => {
  const navigate = useNavigate()
  const { user, isGuest } = useAuth()

  const [navPrefs, setNavPrefs] = useState<NavigationPreferences>(() =>
    getNavigationPreferences()
  )
  const [isHiddenTrayOpen, setIsHiddenTrayOpen] = useState(false)

  useEffect(() => {
    const handlePrefsChanged = (e: any) => {
      if (e.detail) {
        setNavPrefs(e.detail)
      } else {
        setNavPrefs(getNavigationPreferences())
      }
    }
    window.addEventListener('markbel_nav_preferences_changed', handlePrefsChanged)
    return () => {
      window.removeEventListener('markbel_nav_preferences_changed', handlePrefsChanged)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (isSidebarOpen) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSidebarOpen])

  const mergedGroups = useMemo(() => {
    const map = new Map<string, number>()
    dbGroups.forEach((g) => {
      if (g.name !== "Unsorted") map.set(g.name, 0)
    })
    bookmarks.forEach((b) => {
      const g = b.group || "Unsorted"
      if (g !== "Unsorted") map.set(g, (map.get(g) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [bookmarks, dbGroups])

  const { visibleGroups, hiddenGroups } = useMemo(() => {
    return filterAndSortGroups(mergedGroups, navPrefs)
  }, [mergedGroups, navPrefs])

  const handleTogglePinLocal = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = toggleGroupPin(name)
    setNavPrefs(next)
    if (onTogglePin) onTogglePin(name)
  }

  const handleToggleHideLocal = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = toggleGroupVisibility(name)
    setNavPrefs(next)
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 ease-in-out cursor-pointer"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`w-64 fixed md:static inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ease-in-out border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-2xl md:shadow-none ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
      <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center justify-between border-b border-[var(--color-border-default)]">
        <button
          onClick={() => {
            setIsSidebarOpen(false);
            navigate("/");
          }}
          className="flex items-center gap-3 text-left hover:opacity-85 transition-opacity cursor-pointer select-none"
          title="Markbel - About & Downloads"
        >
          <MarkbelLogo size={28} className="shadow-xs" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] select-none">
              Markbel
            </h1>
          </div>
        </button>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] active:scale-95 rounded-md transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          <button
            onClick={() => {
              setActiveGroup(null);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              !activeGroup
                ? "bg-[var(--color-bg-element)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            All Bookmarks
          </button>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              navigate("/archive");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Archive className="w-4 h-4" />
            Archive
          </button>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              navigate("/");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Smartphone className="w-4 h-4" />
            About & Downloads
          </button>
          <button
            onClick={() => {
              setIsSidebarOpen(false);
              navigate("/settings");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>

        {/* Groups List */}
        <div>
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Groups
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  navigate("/settings#navigation");
                }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
                title="Customize Navigation & Groups"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              {onAutoOrganize && (
                <button
                  onClick={onAutoOrganize}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
                  title="Auto-Organize Vault into Smart Groups (YT, Insta, X)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={openNewGroup}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
                title="New Group"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visible Groups List */}
          <div className="space-y-0.5">
            {visibleGroups.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                {hiddenGroups.length > 0
                  ? "All groups hidden"
                  : "No groups yet"}
              </div>
            ) : (
              visibleGroups.map((group) => {
                return (
                  <button
                    key={group.name}
                    onClick={() => {
                      setActiveGroup(group.name);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors group ${
                      activeGroup === group.name
                        ? "bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-medium"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span className="truncate">{group.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Action Toolbar on Hover */}
                      <div className="flex md:hidden md:group-hover:flex items-center gap-0.5 bg-[var(--color-bg-default)] rounded px-1 shadow-xs border border-[var(--color-border-default)]">
                        <div
                          onClick={(e) => handleTogglePinLocal(group.name, e)}
                          className={`p-1.5 active:scale-90 cursor-pointer transition-colors ${
                            group.isPinned
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                          }`}
                          title={group.isPinned ? "Unpin from top" : "Pin to top of sidebar"}
                        >
                          <Pin
                            className={`w-3.5 h-3.5 ${
                              group.isPinned ? "fill-current" : ""
                            }`}
                          />
                        </div>

                        <div
                          onClick={(e) => handleToggleHideLocal(group.name, e)}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:scale-90 cursor-pointer"
                          title="Hide group from sidebar"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </div>

                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditGroup(group.name);
                            setIsSidebarOpen(false);
                          }}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:scale-90 cursor-pointer"
                          title="Edit Group"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </div>

                        <div
                          onClick={(e) => {
                            setIsSidebarOpen(false);
                            deleteGroup(group.name, e);
                          }}
                          className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-status-error)] active:scale-90 cursor-pointer"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                      </div>

                      {/* Default State: Pin Indicator & Count */}
                      <div className="flex items-center gap-1 md:group-hover:hidden">
                        {group.isPinned && (
                          <Pin className="w-3 h-3 text-[var(--color-accent)] fill-current shrink-0" />
                        )}
                        <span className="text-xs opacity-60">{group.count}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Collapsible Hidden Groups Tray */}
          {hiddenGroups.length > 0 && (
            <div className="pt-2 mt-2 border-t border-[var(--color-border-default)]/60">
              <button
                type="button"
                onClick={() => setIsHiddenTrayOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {isHiddenTrayOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>
                    {hiddenGroups.length} Hidden Group{hiddenGroups.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-[10px] font-mono opacity-70">
                  {hiddenGroups.reduce((acc, g) => acc + g.count, 0)} links
                </span>
              </button>

              {isHiddenTrayOpen && (
                <div className="mt-1 space-y-0.5 pl-2 animate-in fade-in duration-150">
                  {hiddenGroups.map((group) => {
                    return (
                      <div
                        key={group.name}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors group ${
                          activeGroup === group.name
                            ? "bg-[var(--color-bg-element)] text-[var(--color-text-primary)] font-medium"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveGroup(group.name);
                            setIsSidebarOpen(false);
                          }}
                          className="flex items-center gap-2 truncate flex-1 text-left cursor-pointer"
                        >
                          <Folder className="w-3.5 h-3.5 opacity-50 shrink-0" />
                          <span className="truncate">{group.name}</span>
                          <span className="text-[10px] opacity-60">
                            ({group.count})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleToggleHideLocal(group.name, e)}
                          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-element)] rounded transition-colors active:scale-90 cursor-pointer shrink-0"
                          title="Unhide group to sidebar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* User / Guest Footer */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--color-border-default)] bg-[var(--color-bg-element)] space-y-2">
        {isGuest ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs text-[var(--color-text-muted)]">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate font-medium">Guest Mode (Local)</span>
            </div>
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                navigate("/login");
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold btn-primary rounded-md transition-all active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sync</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-xs font-bold">
                {user?.name ? user.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{user?.name || "User"}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">{user?.email || ""}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--color-status-error)] hover:bg-red-50 active:scale-95 rounded-md transition-all whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  )
}

