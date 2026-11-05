import React, { useState, useEffect } from "react";
import {
  Tv,
  Film,
  Play,
  Layers,
  BookOpen,
  CheckCircle,
  Sliders,
} from "lucide-react";
import { SERIES_STRATEGIES } from "../../lib/seriesProgression.js";

interface SeriesProgressionCardProps {
  onNotice?: (msg: string) => void;
}

export default function SeriesProgressionCard({ onNotice }: SeriesProgressionCardProps) {
  const [successionMode, setSuccessionMode] = useState<"advance" | "separate">(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      return (localStorage.getItem("markbel_series_mode") as "advance" | "separate") || "advance";
    }
    return "advance";
  });

  const handleModeChange = (mode: "advance" | "separate") => {
    setSuccessionMode(mode);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("markbel_series_mode", mode);
    }
    if (onNotice) {
      onNotice(
        mode === "advance"
          ? "Series succession set to in-place advance with rollback history."
          : "Series succession set to separate bookmarks."
      );
    }
  };

  return (
    <div className="studio-card p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Tv className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
              Episodic Series Progression
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              Active
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Deterministic detection, automatic succession, and rollback history for episodic media.
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--color-text-primary)]">
          Episode Succession Mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleModeChange("advance")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              successionMode === "advance"
                ? "bg-[var(--color-brand-subtle)] border-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs"
                : "bg-[var(--color-bg-muted)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                In-Place Advance (Recommended)
              </span>
              {successionMode === "advance" && (
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Mutates existing bookmark to next episode and preserves historical episodes in rollback drawer.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange("separate")}
            className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
              successionMode === "separate"
                ? "bg-[var(--color-brand-subtle)] border-[var(--color-accent)] text-[var(--color-text-primary)] shadow-xs"
                : "bg-[var(--color-bg-muted)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                Separate Bookmarks
              </span>
              {successionMode === "separate" && (
                <CheckCircle className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              )}
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
              Creates a brand new bookmark for every new episode while leaving existing episodes untouched.
            </p>
          </button>
        </div>
      </div>

      {/* Registered Strategies Rail */}
      <div className="space-y-2 pt-2 border-t border-[var(--color-border-subtle)]">
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
          Registered Succession Strategies ({SERIES_STRATEGIES.length})
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERIES_STRATEGIES.map((strategy) => (
            <div
              key={strategy.name}
              className="p-2.5 rounded-lg bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] flex items-center gap-2"
            >
              <div className="w-6 h-6 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] shrink-0">
                {strategy.sourceType === "manga" ? (
                  <BookOpen className="w-3 h-3" />
                ) : strategy.sourceType === "youtube" ? (
                  <Play className="w-3 h-3" />
                ) : (
                  <Film className="w-3 h-3" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[var(--color-text-primary)] block truncate">
                  {strategy.name}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-mono">
                  {strategy.sourceType}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
