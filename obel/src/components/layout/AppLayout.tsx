import { useEffect, useState, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ListTodo,
  Timer,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  MoreHorizontal,
  X,
  FileText,
  Sun,
  Moon,
  WifiOff,
  BarChart3,
  Bell,
  BellOff,
  BellRing,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTimerStore, type TimerMode } from "@/stores/timerStore";
import { useHabitStore } from "@/stores/habitStore";
import { CommandPalette } from "@/components/CommandPalette";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { LevelUpModal } from "../ui/LevelUpModal";
import { UndoToast } from "@/components/ui/UndoToast";
import { useThemeStore } from "@/stores/themeStore";
import { MiniTimerPill } from "@/components/pomodoro/MiniTimerPill";
import { useLocation } from "react-router-dom";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { useNoteStore } from "@/stores/noteStore";
import { QuickSearch } from "@/components/notes";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/tasks", icon: ListTodo, label: "Tasks" },
  { path: "/pomodoro", icon: Timer, label: "Pomodoro" },
  { path: "/habits", icon: Sparkles, label: "Habits" },
  { path: "/notes", icon: FileText, label: "Notes" },
  { path: "/profile", icon: User, label: "Profile" },
  { path: "/calendar", icon: Calendar, label: "Calendar" },
  { path: "/review", icon: BarChart3, label: "Review" },
];

