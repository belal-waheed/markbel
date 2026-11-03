import React, { useEffect, useState } from "react";
import { Check, Eye, Moon, Palette, Sun, Monitor } from "lucide-react";

interface AppearanceCardProps {
  onNotice?: (msg: string) => void;
}

type ThemeMode = "system" | "light" | "dark";

export default function AppearanceCard({ onNotice }: AppearanceCardProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("markbel_theme_mode") as ThemeMode) || "system";
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("markbel_high_contrast") === "true";
  });

  // Apply theme mode to documentElement
  const applyTheme = (mode: ThemeMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else {
      // System mode
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem("markbel_theme_mode", mode);
    applyTheme(mode);
    if (onNotice) {
      const modeLabel =
        mode === "system" ? "System preference" : mode === "dark" ? "Dark mode" : "Light mode";
      onNotice(`Theme set to ${modeLabel}.`);
    }
  };

  const handleToggleHighContrast = () => {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem("markbel_high_contrast", String(next));
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("high-contrast", next);
    }
    if (onNotice) {
      onNotice(next ? "High contrast mode enabled." : "Standard contrast mode restored.");
    }
  };

  useEffect(() => {
    // Listen to system scheme changes when mode is "system"
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (themeMode === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeMode]);

  return (
    <section className="studio-card p-4 sm:p-6 relative space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-border-default)] text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Appearance & Theme Tokens
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Configure system display theme, WCAG contrast standards, and color tokens
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-2.5 py-0.5 rounded">
          Design System
        </span>
      </div>

      {/* Theme Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[var(--color-text-primary)] block">
          Display Theme
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* System Option */}
          <button
            type="button"
            onClick={() => handleSelectTheme("system")}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start justify-between ${
              themeMode === "system"
                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-text-primary)] font-bold shadow-xs"
                : "bg-[var(--color-bg-element)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Monitor className="w-4 h-4 text-[var(--color-accent)]" />
              <div>
                <span className="text-xs block">System Sync</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Follow OS schedule
                </span>
              </div>
            </div>
            {themeMode === "system" && <Check className="w-4 h-4 text-[var(--color-accent)]" />}
          </button>

          {/* Light Option */}
          <button
            type="button"
            onClick={() => handleSelectTheme("light")}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start justify-between ${
              themeMode === "light"
                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-text-primary)] font-bold shadow-xs"
                : "bg-[var(--color-bg-element)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <div>
                <span className="text-xs block">Light Theme</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Neutral canvas paper
                </span>
              </div>
            </div>
            {themeMode === "light" && <Check className="w-4 h-4 text-[var(--color-accent)]" />}
          </button>

          {/* Dark Option */}
          <button
            type="button"
            onClick={() => handleSelectTheme("dark")}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer flex items-start justify-between ${
              themeMode === "dark"
                ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-text-primary)] font-bold shadow-xs"
                : "bg-[var(--color-bg-element)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="text-xs block">Dark Theme</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  OLED low-light surface
                </span>
              </div>
            </div>
            {themeMode === "dark" && <Check className="w-4 h-4 text-[var(--color-accent)]" />}
          </button>
        </div>
      </div>

      {/* High Contrast Accessibility Switch */}
      <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] flex items-start justify-between gap-4">
        <div className="space-y-1 pr-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-xs font-bold text-[var(--color-text-primary)] block">
              High-Contrast Mode (WCAG AAA)
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Enhances border separation and text contrast ratios to exceed 7:1 for improved readability in bright environments.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={highContrast}
          onClick={handleToggleHighContrast}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
            highContrast ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-default)]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              highContrast ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Theme Tokens Palette Grid */}
      <div className="space-y-2 pt-2 border-t border-[var(--color-border-default)]">
        <span className="text-xs font-bold text-[var(--color-text-primary)] block">
          Active Design System Tokens
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
          <div className="p-2.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-main)]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[var(--color-text-primary)]">Canvas</span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">bg-main</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] block">Page backdrop</span>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[var(--color-text-primary)]">Surface</span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">surface</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] block">Card substrate</span>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-accent)] text-white">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">Accent</span>
              <span className="text-[10px] font-mono opacity-80">brand</span>
            </div>
            <span className="text-[10px] opacity-80 block">Interactive primary</span>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-element)]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[var(--color-text-primary)]">Element</span>
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">element</span>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] block">Inputs & tags</span>
          </div>
        </div>
      </div>
    </section>
  );
}
