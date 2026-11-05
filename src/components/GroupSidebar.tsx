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
  AlertTriangle,
  User,
  Sparkles,
  Smartphone,
  Pin,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  MoreHorizontal,
  ListVideo,
  BookOpen,
  Code2,
  Share2,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  CheckCircle2,
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

  // Desktop Collapsible Rail Mode
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('markbel_sidebar_collapsed') === 'true'
    }
    return false
  })

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('markbel_sidebar_collapsed', String(next))
      }
      return next
    })
  }

  const [navPrefs, setNavPrefs] = useState<NavigationPreferences>(() =>
    getNavigationPreferences()
  )
  const [isHiddenTrayOpen, setIsHiddenTrayOpen] = useState(false)
  const [mobileMenuOpenGroupName, setMobileMenuOpenGroupName] = useState<string | null>(null)

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
      if (g.name !== 'Unsorted') map.set(g.name, 0)
    })
    bookmarks.forEach((b) => {
      const g = b.group || 'Unsorted'
      if (g !== 'Unsorted') map.set(g, (map.get(g) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [bookmarks, dbGroups])

  const { visibleGroups, hiddenGroups } = useMemo(() => {
    return filterAndSortGroups(mergedGroups, navPrefs)
  }, [mergedGroups, navPrefs])

  const brokenCount = useMemo(() => {
    return bookmarks.filter((b) => b.isBroken && !b.deletedAt && !b.isArchived).length
  }, [bookmarks])

  const mediaCounts = useMemo(() => {
    let videos = 0
    let articles = 0
    let code = 0
    let social = 0

    bookmarks.forEach((b) => {
      if (b.deletedAt || b.isArchived) return
      if (b.contentType === 'playlist' || b.contentType === 'video' || b.url.includes('youtube.com') || b.url.includes('youtu.be')) {
        videos++
      }
      if (b.contentType === 'article' || Boolean(b.articleContent)) {
        articles++
      }
      if (b.url.includes('github.com') || b.url.includes('gitlab.com')) {
        code++
      }
      if (b.url.includes('twitter.com') || b.url.includes('x.com') || b.url.includes('instagram.com') || b.url.includes('reddit.com')) {
        social++
      }
    })

    return { videos, articles, code, social }
  }, [bookmarks])

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

      {/* Main Aside Container (Responsive: drawer on mobile, expanded/rail on desktop) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-2xl md:shadow-none ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-14' : 'md:w-64'}`}
      >
        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            COLLAPSED RAIL MODE (Desktop Only: 56px/60px width)
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {isCollapsed ? (
          <div className="hidden md:flex flex-col h-full justify-between items-center py-3 select-none">
            {/* Top: Logo & Expand Trigger */}
            <div className="flex flex-col items-center gap-3 w-full">
              <button
                onClick={() => navigate('/')}
                className="p-1 hover:opacity-85 transition-opacity cursor-pointer"
                title="Markbel - About & Downloads"
              >
                <MarkbelLogo size={24} className="shadow-xs" />
              </button>

              <button
                onClick={toggleCollapsed}
                className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>

              <div className="w-8 h-[1px] bg-[var(--color-border-subtle)] my-1" />

              {/* Core Vault Icons */}
              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup(null)
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer relative ${
                  !activeGroup
                    ? 'bg-[var(--color-accent)] text-white shadow-xs'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]'
                }`}
                title="All Bookmarks"
              >
                <FolderOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/app/archive')}
                className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors cursor-pointer"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup('__broken__')
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer relative ${
                  activeGroup === '__broken__'
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)]'
                }`}
                title={`Broken Links (${brokenCount})`}
              >
                <AlertTriangle className={`w-4 h-4 ${brokenCount > 0 ? 'text-amber-500' : ''}`} />
                {brokenCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>

              <div className="w-8 h-[1px] bg-[var(--color-border-subtle)] my-1" />

              {/* Media Streams Icons */}
              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup('__media_video__')
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeGroup === '__media_video__'
                    ? 'bg-red-500/20 text-red-500'
                    : 'text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-[var(--color-bg-muted)]'
                }`}
                title={`Videos & Playlists (${mediaCounts.videos})`}
              >
                <ListVideo className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup('__media_article__')
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeGroup === '__media_article__'
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'text-[var(--color-text-tertiary)] hover:text-blue-400 hover:bg-[var(--color-bg-muted)]'
                }`}
                title={`Articles & News (${mediaCounts.articles})`}
              >
                <BookOpen className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup('__media_code__')
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeGroup === '__media_code__'
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'text-[var(--color-text-tertiary)] hover:text-emerald-400 hover:bg-[var(--color-bg-muted)]'
                }`}
                title={`Code & Repositories (${mediaCounts.code})`}
              >
                <Code2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  navigate('/app')
                  setActiveGroup('__media_social__')
                }}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  activeGroup === '__media_social__'
                    ? 'bg-purple-500/20 text-purple-500'
                    : 'text-[var(--color-text-tertiary)] hover:text-purple-400 hover:bg-[var(--color-bg-muted)]'
                }`}
                title={`Social & Threads (${mediaCounts.social})`}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Rail: Settings & Profile Icon */}
            <div className="flex flex-col items-center gap-2 w-full">
              <button
                onClick={() => navigate('/app/settings')}
                className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors cursor-pointer"
                title="Settings & Integrations"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (isGuest) {
                    navigate('/login')
                  } else {
                    navigate('/app/settings')
                  }
                }}
                className="w-7 h-7 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] flex items-center justify-center text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
                title={isGuest ? 'Guest Mode (Click to Sign In)' : user?.email || 'User Profile'}
              >
                {isGuest ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                ) : user?.name ? (
                  user.name[0].toUpperCase()
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             EXPANDED FULL SIDEBAR MODE (Desktop & Mobile Drawer)
             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
          <>
            {/* Header: Logo, Title, and Collapse/Close controls */}
            <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center justify-between border-b border-[var(--color-border-subtle)]">
              <button
                onClick={() => {
                  setIsSidebarOpen(false)
                  navigate('/')
                }}
                className="flex items-center gap-2.5 text-left hover:opacity-85 transition-opacity cursor-pointer select-none"
                title="Markbel - About & Downloads"
              >
                <MarkbelLogo size={26} className="shadow-xs" />
                <div>
                  <h1 className="text-base font-bold tracking-tight text-[var(--color-text-primary)] select-none">
                    Markbel
                  </h1>
                </div>
              </button>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Toggle */}
                <button
                  onClick={toggleCollapsed}
                  className="hidden md:flex p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-md transition-all cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>

                {/* Mobile Close Button */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="md:hidden p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] active:scale-95 rounded-md transition-all"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Navigation Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-5">
              {/* SECTION 1: CORE VAULT */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Vault
                </span>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup(null)
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    !activeGroup
                      ? 'bg-[var(--color-brand-subtle)] text-[var(--color-accent)] font-bold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-4 h-4" />
                    <span>All Bookmarks</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">
                    {bookmarks.filter((b) => !b.deletedAt && !b.isArchived).length}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false)
                    navigate('/app/archive')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup('__broken__')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    activeGroup === '__broken__'
                      ? 'bg-amber-500/15 text-amber-500 font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Broken Links</span>
                  </div>
                  {brokenCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      {brokenCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setIsSidebarOpen(false)
                    navigate('/')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>About & Downloads</span>
                </button>
              </div>

              {/* SECTION 2: MEDIA STREAMS */}
              <div className="space-y-1">
                <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Media Streams
                </span>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup('__media_video__')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeGroup === '__media_video__'
                      ? 'bg-red-500/15 text-red-500 font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ListVideo className="w-3.5 h-3.5 text-red-400" />
                    <span>Videos & Playlists</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">{mediaCounts.videos}</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup('__media_article__')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeGroup === '__media_article__'
                      ? 'bg-blue-500/15 text-blue-500 font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                    <span>Articles & News</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">{mediaCounts.articles}</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup('__media_code__')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeGroup === '__media_code__'
                      ? 'bg-emerald-500/15 text-emerald-500 font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Code & Repositories</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">{mediaCounts.code}</span>
                </button>

                <button
                  onClick={() => {
                    navigate('/app')
                    setActiveGroup('__media_social__')
                    setIsSidebarOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeGroup === '__media_social__'
                      ? 'bg-purple-500/15 text-purple-500 font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Share2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Social & Threads</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">{mediaCounts.social}</span>
                </button>
              </div>

              {/* SECTION 3: SMART CATEGORIES & GROUPS */}
              <div>
                <div className="flex items-center justify-between px-3 py-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Categories
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setIsSidebarOpen(false)
                        navigate('/app/settings#groups')
                      }}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1"
                      title="Manage Groups & Categories"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {onAutoOrganize && (
                      <button
                        onClick={onAutoOrganize}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1"
                        title="Auto-Organize Vault into Smart Groups (YT, Insta, X)"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={openNewGroup}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1"
                      title="New Group"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Visible Categories List */}
                <div className="space-y-0.5">
                  {visibleGroups.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
                      {hiddenGroups.length > 0 ? 'All groups hidden' : 'No groups yet'}
                    </div>
                  ) : (
                    visibleGroups.map((group) => {
                      const isMobileMenuOpen = mobileMenuOpenGroupName === group.name
                      return (
                        <div key={group.name} className="flex flex-col">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              navigate('/app')
                              setActiveGroup(group.name)
                              setIsSidebarOpen(false)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                navigate('/app')
                                setActiveGroup(group.name)
                                setIsSidebarOpen(false)
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer select-none group ${
                              activeGroup === group.name
                                ? 'bg-[var(--color-brand-subtle)] text-[var(--color-accent)] font-semibold'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <Folder className="w-3.5 h-3.5 opacity-70 shrink-0" />
                              <span className="truncate flex-1 text-left">{group.name}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Desktop: Action Toolbar on Hover */}
                              <div className="hidden md:group-hover:flex items-center gap-0.5 bg-[var(--color-bg-surface)] rounded-md px-1 shadow-xs border border-[var(--color-border-subtle)]">
                                <button
                                  type="button"
                                  onClick={(e) => handleTogglePinLocal(group.name, e)}
                                  className={`p-1 active:scale-90 cursor-pointer transition-colors ${
                                    group.isPinned
                                      ? 'text-[var(--color-accent)]'
                                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                                  }`}
                                  title={group.isPinned ? 'Unpin from top' : 'Pin to top of sidebar'}
                                >
                                  <Pin className={`w-3 h-3 ${group.isPinned ? 'fill-current' : ''}`} />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => handleToggleHideLocal(group.name, e)}
                                  className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:scale-90 cursor-pointer"
                                  title="Hide group from sidebar"
                                >
                                  <EyeOff className="w-3 h-3" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditGroup(group.name)
                                    setIsSidebarOpen(false)
                                  }}
                                  className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] active:scale-90 cursor-pointer"
                                  title="Edit Group"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    setIsSidebarOpen(false)
                                    deleteGroup(group.name, e)
                                  }}
                                  className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)] active:scale-90 cursor-pointer"
                                  title="Delete Group"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Default State: Pin Indicator & Count */}
                              <div className="flex items-center gap-1 md:group-hover:hidden">
                                {group.isPinned && (
                                  <Pin className="w-3 h-3 text-[var(--color-accent)] fill-current shrink-0" />
                                )}
                                <span className="text-[10px] font-mono opacity-70">{group.count}</span>
                              </div>

                              {/* Mobile Action Toggle */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMobileMenuOpenGroupName((prev) => (prev === group.name ? null : group.name))
                                }}
                                className="md:hidden p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded"
                                title="Group actions"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Mobile Actions Drawer */}
                          {isMobileMenuOpen && (
                            <div
                              className="md:hidden flex items-center justify-around py-1.5 px-2 bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] rounded-lg mt-1 mb-1 mx-2 animate-in fade-in duration-150"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  handleTogglePinLocal(group.name, e)
                                  setMobileMenuOpenGroupName(null)
                                }}
                                className={`p-1.5 rounded flex items-center gap-1 text-xs ${
                                  group.isPinned ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--color-text-secondary)]'
                                }`}
                              >
                                <Pin className={`w-3.5 h-3.5 ${group.isPinned ? 'fill-current' : ''}`} />
                                <span>{group.isPinned ? 'Unpin' : 'Pin'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  handleToggleHideLocal(group.name, e)
                                  setMobileMenuOpenGroupName(null)
                                }}
                                className="p-1.5 rounded flex items-center gap-1 text-xs text-[var(--color-text-secondary)]"
                              >
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hide</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditGroup(group.name)
                                  setIsSidebarOpen(false)
                                  setMobileMenuOpenGroupName(null)
                                }}
                                className="p-1.5 rounded flex items-center gap-1 text-xs text-[var(--color-text-secondary)]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  setIsSidebarOpen(false)
                                  deleteGroup(group.name, e)
                                  setMobileMenuOpenGroupName(null)
                                }}
                                className="p-1.5 rounded flex items-center gap-1 text-xs text-[var(--color-status-error)]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Collapsible Hidden Groups Tray */}
                {hiddenGroups.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-[var(--color-border-subtle)]/70">
                    <button
                      type="button"
                      onClick={() => setIsHiddenTrayOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        {isHiddenTrayOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {hiddenGroups.length} Hidden Group{hiddenGroups.length === 1 ? '' : 's'}
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
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors group ${
                                activeGroup === group.name
                                  ? 'bg-[var(--color-brand-subtle)] text-[var(--color-accent)] font-semibold'
                                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  navigate('/app')
                                  setActiveGroup(group.name)
                                  setIsSidebarOpen(false)
                                }}
                                className="flex items-center gap-2 truncate flex-1 text-left cursor-pointer"
                              >
                                <Folder className="w-3.5 h-3.5 opacity-50 shrink-0" />
                                <span className="truncate">{group.name}</span>
                                <span className="text-[10px] opacity-60">({group.count})</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleToggleHideLocal(group.name, e)}
                                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-muted)] rounded transition-colors active:scale-90 cursor-pointer shrink-0"
                                title="Unhide group to sidebar"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Profile & Status Footer */}
            <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)]/50 space-y-2">
              {isGuest ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs text-[var(--color-text-secondary)]">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate font-medium">Guest Mode (Local)</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false)
                      navigate('/login')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold btn-primary rounded-lg transition-all active:scale-95"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In / Sync</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center text-xs font-bold border border-[var(--color-accent)]/20 shrink-0">
                      {user?.name ? user.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                        {user?.name || 'Markbel User'}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                        {user?.email || ''}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/app/settings')}
                      className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] rounded-lg transition-colors cursor-pointer"
                      title="Settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--color-status-error)] hover:bg-red-500/10 active:scale-95 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  )
}

export default GroupSidebar
