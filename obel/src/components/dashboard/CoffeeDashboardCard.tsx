import { useMemo, useEffect } from "react";
import { Coffee, Plus, Zap, Timer, Maximize2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCoffeeStore } from "@/stores/coffeeStore";
import { ProgressRing } from "@/components/ui/progress-ring";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface CoffeeDashboardCardProps {
  onOpenHub: () => void;
}

export function CoffeeDashboardCard({ onOpenHub }: CoffeeDashboardCardProps) {
  const fetchLogs = useCoffeeStore((s) => s.fetchLogs);
  const addLog = useCoffeeStore((s) => s.addLog);
  const logs = useCoffeeStore((s) => s.logs);
  const getCupsToday = useCoffeeStore((s) => s.getCupsToday);
  const getCurrentCaffeineLevel = useCoffeeStore(
    (s) => s.getCurrentCaffeineLevel,
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const cupsToday = getCupsToday();
  const caffeineLevel = getCurrentCaffeineLevel();

  const lastCupTime = useMemo(() => {
    if (logs.length === 0) return null;
    const sorted = [...logs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return dayjs(sorted[0].timestamp).fromNow();
  }, [logs]);

  const handleQuickAdd = () => {
    addLog({
      type: "Turkish Coffee",
      caffeineMg: 80,
      mood: "Productive",
    });
  };

  return (
    <Card className="p-5 bg-card/40 backdrop-blur-xl border-border/40 rounded-[2rem] relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />

      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-500">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-lg tracking-tight">Obel Coffee</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Zap className="w-3 h-3 text-orange-400" />
              Caffeine levels optimized
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-xl hover:bg-muted/50 transition-all text-muted-foreground"
            onClick={onOpenHub}
          >
            <Maximize2 className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            onClick={handleQuickAdd}
            className="h-10 w-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 active:scale-90 transition-all border-none"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 relative z-10">
        <div className="bg-background/40 p-3 rounded-2xl border border-border/40 flex items-center gap-3">
          <ProgressRing progress={caffeineLevel} size={36} strokeWidth={4} />
          <div>
            <p className="text-sm font-black text-orange-500">
              {caffeineLevel}%
            </p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase">
              Energy
            </p>
          </div>
        </div>
        <div className="bg-background/40 p-3 rounded-2xl border border-border/40 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="font-black text-sm">{cupsToday}</span>
          </div>
          <div>
            <p className="text-sm font-black">{cupsToday} Cups</p>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
              Today
            </p>
          </div>
        </div>
      </div>

      {lastCupTime && (
        <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          <Timer className="w-3 h-3" />
          Last cup {lastCupTime}
        </div>
      )}
    </Card>
  );
}
