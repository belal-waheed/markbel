import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import {
  getStoredTickTickConfig,
  setStoredTickTickConfig,
  getTickTickProjects,
  TickTickProject,
} from "../../lib/ticktickSync.js";

interface TickTickIntegrationCardProps {
  onNotice?: (msg: string) => void;
}

export default function TickTickIntegrationCard({ onNotice }: TickTickIntegrationCardProps) {
  const [token, setToken] = useState("");
  const [projectId, setProjectId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [projects, setProjects] = useState<TickTickProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const config = getStoredTickTickConfig();
    setToken(config.token);
    setProjectId(config.projectId || "");
    setEnabled(config.enabled);

    if (config.token && config.enabled) {
      loadProjectsSilently(config.token);
    }
  }, []);

  const loadProjectsSilently = async (tok: string) => {
    try {
      const projs = await getTickTickProjects(tok);
      setProjects(projs);
    } catch {
      // Ignore background error
    }
  };

  const handleTestConnection = async () => {
    if (!token.trim()) {
      setStatusMessage({ type: "error", text: "Please enter your TickTick API token first." });
      return;
    }

    setLoadingProjects(true);
    setStatusMessage(null);

    try {
      const projs = await getTickTickProjects(token.trim());
      setProjects(projs);
      setStatusMessage({
        type: "success",
        text: `Successfully authenticated with TickTick! Loaded ${projs.length} project${projs.length === 1 ? "" : "s"}.`,
      });
      if (onNotice) {
        onNotice(`TickTick authenticated: ${projs.length} projects loaded.`);
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to connect to TickTick API.",
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSave = () => {
    setStoredTickTickConfig({
      token: token.trim(),
      projectId: projectId.trim(),
      enabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    if (onNotice) {
      onNotice("TickTick synchronization preferences saved.");
    }
  };

  return (
    <div className="studio-card p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
              TickTick Two-Way Sync
            </h3>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                enabled && token
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]"
              }`}
            >
              {enabled && token ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Automatically bridge reading items into TickTick tasks with two-way completion sync.
          </p>
        </div>

        {/* Enable / Disable Switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            Enable Sync
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-[var(--color-border-subtle)] text-[var(--color-accent)] focus:ring-[var(--color-border-focus)] cursor-pointer"
          />
        </label>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Token Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              TickTick Open API Token
            </label>
            <a
              href="https://developer.ticktick.com/manage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--color-accent)] hover:underline flex items-center gap-1"
            >
              <span>Get Token</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste Bearer Token from TickTick Developer Portal..."
              className="w-full bg-[var(--color-bg-muted)]/70 hover:bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] rounded-lg py-2 pl-3 pr-10 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-mono transition-all"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title={showToken ? "Hide token" : "Show token"}
            >
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Project Selector & Test Connection Button */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Target TickTick Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={projects.length === 0}
              className="w-full bg-[var(--color-bg-muted)]/70 hover:bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)] focus:border-[var(--color-border-focus)] rounded-lg py-2 px-3 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer disabled:opacity-50"
            >
              <option value="" className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]">
                {projects.length > 0 ? "Select target project (Default / Inbox)" : "Click 'Test Connection' to load projects"}
              </option>
              {projects.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]"
                >
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loadingProjects || !token.trim()}
            className="w-full min-h-[38px] px-3.5 py-2 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-muted)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {loadingProjects ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Test Connection & Load Projects</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}
          >
            {statusMessage.type === "success" ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4">
        <span className="text-[11px] text-[var(--color-text-tertiary)]">
          Syncs whenever items are created, read, or scheduled.
        </span>

        <button
          type="button"
          onClick={handleSave}
          className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 active:scale-95 transition-all"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </>
          ) : (
            <span>Save Preferences</span>
          )}
        </button>
      </div>
    </div>
  );
}
