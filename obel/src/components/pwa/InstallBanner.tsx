import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui/Logo';

export function InstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Delay showing the banner slightly for better UX
    if (isInstallable && !isInstalled && !dismissed) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, dismissed]);

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 inset-x-0 z-40 p-3 md:p-6"
        >
          <div className="max-w-4xl mx-auto bg-card/60 backdrop-blur-2xl border border-primary/20 rounded-[2.5rem] p-4 md:p-6 shadow-2xl shadow-primary/10 relative overflow-hidden group">
            {/* Animated Background Element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 shadow-inner">
                  <Logo size={28} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-foreground flex items-center justify-center md:justify-start gap-2">
                    Unlock the full Obel experience
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5 max-w-md">
                    Install Obel as a native app for seamless focus, offline access, and a faster workflow.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => { setShowBanner(false); setDismissed(true); }}
                  className="rounded-2xl h-12 px-6 border-border/50 hover:bg-muted/50 text-muted-foreground font-bold shrink-0"
                >
                  <X className="w-4 h-4 mr-2" />
                  Not now
                </Button>
                <Button 
                  onClick={install}
                  size="lg"
                  className="flex-1 md:flex-none rounded-2xl h-12 px-8 font-black uppercase tracking-widest gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all bg-primary text-primary-foreground"
                >
                  <Download className="w-5 h-5" />
                  Install App
                </Button>
              </div>
            </div>

            {/* Feature tags */}
            <div className="hidden md:flex items-center gap-4 mt-4 border-t border-primary/10 pt-4 opacity-60">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                <Wifi className="w-3 h-3" />
                Offline First
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                <Sparkles className="w-3 h-3" />
                Native Performance
              </div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-primary">
                <div className="w-2 h-2 rounded-full bg-primary" />
                Zero Latency
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
