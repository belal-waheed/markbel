import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Flame,
  CheckCircle2,
  Trash2,
  Award,
  Loader2,
  Edit3,
  ArrowRight,
  Target,
  Calendar,
  TrendingUp,
  Hash,
  BarChart3,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useHabitStore, type Habit } from "@/stores/habitStore";
import dayjs from "dayjs";
import { useToastStore } from "@/stores/toastStore";
import { haptics } from "@/lib/haptics";

// ─── Helpers ───────────────────────────────────────────────

function getCompletionRate(dates: string[], windowDays: number): number {
  const start = dayjs()
    .subtract(windowDays - 1, "day")
    .startOf("day");
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    const d = start.add(i, "day").format("YYYY-MM-DD");
    if (dates.includes(d)) count++;
  }
  return Math.round((count / windowDays) * 100);
}

function getDaysSinceCreated(createdAt: string): number {
  return dayjs().diff(dayjs(createdAt), "day") + 1;
}

// ─── Page ──────────────────────────────────────────────────
export default function HabitsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    habits,
    isLoading,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
  } = useHabitStore();
  const showToast = useToastStore((s) => s.showToast);

  // Use URL search params for habit details to support back button behavior
  const selectedHabitId = searchParams.get("habitId");
  const setSelectedHabitId = useCallback(
    (id: string | null) => {
      if (id) {
        setSearchParams({ habitId: id });
      } else {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("habitId");
        setSearchParams(nextParams);
      }
    },
    [searchParams, setSearchParams],
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  // isSaving removed for instant background processing

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("🔥");
  const [formColor, setFormColor] = useState("");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formCustomDays, setFormCustomDays] = useState<number[]>([]);
  const [formGoalTarget, setFormGoalTarget] = useState<number | "">(0);
  const [formGoalUnit, setFormGoalUnit] = useState("");
  const [formReminderTime, setFormReminderTime] = useState("");

  const HABIT_ICONS = [
    "🔥",
    "🏃",
    "📚",
    "💧",
    "💤",
    "🧘",
    "✍️",
    "🎯",
    "💪",
    "🎵",
    "🧠",
    "🌿",
  ];
  const HABIT_COLORS = [
    "",
    "#a855f7",
    "#3b82f6",
    "#10b981",
    "#f97316",
    "#ef4444",
    "#eab308",
  ];
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Global fetch handled in AppLayout.
  // Local data from IndexedDB will show up instantly.

  const todayStr = dayjs().format("YYYY-MM-DD");

  const liveSelectedHabit = useMemo(
    () =>
      selectedHabitId
        ? habits.find((h) => h.id === selectedHabitId) || null
        : null,
    [habits, selectedHabitId],
  );

  // ─── Aggregate stats for the header ────────────────────
  const globalStats = useMemo(() => {
    let totalCompletions = 0;
    let activeStreaks = 0;
    let bestStreak = 0;
    let completedToday = 0;

    habits.forEach((h) => {
      const dates = h.completedDates || [];
      totalCompletions += dates.length;
      if (h.currentStreak > 0) activeStreaks++;
      if (h.longestStreak > bestStreak) bestStreak = h.longestStreak;
      if (dates.includes(todayStr)) completedToday++;
    });

    const todayRate =
      habits.length > 0
        ? Math.round((completedToday / habits.length) * 100)
        : 0;

    return {
      totalCompletions,
      activeStreaks,
      bestStreak,
      completedToday,
      todayRate,
    };
  }, [habits, todayStr]);

  const openCreateModal = () => {
    setEditingHabit(null);
    setFormName("");
    setFormDescription("");
    setFormIcon("🔥");
    setFormColor("");
    setFormFrequency("daily");
    setFormCustomDays([]);
    setFormGoalTarget(0);
    setFormGoalUnit("");
    setFormReminderTime("");
    setIsModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormName(habit.name);
    setFormDescription(habit.description || "");
    setFormIcon(habit.icon || "🔥");
    setFormColor(habit.color || "");
    setFormFrequency(habit.frequency || "daily");
    setFormCustomDays(habit.customDays || []);
    setFormGoalTarget(habit.goalTarget || 0);
    setFormGoalUnit(habit.goalUnit || "");
    setFormReminderTime(habit.reminderTime || "");
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    const payload = {
      name: formName,
      description: formDescription,
      icon: formIcon,
      color: formColor || undefined,
      frequency: formFrequency,
      customDays: formFrequency === "custom" ? formCustomDays : undefined,
      goalTarget:
        formGoalTarget && formGoalTarget > 0
          ? Number(formGoalTarget)
          : undefined,
      goalUnit: formGoalUnit || undefined,
      reminderTime: formReminderTime || undefined,
    };

    if (editingHabit) {
      updateHabit(editingHabit.id, payload);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      addHabit(payload as any);
    }

    setIsModalOpen(false);
  };

  const isCompletedToday = (habit: Habit) => {
    return (habit.completedDates || []).includes(todayStr);
  };

  const handleToggle = (habit: Habit, e: React.MouseEvent) => {
    e.stopPropagation();
    const willComplete = !isCompletedToday(habit);
    if (willComplete) {
      haptics.success();
      import("@/lib/sounds").then(({ soundSystem }) =>
        soundSystem.playHabitCheck(),
      );
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#f97316", "#eab308", "#22c55e"],
        });
      });
    } else {
      haptics.medium();
      import("@/lib/sounds").then(({ soundSystem }) =>
        soundSystem.playHabitUncheck(),
      );
    }
    toggleHabitCompletion(habit.id, todayStr);
  };

  return (
    <div className="space-y-10 max-w-[1650px] mx-auto pb-24 px-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-2">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight bg-linear-to-br from-foreground via-foreground to-primary/40 bg-clip-text text-transparent leading-[1.1] pb-1">
              Build Habits
            </h1>
            <p className="text-muted-foreground mt-2 text-base sm:text-lg font-medium max-w-md">
              Atomic changes that lead to remarkable results. Focus on the
              system, not just the goal.
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateModal}
          size="lg"
          className="gap-2.5 rounded-2xl h-14 px-8 shadow-2xl shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all duration-300 group bg-primary text-primary-foreground border-none"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-black text-lg">New Habit</span>
        </Button>
      </div>

      {/* ─── Stats Dashboard ─────────────────────────────── */}
      {habits.length > 0 && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              {
                label: "Done Today",
                value: `${globalStats.completedToday}/${habits.length}`,
                icon: CheckCircle2,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
                sub: `${globalStats.todayRate}% success`,
              },
              {
                label: "Total Wins",
                value: globalStats.totalCompletions,
                icon: Hash,
                color: "text-primary",
                bg: "bg-primary/10",
                sub: "all time",
              },
              {
                label: "Live Streaks",
                value: globalStats.activeStreaks,
                icon: Flame,
                color: "text-orange-500",
                bg: "bg-orange-500/10",
                sub: "keeping fire",
              },
              {
                label: "Best Streak",
                value: `${globalStats.bestStreak}d`,
                icon: Award,
                color: "text-yellow-500",
                bg: "bg-yellow-500/10",
                sub: "record set",
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="p-5 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-border/40 bg-card/50 backdrop-blur-sm group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${stat.bg}`}
                  >
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-black tracking-tight">
                      {stat.value}
                    </p>
                    <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mt-0.5">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </motion.div>

          <div className="px-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                Global Momentum
              </span>
              <span className="font-black text-primary text-lg">
                {globalStats.todayRate}%
              </span>
            </div>
            <div className="h-3 bg-muted/30 rounded-full border border-border/40 overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${globalStats.todayRate}%` }}
                className="h-full bg-linear-to-r from-primary to-primary/60 rounded-full shadow-[0_0_12px_rgba(var(--primary),0.4)]"
              />
            </div>
          </div>
        </div>
      )}

      {isLoading && habits.length === 0 ? (
        <div className="flex flex-col items-center py-32">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-base font-bold text-muted-foreground mt-6 uppercase tracking-widest">
            Accessing Vault...
          </p>
        </div>
      ) : habits.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-32 px-6 bg-card/30 backdrop-blur-2xl rounded-[3rem] border border-border/40 shadow-2xl shadow-primary/5"
        >
          <div className="w-28 h-28 bg-linear-to-br from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Target className="w-14 h-14 text-primary" />
          </div>
          <h3 className="text-3xl font-black mb-3">Your Journey Starts Here</h3>
          <p className="text-muted-foreground text-xl max-w-lg mx-auto font-medium">
            Create your first daily habit to start building unbreakable momentum
            today.
          </p>
          <Button
            onClick={openCreateModal}
            className="mt-10 rounded-2xl px-10 h-16 text-lg font-black shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
          >
            Begin Now
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {habits.map((habit, i) => {
              const completed = isCompletedToday(habit);
              const dates = habit.completedDates || [];
              const totalCount = dates.length;
              const rate7d = getCompletionRate(dates, 7);

              const last7 = Array.from({ length: 7 }).map((_, j) => {
                const d = dayjs()
                  .subtract(6 - j, "day")
                  .format("YYYY-MM-DD");
                return dates.includes(d);
              });

              return (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: {
                      delay: i * 0.05,
                      type: "spring",
                      stiffness: 260,
                      damping: 20,
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                >
                  <Card
                    onClick={() => setSelectedHabitId(habit.id)}
                    className={`relative overflow-hidden cursor-pointer group transition-all duration-500 rounded-[2rem] border-2 ${
                      completed
                        ? "border-primary/40 shadow-xl shadow-primary/10 bg-primary/5"
                        : "bg-card/40 backdrop-blur-xl border-border/50 hover:border-primary/40 shadow-sm hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1"
                    }`}
                  >
                    <div className="p-6 sm:p-7 relative z-10">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5 min-w-0 flex-1">
                          <div
                            className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center shrink-0 transition-all duration-500 ${completed ? "bg-primary text-primary-foreground shadow-xl shadow-primary/40 rotate-6" : "bg-muted/50 text-muted-foreground border border-border/50 group-hover:bg-muted group-hover:scale-110"}`}
                            style={
                              habit.color && !completed
                                ? {
                                    backgroundColor: `${habit.color}15`,
                                    borderColor: `${habit.color}30`,
                                  }
                                : {}
                            }
                          >
                            <span className="text-3xl leading-none">
                              {habit.icon || "🔥"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3
                              className={`font-black text-xl sm:text-2xl truncate transition-colors ${completed ? "text-primary" : "text-foreground"}`}
                            >
                              {habit.name}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                <Flame
                                  className={`w-3.5 h-3.5 ${habit.currentStreak > 0 ? "text-orange-500 fill-orange-500" : ""}`}
                                />
                                {habit.currentStreak}d Streak
                              </span>
                              <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {totalCount} Total
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {habit.goalTarget && habit.goalTarget > 1 ? (
                            <div className="flex flex-col items-center gap-2 p-1.5 bg-muted/20 rounded-2xl border border-border/40">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useHabitStore
                                    .getState()
                                    .incrementHabitProgress(habit.id, todayStr);
                                }}
                                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${completed ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "hover:bg-primary/10 text-primary border border-primary/20"}`}
                              >
                                <Plus className="w-6 h-6" />
                              </button>
                              <div className="text-center pb-1">
                                <span
                                  className={`text-sm font-black tabular-nums ${completed ? "text-primary" : ""}`}
                                >
                                  {habit.goalProgress?.[todayStr] || 0} /{" "}
                                  {habit.goalTarget}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => handleToggle(habit, e)}
                              className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                                completed
                                  ? "bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/40 rotate-12"
                                  : "border-muted-foreground/30 text-transparent hover:border-primary hover:text-primary hover:bg-primary/10 hover:scale-110"
                              }`}
                            >
                              <CheckCircle2
                                className={`w-8 h-8 ${completed ? "opacity-100" : "opacity-0 scale-50 group-hover:opacity-50 group-hover:scale-100"} transition-all duration-500`}
                                strokeWidth={3}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-8 pt-5 border-t border-border/30">
                        <div className="flex items-center gap-1.5">
                          {last7.map((done, idx) => (
                            <div
                              key={idx}
                              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg transition-all duration-500 ${
                                done
                                  ? "bg-primary shadow-lg shadow-primary/30 scale-110"
                                  : "bg-muted/40 border border-border/30 hover:bg-muted/60"
                              }`}
                            />
                          ))}
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[11px] px-3.5 py-1 font-black uppercase tracking-widest rounded-xl ${
                            rate7d >= 80
                              ? "bg-emerald-500/10 text-emerald-500"
                              : rate7d >= 50
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {rate7d}% Weekly
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ─── DETAILED HABIT MODAL ───────────────────────── */}
      <Dialog
        open={!!liveSelectedHabit}
        onOpenChange={(open) => {
          if (!open) setSelectedHabitId(null);
        }}
      >
        <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-3xl rounded-3xl outline-none shadow-2xl z-100 max-h-[90vh] overflow-y-auto">
          {liveSelectedHabit &&
            (() => {
              const habit = liveSelectedHabit;
              const completed = isCompletedToday(habit);
              const dates = habit.completedDates || [];
              const totalCount = dates.length;
              const daysSince = getDaysSinceCreated(habit.createdAt);
              const lifetimeRate =
                daysSince > 0 ? Math.round((totalCount / daysSince) * 100) : 0;
              const rate7d = getCompletionRate(dates, 7);
              const rate30d = getCompletionRate(dates, 30);

              // Build 35-day calendar grid (5 weeks)
              const calendarDays = Array.from({ length: 35 }).map((_, i) => {
                const d = dayjs().subtract(34 - i, "day");
                return {
                  date: d.format("YYYY-MM-DD"),
                  isDone: dates.includes(d.format("YYYY-MM-DD")),
                  dayNum: d.date(),
                  isToday: d.isSame(dayjs(), "day"),
                  monthLabel: d.date() === 1 ? d.format("MMM") : null,
                };
              });

              // Week-by-week completion for the chart bars (last 4 weeks)
              const weeklyBars = Array.from({ length: 4 }).map((_, wi) => {
                const weekStart = dayjs().subtract((3 - wi) * 7 + 6, "day");
                let count = 0;
                for (let d = 0; d < 7; d++) {
                  if (
                    dates.includes(weekStart.add(d, "day").format("YYYY-MM-DD"))
                  )
                    count++;
                }
                return {
                  label: `W${wi + 1}`,
                  count,
                  pct: Math.round((count / 7) * 100),
                };
              });

              return (
                <div className="flex flex-col">
                  {/* Header */}
                  <div className="px-6 py-6 sm:px-8 border-b border-border/30 bg-background/30 shrink-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className={`p-1.5 rounded-xl shrink-0 ${completed ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground border border-border/50"}`}
                          >
                            <Target className="w-5 h-5" />
                          </div>
                          <Badge
                            variant="outline"
                            className="capitalize px-3 py-1 text-[10px] font-bold rounded-full border border-primary/20 bg-primary/10 text-primary"
                          >
                            Daily Habit
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2.5 py-0.5 font-bold rounded-full bg-muted"
                          >
                            Day {daysSince}
                          </Badge>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                          {habit.name}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 sm:p-8 space-y-8">
                    {/* Action check-in */}
                    <div
                      className={`p-6 rounded-[2rem] border-2 transition-all duration-300 flex items-center justify-between cursor-pointer ${
                        completed
                          ? "bg-primary border-primary shadow-xl shadow-primary/20"
                          : "bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-primary/30"
                      }`}
                      onClick={() => toggleHabitCompletion(habit.id, todayStr)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${
                            completed
                              ? "bg-background text-primary border-background"
                              : "bg-background border-border text-muted-foreground"
                          }`}
                        >
                          <CheckCircle2
                            className={`w-8 h-8 ${completed ? "opacity-100" : "opacity-30"}`}
                            strokeWidth={3}
                          />
                        </div>
                        <div>
                          <h3
                            className={`font-black text-xl ${completed ? "text-primary-foreground" : ""}`}
                          >
                            {completed ? "Victory!" : "Keep it going"}
                          </h3>
                          <p
                            className={`text-sm font-bold mt-0.5 ${completed ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                          >
                            {completed
                              ? "You've won today."
                              : "Complete this habit now."}
                          </p>
                        </div>
                      </div>
                      <ArrowRight
                        className={`w-6 h-6 transition-transform ${completed ? "text-primary-foreground translate-x-1" : "text-muted-foreground"}`}
                      />
                    </div>

                    {/* Description if any */}
                    {habit.description && (
                      <p className="text-base font-medium text-muted-foreground/80 leading-relaxed text-center px-4 italic">
                        &ldquo;{habit.description}&rdquo;
                      </p>
                    )}

                    {/* Main Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        {
                          label: "Current Streak",
                          value: habit.currentStreak,
                          unit: "d",
                          icon: Flame,
                          color: "text-orange-500",
                          bg: "bg-orange-500/10",
                        },
                        {
                          label: "Best Streak",
                          value: habit.longestStreak,
                          unit: "d",
                          icon: Award,
                          color: "text-yellow-500",
                          bg: "bg-yellow-500/10",
                        },
                        {
                          label: "Total Wins",
                          value: totalCount,
                          unit: "×",
                          icon: Hash,
                          color: "text-primary",
                          bg: "bg-primary/10",
                        },
                        {
                          label: "Success Rate",
                          value: lifetimeRate,
                          unit: "%",
                          icon: TrendingUp,
                          color: "text-emerald-500",
                          bg: "bg-emerald-500/10",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className={`${stat.bg} rounded-[2rem] p-7 flex flex-col items-center justify-center text-center border-2 border-transparent hover:border-border/20 transition-all`}
                        >
                          <stat.icon className={`w-8 h-8 ${stat.color} mb-4`} />
                          <p
                            className={`text-4xl font-black ${stat.color} tracking-tighter`}
                          >
                            {stat.value}
                            <span className="text-sm font-black opacity-60 ml-0.5 tracking-normal">
                              {stat.unit}
                            </span>
                          </p>
                          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Toggle More Details */}
                    <div className="pt-4 border-t border-border/20">
                      <Button
                        variant="ghost"
                        onClick={() => setShowInsights(!showInsights)}
                        className="w-full h-12 rounded-2xl gap-2 font-black uppercase tracking-widest text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 group"
                      >
                        <BarChart3
                          className={`w-4 h-4 transition-transform group-hover:scale-110 ${showInsights ? "rotate-90" : ""}`}
                        />
                        {showInsights
                          ? "Hide Detailed Insights"
                          : "Show More Details"}
                      </Button>

                      <AnimatePresence>
                        {showInsights && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden space-y-8 pt-6"
                          >
                            {/* 35-Day Heatmap Calendar */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  Last 5 Weeks
                                </h4>
                                <div className="flex items-center gap-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-muted/40" />{" "}
                                    Missed
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />{" "}
                                    Done
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-7 gap-1.5">
                                {["S", "M", "T", "W", "T", "F", "S"].map(
                                  (d, i) => (
                                    <div
                                      key={i}
                                      className="text-[10px] font-black text-muted-foreground/40 uppercase text-center py-1"
                                    >
                                      {d}
                                    </div>
                                  ),
                                )}
                                {/* Offset for starting day of week */}
                                {Array.from({
                                  length: dayjs().subtract(34, "day").day(),
                                }).map((_, i) => (
                                  <div key={`pad-${i}`} />
                                ))}
                                {calendarDays.map((day) => (
                                  <div
                                    key={day.date}
                                    className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all relative ${
                                      day.isDone
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100"
                                        : "bg-muted/20 text-muted-foreground/30 border border-border/10"
                                    } ${day.isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                                  >
                                    {day.dayNum}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Weekly Progress Bars */}
                            <div className="space-y-4 pt-4 border-t border-border/10">
                              <h4 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Weekly Consistency
                              </h4>
                              <div className="flex items-end gap-3 h-24 pt-2">
                                {weeklyBars.map((week, idx) => (
                                  <div
                                    key={week.label}
                                    className="flex-1 flex flex-col items-center gap-2"
                                  >
                                    <div className="w-full bg-muted/20 rounded-xl relative overflow-hidden h-16 border border-border/5">
                                      <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: `${week.pct}%` }}
                                        transition={{
                                          duration: 0.8,
                                          delay: idx * 0.1,
                                          ease: "easeOut",
                                        }}
                                        className={`absolute bottom-0 left-0 right-0 rounded-lg shadow-inner ${
                                          week.pct >= 80
                                            ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                            : week.pct >= 50
                                              ? "bg-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                                              : week.pct > 0
                                                ? "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                                                : "bg-muted"
                                        }`}
                                      />
                                    </div>
                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase">
                                      {week.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Success Rates */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/10">
                              <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  <span>7d Momentum</span>
                                  <span
                                    className={
                                      rate7d >= 70
                                        ? "text-emerald-500"
                                        : "text-primary"
                                    }
                                  >
                                    {rate7d}%
                                  </span>
                                </div>
                                <Progress
                                  value={rate7d}
                                  className="h-2 rounded-full"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                  <span>30d Momentum</span>
                                  <span
                                    className={
                                      rate30d >= 70
                                        ? "text-emerald-500"
                                        : "text-primary"
                                    }
                                  >
                                    {rate30d}%
                                  </span>
                                </div>
                                <Progress
                                  value={rate30d}
                                  className="h-2 rounded-full"
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Footer Controls */}
                  <div className="px-6 py-4 sm:px-8 border-t border-border/40 bg-muted/10 flex items-center justify-end shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-4 rounded-lg text-muted-foreground hover:text-foreground transition-colors font-semibold"
                      onClick={() => {
                        setSelectedHabitId(null);
                        openEditModal(habit);
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Habit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-4 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors font-semibold"
                      onClick={() => {
                        const habitToRestore = { ...habit };
                        setSelectedHabitId(null);
                        deleteHabit(habit.id);
                        showToast(`Deleted habit: ${habit.name}`, () => {
                          addHabit(habitToRestore);
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-2xl rounded-3xl z-100">
          <div className="px-6 py-5 border-b border-border/50 bg-muted/20">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingHabit ? "Edit Habit" : "Forge a New Habit"}
            </DialogTitle>
          </div>
          <div className="px-6 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Habit Name
              </label>
              <Input
                placeholder="e.g. Read 10 pages, Drink water"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
                autoFocus
                className="h-12 text-lg font-medium bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/30"
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {HABIT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormIcon(icon)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all border-2 ${
                      formIcon === icon
                        ? "border-primary bg-primary/10 scale-110 shadow-md"
                        : "border-transparent bg-muted/50 hover:bg-muted hover:scale-105"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Accent Color
              </label>
              <div className="flex gap-2">
                {HABIT_COLORS.map((color) => (
                  <button
                    key={color || "default"}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`w-8 h-8 rounded-full transition-all border-2 ${
                      formColor === color
                        ? "border-foreground scale-125 shadow-lg"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: color || "var(--muted)" }}
                  />
                ))}
              </div>
            </div>

            {/* Frequency Selector */}
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Frequency
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "daily", label: "Every Day" },
                  { value: "weekdays", label: "Weekdays" },
                  { value: "weekends", label: "Weekends" },
                  { value: "custom", label: "Custom" },
                ].map((freq) => (
                  <button
                    key={freq.value}
                    type="button"
                    onClick={() => setFormFrequency(freq.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      formFrequency === freq.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-background/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>

              {/* Custom Days Picker */}
              {formFrequency === "custom" && (
                <div className="flex gap-1.5 mt-3">
                  {DAY_LABELS.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormCustomDays((prev) =>
                          prev.includes(idx)
                            ? prev.filter((d) => d !== idx)
                            : [...prev, idx],
                        );
                      }}
                      className={`w-10 h-10 rounded-xl text-xs font-bold transition-all border ${
                        formCustomDays.includes(idx)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/50 bg-background/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Goal Target */}
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Daily Goal (Optional)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 8"
                  value={formGoalTarget || ""}
                  onChange={(e) =>
                    setFormGoalTarget(
                      e.target.value ? parseInt(e.target.value) : "",
                    )
                  }
                  className="h-10 w-24 bg-background/50 border-border/50 rounded-xl"
                />
                <Input
                  placeholder="unit (e.g. glasses, pages)"
                  value={formGoalUnit}
                  onChange={(e) => setFormGoalUnit(e.target.value)}
                  className="h-10 flex-1 bg-background/50 border-border/50 rounded-xl"
                />
              </div>
            </div>

            {/* Reminder Time */}
            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Notification Time (Optional)
              </label>
              <Input
                type="time"
                value={formReminderTime}
                onChange={(e) => setFormReminderTime(e.target.value)}
                className="h-12 bg-background/50 border-border/50 rounded-xl text-lg font-medium focus-visible:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                Description (Optional)
              </label>
              <textarea
                placeholder="Why are you building this habit?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="flex min-h-[80px] w-full rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-base text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none font-medium"
              />
            </div>
          </div>
          <div className="px-6 py-5 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
            <Button
              variant="outline"
              className="h-12 px-6 rounded-xl font-bold border-border/50"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-12 px-8 rounded-xl font-bold gap-2 shadow-lg shadow-primary/25"
              onClick={handleSave}
              disabled={!formName.trim()}
            >
              {editingHabit ? "Save Changes" : "Create Habit"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
