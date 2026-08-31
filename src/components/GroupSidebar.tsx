import React, { useMemo } from 'react'
import { Folder, FolderOpen, Archive, Settings, Plus, Pencil, Trash2, X, LogOut, LogIn, ShieldAlert, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import MarkbelLogo from './MarkbelLogo'

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
  openNewGroup
}) => {
  const navigate = useNavigate()
  const { user, isGuest } = useAuth()

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

  return (
    <aside
      className={`w-64 fixed md:static inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ease-in-out border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="p-4 flex items-center justify-between border-b border-[var(--color-border-default)]">
        <div className="flex items-center gap-3">
          <MarkbelLogo size={28} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              Markbel
            </h1>
          </div>
        </div>
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
          {!isGuest && (
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
          )}
        </div>

        {/* Groups List */}
        <div>
          <div className="flex items-center justify-between px-3 py-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Groups
            </span>
            <button
              onClick={openNewGroup}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-1"
              title="New Group"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            {mergedGroups.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                No groups yet
              </div>
            ) : (
              mergedGroups.map((group) => (
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
                    <div className="flex md:hidden md:group-hover:flex items-center gap-1 bg-[var(--color-bg-default)] rounded px-1 shadow-sm border border-[var(--color-border-default)]">
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
                    <span className="text-xs opacity-60 md:group-hover:hidden">
                      {group.count}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User / Guest Footer */}
      <div className="p-3 border-t border-[var(--color-border-default)] bg-[var(--color-bg-element)] space-y-2">
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
  )
}

