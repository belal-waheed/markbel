import React, { useState } from "react";
import {
  Bot,
  Check,
  Copy,
  Cpu,
  Terminal,
} from "lucide-react";
import { MCP_CLIENTS } from "./settingsConstants.js";
import { CreateTokenResponse } from "../../lib/api.js";

interface McpStudioCardProps {
  newlyCreatedToken: CreateTokenResponse | null;
  hasTokens: boolean;
}

export default function McpStudioCard({
  newlyCreatedToken,
  hasTokens,
}: McpStudioCardProps) {
  const [selectedMcpClient, setSelectedMcpClient] = useState<string>("claude");
  const [mcpTokenInput, setMcpTokenInput] = useState("");
  const [copiedMcpConfig, setCopiedMcpConfig] = useState(false);

  const activeMcpToken =
    mcpTokenInput.trim() || newlyCreatedToken?.token || "mb_pat_YOUR_TOKEN";

  const handleCopyMcpConfig = async () => {
    const currentClient =
      MCP_CLIENTS.find((c) => c.id === selectedMcpClient) || MCP_CLIENTS[0];
    const configText = currentClient.getConfig(activeMcpToken);
    try {
      await navigator.clipboard.writeText(configText);
      setCopiedMcpConfig(true);
      setTimeout(() => setCopiedMcpConfig(false), 2000);
    } catch (err) {
      console.error("Failed to copy MCP configuration:", err);
    }
  };

  const currentClientConfig =
    MCP_CLIENTS.find((c) => c.id === selectedMcpClient) || MCP_CLIENTS[0];

  return (
    <section className="studio-card p-4 sm:p-6 relative space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
              AI Agent & MCP Studio
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Connect Markbel to Claude Desktop, Cursor, Zed, Antigravity, or custom agents via Model Context Protocol.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            Protocol v1.32+
          </span>
        </div>
      </div>

      {/* Client Selection Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-border-default)] pb-3">
        {MCP_CLIENTS.map((client) => {
          const isActive = selectedMcpClient === client.id;
          return (
            <button
              key={client.id}
              type="button"
              onClick={() => setSelectedMcpClient(client.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-[var(--color-accent)] text-white shadow-xs"
                  : "bg-[var(--color-bg-element)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-default)]"
              }`}
            >
              {client.id === "cli" ? (
                <Terminal className="w-3.5 h-3.5" />
              ) : (
                <Cpu className="w-3.5 h-3.5" />
              )}
              <span>{client.name}</span>
            </button>
          );
        })}
      </div>

      {/* Token Selection & Target Path Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5">
          <label className="font-semibold text-[var(--color-text-primary)] block">
            Injected API Token
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={mcpTokenInput}
              onChange={(e) => setMcpTokenInput(e.target.value)}
              placeholder={newlyCreatedToken?.token || "mb_pat_YOUR_TOKEN"}
              className="w-full px-3 py-1.5 bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            {newlyCreatedToken && (
              <button
                type="button"
                onClick={() => setMcpTokenInput(newlyCreatedToken.token)}
                className="px-2.5 py-1.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded font-semibold text-[11px] whitespace-nowrap hover:bg-[var(--color-accent)]/20 cursor-pointer"
                title="Use newly created token"
              >
                Use New Token
              </button>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {newlyCreatedToken
              ? "Auto-detected newly created token from current session."
              : hasTokens
              ? "Enter your saved token secret or leave placeholder."
              : "Generate a token in API Access Tokens above to inject."}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="font-semibold text-[var(--color-text-primary)] block">
            Configuration Target
          </label>
          <div className="px-3 py-1.5 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded text-xs font-mono text-[var(--color-text-primary)] truncate">
            {currentClientConfig.configFile}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] truncate">
            {currentClientConfig.pathHint}
          </p>
        </div>
      </div>

      {/* Configuration Code Block */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--color-text-primary)]">
            Configuration Snippet
          </span>
          <button
            type="button"
            onClick={handleCopyMcpConfig}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              copiedMcpConfig
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                : "bg-[var(--color-accent)] text-white hover:opacity-90"
            }`}
          >
            {copiedMcpConfig ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Configuration</span>
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <pre className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-3.5 text-xs font-mono text-[var(--color-text-primary)] overflow-x-auto whitespace-pre leading-relaxed select-all">
            {currentClientConfig.getConfig(activeMcpToken)}
          </pre>
        </div>
      </div>

      {/* Available MCP Tools Reference */}
      <div className="p-3 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[var(--color-text-primary)] tracking-wide">
            Supported Agent MCP Tools (14 Available)
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
            @markbel/mcp
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_search</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Multi-token search with relevance ranking & snippets</span>
          </div>
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_get_bookmark</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Retrieve full bookmark metadata & article markdown</span>
          </div>
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_create_bookmark</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Save new URLs with automatic group categorization</span>
          </div>
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_batch_mutate</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Atomic multi-record bookmark updates & archiving</span>
          </div>
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_list_groups</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Explore vault categories & bookmark counts</span>
          </div>
          <div className="p-2 rounded bg-[var(--color-bg-base)] border border-[var(--color-border-default)]">
            <span className="font-mono font-semibold text-[var(--color-accent)] block">markbel_get_stats</span>
            <span className="text-[var(--color-text-muted)] text-[10px]">Vault overview, read vs unread counts, archives</span>
          </div>
        </div>
      </div>
    </section>
  );
}
