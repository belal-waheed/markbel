import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coffee,
  X,
  Plus,
  Trash2,
  Zap,
  History,
  Clock,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCoffeeStore } from "@/stores/coffeeStore";
import dayjs from "dayjs";

interface CoffeeHubProps {
  isOpen: boolean;
  onClose: () => void;
}

const DRINK_PRESETS = [
  { name: "Turkish", mg: 80, icon: "☕" },
  { name: "Espresso", mg: 64, icon: "⚡" },
  { name: "Latte", mg: 120, icon: "🥛" },
  { name: "Americano", mg: 150, icon: "💧" },
  { name: "Cold Brew", mg: 200, icon: "❄️" },
];

const MOOD_PRESETS = [
  { name: "Productive", icon: "🔥" },
  { name: "Focused", icon: "🎯" },
  { name: "Relaxed", icon: "🌿" },
  { name: "Tired", icon: "😴" },
  { name: "Creative", icon: "✨" },
];

export function CoffeeHub({ isOpen, onClose }: CoffeeHubProps) {
  const logs = useCoffeeStore((s) => s.logs);
  const addLog = useCoffeeStore((s) => s.addLog);
  const deleteLog = useCoffeeStore((s) => s.deleteLog);
  const getCurrentCaffeineLevel = useCoffeeStore(
    (s) => s.getCurrentCaffeineLevel,
  );
  const fetchLogs = useCoffeeStore((s) => s.fetchLogs);

  const [selectedDrink, setSelectedDrink] = useState(DRINK_PRESETS[1]); // Espresso default
  const [selectedMood, setSelectedMood] = useState(MOOD_PRESETS[0]); // Productive default

  useEffect(() => {
    if (isOpen) fetchLogs();
  }, [isOpen, fetchLogs]);

  const sortedLogs = useMemo(() => {
    return [...logs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [logs]);

  const currentLevel = getCurrentCaffeineLevel();

  const coffeesToday = useMemo(() => {
    const today = dayjs().startOf("day");
    return logs.filter((l) => dayjs(l.timestamp).isAfter(today)).length;
  }, [logs]);

  const totalCaffeineMgToday = useMemo(() => {
    const today = dayjs().startOf("day");
    return logs
      .filter((l) => dayjs(l.timestamp).isAfter(today))
      .reduce((total, l) => total + l.caffeineMg, 0);
  }, [logs]);

  const safeToSleepTime = useMemo(() => {
    if (logs.length === 0) return "Now";
    const sortedLogs = [...logs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const lastLog = sortedLogs[0];
    const lastTime = dayjs(lastLog.timestamp);
    const clearTime = lastTime.add(5, "hour");
    if (clearTime.isBefore(dayjs())) return "Now";
    return clearTime.format("h:mm A");
  }, [logs]);

  const handleAdd = async () => {
    await addLog({
      type: selectedDrink.name,
      caffeineMg: selectedDrink.mg,
      mood: selectedMood.name,
    });
  };

  // Lock body scrolling when the modal is open
  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (typeof window !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen]);

  // Escape key close listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-6 bg-background/80 backdrop-blur-md overflow-hidden cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card/90 border border-border/50 w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative pb-safe cursor-default my-auto"
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-border/50 flex items-center justify-between bg-muted/5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-lg shadow-orange-500/10">
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  Obel Coffee Hub
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Scientific Refueling
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">
            {/* Stats Overview */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  Caffeine Status
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Main Level Card */}
                <Card className="col-span-1 md:col-span-2 p-6 bg-muted/5 border-border/30 relative overflow-hidden group flex flex-col items-center justify-center min-h-[220px]">
                  <div className="absolute inset-0 bg-linear-to-br from-orange-500/10 to-transparent pointer-events-none" />

                  {/* Decorative Background Rings */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-12 border-orange-500/10 animate-[spin_10s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-8 border-orange-500/20 border-dashed animate-[spin_15s_linear_infinite_reverse]" />

                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-2 bg-orange-500/10 px-3 py-1 rounded-full backdrop-blur-md">
                      Current Level
                    </span>
                    <div className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-linear-to-b from-orange-400 to-orange-600 tracking-tighter drop-shadow-sm">
                      {currentLevel}%
                    </div>
                  </div>
                </Card>

                {/* Secondary Stats */}
                <div className="space-y-4 flex flex-col">
                  {/* Daily Intake */}
                  <Card className="p-4 bg-muted/5 border-border/30 flex-1 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent pointer-events-none group-hover:opacity-50 transition-opacity" />
                    <Coffee className="w-5 h-5 text-primary mb-2 opacity-80" />
                    <div className="flex items-baseline gap-1">
                      <div className="text-2xl font-black">
                        {totalCaffeineMgToday}
                      </div>
                      <div className="text-xs text-muted-foreground font-bold">
                        mg
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Intake Today
                    </div>
                    <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.min((totalCaffeineMgToday / 400) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-[8px] text-muted-foreground mt-1 text-right font-bold uppercase tracking-wider">
                      {coffeesToday} Drinks • Max: 400mg
                    </div>
                  </Card>

                  {/* Sleep Time */}
                  <Card className="p-4 bg-muted/5 border-border/30 flex-1 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-r from-blue-500/5 to-transparent pointer-events-none" />
                    <Clock className="w-5 h-5 text-blue-500 mb-2 opacity-80" />
                    <div className="text-2xl font-black">{safeToSleepTime}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Safe to Sleep
                    </div>
                  </Card>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* Selectors Section */}
              <section className="space-y-6">
                {/* Drink Type Selector */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Select Drink
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {DRINK_PRESETS.map((drink) => (
                      <button
                        key={drink.name}
                        onClick={() => setSelectedDrink(drink)}
                        className={`px-3 py-2 rounded-2xl border transition-all flex items-center gap-2 ${
                          selectedDrink.name === drink.name
                            ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20"
                            : "bg-muted/10 border-border/50 hover:bg-muted/20"
                        }`}
                      >
                        <span className="text-sm">{drink.icon}</span>
                        <span className="text-xs font-bold">{drink.name}</span>
                        {selectedDrink.name === drink.name && (
                          <Check className="w-3 h-3 ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood Selector */}
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {" "}
                    Current Mood
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_PRESETS.map((mood) => (
                      <button
                        key={mood.name}
                        onClick={() => setSelectedMood(mood)}
                        className={`px-3 py-2 rounded-2xl border transition-all flex items-center gap-2 ${
                          selectedMood.name === mood.name
                            ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "bg-muted/10 border-border/50 hover:bg-muted/20"
                        }`}
                      >
                        <span className="text-sm">{mood.icon}</span>
                        <span className="text-xs font-bold">{mood.name}</span>
                        {selectedMood.name === mood.name && (
                          <Check className="w-3 h-3 ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  className="w-full h-14 rounded-[1.5rem] bg-orange-500 hover:bg-orange-600 font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 text-white active:scale-95 transition-all"
                  onClick={handleAdd}
                >
                  Log <span className="mx-1">{selectedDrink.name}</span>
                </Button>
              </section>

              {/* History Section */}
              <section className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Recent Sips
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {sortedLogs.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-border/20 rounded-[2rem] opacity-30">
                      <Coffee className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs font-bold italic">
                        No drinks logged yet
                      </p>
                    </div>
                  ) : (
                    sortedLogs.map((log) => (
                      <div
                        key={log.id}
                        className="group flex items-center gap-3 bg-muted/10 border border-border/30 p-2.5 rounded-2xl hover:bg-muted/20 transition-all"
                      >
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 text-orange-500">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-xs truncate">
                              {log.type}
                            </h4>
                            <span className="text-[10px] font-black text-orange-500 uppercase">
                              {log.caffeineMg}mg
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase opacity-70">
                            <Clock className="w-2.5 h-2.5" />
                            {dayjs(log.timestamp).format("h:mm A")}
                            <span className="mx-1">•</span>
                            {log.mood}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive transition-all rounded-full"
                          onClick={() => deleteLog(log.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