// Bottom nav shows first 4 items + More
const PRIMARY_NAV = navItems.slice(0, 4);
const MORE_NAV = navItems.slice(4);

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const location = useLocation();

  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleNotifClick = async () => {
    if (!("Notification" in window)) {
      import("@/stores/toastStore").then(({ useToastStore }) => {
        useToastStore
          .getState()
          .showToast("Notifications not supported by this browser.");
      });
      return;
    }

    if (Notification.permission === "denied") {
      import("@/stores/toastStore").then(({ useToastStore }) => {
        useToastStore
          .getState()
          .showToast(
            "Notifications blocked. Please enable them in browser settings.",
          );
      });
      return;
    }

    import("@/lib/notifications")
      .then(async ({ notificationSystem }) => {
        const granted = await notificationSystem.requestAndVerify();
        if (granted) {
          setNotifPermission("granted");
          if (user?.id) {
            await notificationSystem.registerPushSubscription(user.id);
          }
          notificationSystem.send("Notifications Active!", {
            body: "This device is now registered for push notifications.",
          });
        } else {
          setNotifPermission("denied");
        }
      })
      .catch(() => {});
  };

  const isDark = useThemeStore((s) => s.isDark);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const isOffline = useAuthStore((s) => s.isOffline);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const loadFromUser = useTimerStore((s) => s.loadFromUser);
  const fetchHabits = useHabitStore((s) => s.fetchHabits);
  const resumeTick = useTimerStore((s) => s.resumeTick);

  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const timerRemaining = useTimerStore((s) => s.timeRemaining);
  const timerMode = useTimerStore((s) => s.mode);
  const isFullscreen = useTimerStore((s) => s.isFullscreen);
  const isZenMode = useNoteStore((s) => s.isZenMode);

  const timerMinutes = Math.floor(timerRemaining / 60);
  const timerSeconds = timerRemaining % 60;
  const timerDisplay = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;

  // Online / offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Tab title timer
  useEffect(() => {
    if (isTimerRunning) {
      const modeLabels: Record<TimerMode, string> = {
        focus: "Focus",
        shortBreak: "Break",
        longBreak: "Long Break",
        coffeeBreak: "Coffee Break",
      };
      document.title = `${timerDisplay} — ${modeLabels[timerMode]} | Obel`;
    } else {
      document.title = "Obel";
    }
    return () => {
      document.title = "Obel";
    };
  }, [isTimerRunning, timerDisplay, timerMode]);

  useEffect(() => {
    resumeTick();
  }, [resumeTick]);

  // Dynamically load and apply theme from authenticated user profile updates
  useEffect(() => {
    if (user && user.activeTheme !== undefined) {
      const isDark = user.activeTheme === "dark";
      useThemeStore.setState({ isDark });
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [user]);

  // Initial startup sync & register push subscription when authenticated online
  useEffect(() => {
    if (user?.id) {
      // 1. Refresh user profile first to ensure we have the latest noteFolders and taskLists
      useAuthStore
        .getState()
        .refreshUser()
        .finally(() => {
          import("@/stores/noteStore")
            .then(({ useNoteStore }) => {
              useNoteStore
                .getState()
                .fetchNotes()
                .catch(() => {});
            })
            .catch(() => {});
        });

      // 2. Trigger fresh remote MongoDB pulls for all other data stores
      fetchTasks().catch(() => {});
      fetchHabits().catch(() => {});
      loadFromUser().catch(() => {});

      import("@/stores/coffeeStore")
        .then(({ useCoffeeStore }) => {
          useCoffeeStore
            .getState()
            .fetchLogs()
            .catch(() => {});
        })
        .catch(() => {});

      import("@/stores/userInfoStore")
        .then(({ useUserInfoStore }) => {
          useUserInfoStore
            .getState()
            .fetchUserInfo()
            .catch(() => {});
        })
        .catch(() => {});

      // 3. Automatically register device browser push subscriptions in MongoDB VAPID registry
      import("@/lib/notifications")
        .then(({ notificationSystem }) => {
          notificationSystem.registerPushSubscription(user.id).catch(() => {});
        })
        .catch(() => {});
    }
  }, [user?.id, fetchTasks, fetchHabits, loadFromUser]);

  // Dynamically synchronize noteFolders, settings, and open note IDs from authStore user updates to noteStore
  useEffect(() => {
    if (user) {
      import("@/stores/noteStore")
        .then(({ useNoteStore }) => {
          const updates: Partial<any> = {};
          if (user.noteFolders) {
            let parsedFolders = [{ id: "hola-default", name: "Hola" }];
            let folders: any = user.noteFolders;
            if (typeof folders === "string") {
              try {
                folders = JSON.parse(folders);
              } catch {
                folders = [];
              }
            }
            if (Array.isArray(folders) && folders.length > 0) {
              parsedFolders = folders;
            }
            const currentFolders = useNoteStore.getState().folders;
            if (
              JSON.stringify(currentFolders) !== JSON.stringify(parsedFolders)
            ) {
              updates.folders = parsedFolders;
            }
          }
          if (user.noteSettings) {
            const currentSettings = useNoteStore.getState().noteSettings;
            const newSettings = { ...currentSettings, ...user.noteSettings };
            if (
              JSON.stringify(currentSettings) !== JSON.stringify(newSettings)
            ) {
              updates.noteSettings = newSettings;
            }
          }
          if (user.openNoteIds) {
            const currentOpenIds = useNoteStore.getState().openNoteIds;
            if (
              JSON.stringify(currentOpenIds) !==
              JSON.stringify(user.openNoteIds)
            ) {
              updates.openNoteIds = user.openNoteIds;
            }
          }
          if (Object.keys(updates).length > 0) {
            useNoteStore.setState(updates);
          }
        })
        .catch(() => {});
    }
  }, [user?.noteFolders, user?.noteSettings, user?.openNoteIds]);

  // Track Level Up
  useEffect(() => {
    if (user?.level) {
      if (prevLevel !== null && user.level > prevLevel) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowLevelUp(true);
      }
      setPrevLevel(user.level);
    }
  }, [user?.level, prevLevel]);

  const toggleTheme = () => {
    useThemeStore.getState().toggleTheme();
  };

  const showOfflineBadge = !isOnline || isOffline;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 shrink-0 border border-primary/20">
          <Logo size={24} />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="font-black text-2xl tracking-[0.2em] text-foreground uppercase">
              Obel
            </span>
          </motion.div>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-hidden z-10">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`
            }
          >
            <item.icon className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />

            {!collapsed ? (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                className="whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            ) : (
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-card/95 backdrop-blur-2xl border border-primary/20 rounded-xl shadow-2xl opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap z-100 hidden md:block">
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-foreground">
                  {item.label}
                </span>
                <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-card/95 border-l border-t border-primary/20 -rotate-45" />
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border/50 p-2 space-y-1 shrink-0 z-10">
        {user && !collapsed && (
          <div className="px-3 py-2 space-y-3">
            <NavLink
              to="/profile"
              className="flex items-center gap-2 rounded-xl hover:bg-white/5 transition-colors p-1"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-widest">
                  {user.email}
                </p>
              </div>
            </NavLink>
            <LevelBadge level={user.level || 1} xp={user.xp || 0} size="sm" />
          </div>
        )}

        <div className="flex flex-col gap-1 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNotifClick}
            className={`w-full justify-start gap-2 ${
              notifPermission === "granted"
                ? "text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                : notifPermission === "denied"
                  ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {notifPermission === "granted" ? (
              <BellRing
                className="w-4 h-4 shrink-0 animate-bounce"
                style={{ animationIterationCount: 2 }}
              />
            ) : notifPermission === "denied" ? (
              <BellOff className="w-4 h-4 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 shrink-0" />
            )}
            {!collapsed && (
              <span className="truncate">
                {notifPermission === "granted"
                  ? "Notifications Active"
                  : notifPermission === "denied"
                    ? "Notifications Blocked"
                    : "Enable Notifications"}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
          >
            {isDark ? (
              <Sun className="w-4 h-4 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 shrink-0" />
            )}
            {!collapsed && <span>{isDark ? "Light" : "Dark"}</span>}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center hidden md:flex hover:bg-white/5"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </>
  );

  const setIsFullscreen = useTimerStore((s) => s.setIsFullscreen);

  // Handle mobile back button to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    // Push a dummy state to the history stack
    window.history.pushState({ fullscreen: true }, "");

    const handlePopState = () => {
      setIsFullscreen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If we exit via the minimize button, we should clean up the history entry
      if (window.history.state?.fullscreen) {
        window.history.back();
      }
    };
  }, [isFullscreen, setIsFullscreen]);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-9999 bg-[#0a0a0c] overflow-hidden">
        <Outlet />
        <CommandPalette />
        <QuickSearch />
        <UndoToast />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground max-w-[1920px] mx-auto w-full border-x border-border/10 shadow-[0_0_80px_rgba(0,0,0,0.55)]">
      {/* BACKGROUND WATERMARK */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.02] select-none z-0">
        <div className="absolute top-[-5%] left-[-5%] text-[45vw] font-black leading-none tracking-tighter">
          Obel
        </div>
      </div>

      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        className="relative hidden md:flex flex-col border-r border-border/50 bg-black/20 backdrop-blur-3xl shrink-0 z-20"
      >
        {sidebarContent}
        <div className="mt-auto px-4 pb-2">
          {!collapsed &&
            location.pathname !== "/pomodoro" &&
            isTimerRunning && <MiniTimerPill />}
          {collapsed && (
            <div className="w-full flex justify-center mb-4">
              {/* Optional: Add a tiny dot or something if timer is running and collapsed */}
              {isTimerRunning && (
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
          )}
        </div>
        <div className="pt-2 p-4 flex items-center gap-2 justify-center opacity-40 border-t border-border/10">
          {showOfflineBadge ? (
            <>
              <WifiOff className="w-4 h-4 text-orange-400" />
              {!collapsed && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 whitespace-nowrap overflow-hidden">
                  Offline
                </span>
              )}
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {!collapsed && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70 whitespace-nowrap overflow-hidden">
                  Connected
                </span>
              )}
            </>
          )}
        </div>
      </motion.aside>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 overflow-hidden">
        {/* Scroll area — scrollbar at edge of main area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar"
        >
          {/* Inner container for max-width centering */}
          <div
            className={`w-full ${location.pathname === "/notes" ? "p-0" : `p-4 sm:p-8 lg:p-12 ${!isZenMode ? "pb-nav md:pb-12" : ""} max-w-[1650px] mx-auto`}`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Mobile Mini Player ── */}
        {location.pathname !== "/pomodoro" && !isZenMode && isTimerRunning && (
          <MiniTimerPill isMobile={true} />
        )}

        {/* ── Mobile bottom nav ── */}
        <AnimatePresence>
          {!isZenMode && (
            <motion.nav
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-2xl border-t border-border/50 z-50 flex items-center justify-around px-2"
              style={{
                height: "calc(4rem + env(safe-area-inset-bottom, 0px))",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              {PRIMARY_NAV.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => setShowMoreMenu(false)}
                  className="relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors z-10"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="bottom-nav-pill"
                          className="absolute inset-0 top-2 bottom-2 mx-auto w-12 bg-primary/10 rounded-2xl -z-10"
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                          }}
                        />
                      )}
                      <item.icon
                        className={`w-5 h-5 transition-transform ${isActive ? "scale-110 text-primary" : "text-muted-foreground"}`}
                      />
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                  showMoreMenu ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {showMoreMenu ? (
                  <X className="w-5 h-5" />
                ) : (
                  <MoreHorizontal className="w-5 h-5" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  More
                </span>
              </button>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* More menu */}
        <AnimatePresence>
          {showMoreMenu && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-30"
                onClick={() => setShowMoreMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="md:hidden fixed inset-x-0 bg-background/98 backdrop-blur-3xl border-t border-border/50 z-40 p-4 grid grid-cols-3 gap-3"
                style={{
                  bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                {MORE_NAV.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowMoreMenu(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "bg-muted/40 text-foreground hover:bg-muted"
                      }`
                    }
                  >
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs font-bold">{item.label}</span>
                  </NavLink>
                ))}
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    handleNotifClick();
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border border-border/10 cursor-pointer ${
                    notifPermission === "granted"
                      ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                      : notifPermission === "denied"
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {notifPermission === "granted" ? (
                    <BellRing className="w-6 h-6 animate-pulse" />
                  ) : notifPermission === "denied" ? (
                    <BellOff className="w-6 h-6" />
                  ) : (
                    <Bell className="w-6 h-6" />
                  )}
                  <span className="text-xs font-bold">
                    {notifPermission === "granted"
                      ? "Notifications"
                      : notifPermission === "denied"
                        ? "Blocked"
                        : "Notify Me"}
                  </span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>

      <CommandPalette />
      <QuickSearch />
      <InstallBanner />
      <UndoToast />
      <OnboardingModal />

      {user && (
        <LevelUpModal
          isOpen={showLevelUp}
          onClose={() => setShowLevelUp(false)}
          level={user.level}
        />
      )}
    </div>
  );
}
