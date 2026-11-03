import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  Key,
  KeyRound,
  Loader2,
  Plus,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import { api, ApiToken, CreateTokenResponse } from "../../lib/api.js";
import { TOKEN_SCOPES_CONFIG } from "./settingsConstants.js";

interface ApiTokensCardProps {
  tokens: ApiToken[];
  tokensLoading: boolean;
  tokenError: string;
  isGuestMode: boolean;
  onNavigate: (path: string) => void;
  onNotice: (msg: string) => void;
  onTokenCreated: (tokenResponse: CreateTokenResponse) => void;
  loadTokens: () => Promise<void>;
}

export default function ApiTokensCard({
  tokens,
  tokensLoading,
  tokenError: parentTokenError,
  isGuestMode,
  onNavigate,
  onNotice,
  onTokenCreated,
  loadTokens,
}: ApiTokensCardProps) {
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [isRevealTokenOpen, setIsRevealTokenOpen] = useState(false);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<CreateTokenResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<ApiToken | null>(null);
  const [isDeletingToken, setIsDeletingToken] = useState(false);
  const [isSubmittingToken, setIsSubmittingToken] = useState(false);
  const [formError, setFormError] = useState("");

  // Token Creation Form State
  const [tokenName, setTokenName] = useState("");
  const [tokenExpiryDays, setTokenExpiryDays] = useState<number | 0>(30);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "bookmarks:read",
    "bookmarks:write",
  ]);

  const handleOpenCreateToken = () => {
    setTokenName("");
    setTokenExpiryDays(30);
    setSelectedScopes(["bookmarks:read", "bookmarks:write"]);
    setFormError("");
    setIsCreateTokenOpen(true);
  };

  const handleToggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) {
      setFormError("Token name is required");
      return;
    }
    if (selectedScopes.length === 0) {
      setFormError("Please select at least one permission scope");
      return;
    }
    setIsSubmittingToken(true);
    setFormError("");
    try {
      const response = await api.createToken({
        name: tokenName.trim(),
        scopes: selectedScopes,
        expiresInDays: tokenExpiryDays > 0 ? tokenExpiryDays : null,
      });
      setNewlyCreatedToken(response);
      onTokenCreated(response);
      setIsCreateTokenOpen(false);
      setIsRevealTokenOpen(true);
      setCopiedToken(false);
      await loadTokens();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setIsSubmittingToken(false);
    }
  };

  const handleCopyNewToken = async () => {
    if (!newlyCreatedToken?.token) return;
    try {
      await navigator.clipboard.writeText(newlyCreatedToken.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    } catch (err) {
      console.warn("Failed to copy token:", err);
    }
  };

  const handleDeleteTokenConfirm = async () => {
    if (!tokenToDelete) return;
    setIsDeletingToken(true);
    try {
      await api.deleteToken(tokenToDelete.id);
      setTokenToDelete(null);
      onNotice(`Token "${tokenToDelete.name}" revoked.`);
      await loadTokens();
    } catch (err: unknown) {
      alert("Failed to revoke token: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeletingToken(false);
    }
  };

  return (
    <section className="studio-card p-4 sm:p-6 relative space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
              API & Agent Access Tokens
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Generate Personal Access Tokens to connect AI agents (Claude Desktop, Antigravity, Cursor) and automated tools to your Markbel vault.
            </p>
          </div>
        </div>

        {!isGuestMode && (
          <button
            type="button"
            onClick={handleOpenCreateToken}
            className="btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate New Token</span>
          </button>
        )}
      </div>

      {isGuestMode ? (
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                Account Required for Cloud Agent Access
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xl leading-relaxed">
                Personal Access Tokens authenticate external AI agents, command-line scripts, and MCP servers directly against your Cloudflare D1 vault. Sign in or create an account to generate access tokens.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("/login?redirect=/settings")}
              className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer self-start sm:self-center"
            >
              <span>Sign In or Sign Up</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {parentTokenError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parentTokenError}</span>
            </div>
          )}

          {tokensLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-[var(--color-text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
              <span className="text-xs font-medium">Loading API tokens...</span>
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-element)]/50 space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                No active Personal Access Tokens
              </h4>
              <p className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
                Generate a scoped token to connect Claude Desktop, Antigravity MCP, or Cursor IDE to your Markbel vault.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenCreateToken}
                  className="btn-primary px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Your First Token</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border-default)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] text-[var(--color-text-muted)] font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Token Prefix</th>
                    <th className="py-2.5 px-3">Scopes</th>
                    <th className="py-2.5 px-3">Last Used</th>
                    <th className="py-2.5 px-3">Expires</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)]">
                  {tokens.map((token) => (
                    <tr
                      key={token.id}
                      className="hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                          <span className="truncate max-w-[140px] sm:max-w-none">{token.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <code className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-[var(--color-text-muted)]">
                          {token.tokenPrefix}
                        </code>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {token.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-muted)] whitespace-nowrap">
                        {token.lastUsedAt
                          ? new Date(token.lastUsedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-muted)] whitespace-nowrap">
                        {token.expiresAt ? (
                          <span
                            className={
                              new Date(token.expiresAt).getTime() < Date.now()
                                ? "text-red-500 font-semibold"
                                : ""
                            }
                          >
                            {new Date(token.expiresAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setTokenToDelete(token)}
                          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Revoke Token"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Token Creation Modal */}
      {isCreateTokenOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingToken) {
              setIsCreateTokenOpen(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Generate Personal Access Token
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Create a scoped token for AI assistants and MCP servers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateTokenOpen(false)}
                disabled={isSubmittingToken}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateToken} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-primary)]">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. Cursor Assistant, Claude Desktop, Antigravity Agent"
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--color-text-primary)]">
                  Expiration
                </label>
                <select
                  value={tokenExpiryDays}
                  onChange={(e) => setTokenExpiryDays(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year (365 Days)</option>
                  <option value={0}>Never (No Expiration)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--color-text-primary)]">
                    Permissions & Scopes
                  </label>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {selectedScopes.length} selected
                  </span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {TOKEN_SCOPES_CONFIG.map((sc) => {
                    const isChecked = selectedScopes.includes(sc.id);
                    return (
                      <label
                        key={sc.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer select-none ${
                          isChecked
                            ? "bg-[var(--color-accent)]/5 border-[var(--color-accent)]/40"
                            : "bg-[var(--color-bg-element)] border-[var(--color-border-default)] hover:bg-[var(--color-bg-hover)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleScope(sc.id)}
                          className="mt-0.5 rounded border-[var(--color-border-default)] text-[var(--color-accent)] focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[var(--color-text-primary)] font-mono">
                            {sc.name}
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                            {sc.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
                <button
                  type="button"
                  onClick={() => setIsCreateTokenOpen(false)}
                  disabled={isSubmittingToken}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingToken}
                  className="btn-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingToken ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Key className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Token Reveal Modal */}
      {isRevealTokenOpen && newlyCreatedToken && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2.5 text-[var(--color-status-success)]">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Personal Access Token Generated
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {newlyCreatedToken.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Make sure to copy your Personal Access Token now. You will not be able to see it again.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--color-text-primary)]">
                Your Token
              </label>
              <div className="relative group">
                <div className="p-3 pr-24 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg font-mono text-xs break-all select-all text-[var(--color-text-primary)]">
                  {newlyCreatedToken.token}
                </div>
                <button
                  type="button"
                  onClick={handleCopyNewToken}
                  className="absolute right-2 top-2 bottom-2 px-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  {copiedToken ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-2.5 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-0.5">
                  Expires
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {newlyCreatedToken.expiresAt
                    ? new Date(newlyCreatedToken.expiresAt).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
              <div className="p-2.5 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block mb-0.5">
                  Scopes Granted
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {newlyCreatedToken.scopes.length} scope{newlyCreatedToken.scopes.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => {
                  setIsRevealTokenOpen(false);
                  setNewlyCreatedToken(null);
                }}
                className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
              >
                I Have Saved My Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Revoke Confirmation Modal */}
      {tokenToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingToken) {
              setTokenToDelete(null);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Revoke Personal Access Token
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTokenToDelete(null)}
                disabled={isDeletingToken}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Are you sure you want to revoke <strong className="text-[var(--color-text-primary)] font-semibold">{tokenToDelete.name}</strong> ({tokenToDelete.tokenPrefix})? Any AI agent, MCP server, or external workflow using this token will immediately lose access to your vault.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => setTokenToDelete(null)}
                disabled={isDeletingToken}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTokenConfirm}
                disabled={isDeletingToken}
                className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingToken && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Revoke Token</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
