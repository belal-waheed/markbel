import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  Plus,
  Share2,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import { agentApi, VaultCollaborator } from "../../lib/api.js";

interface VaultCollaborationCardProps {
  collaborators: VaultCollaborator[];
  collabLoading: boolean;
  collabError: string;
  isGuestMode: boolean;
  onNotice: (msg: string) => void;
  loadCollaborators: () => Promise<void>;
}

export default function VaultCollaborationCard({
  collaborators,
  collabLoading,
  collabError: parentCollabError,
  isGuestMode,
  onNotice,
  loadCollaborators,
}: VaultCollaborationCardProps) {
  const [isInviteCollabOpen, setIsInviteCollabOpen] = useState(false);
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"viewer" | "editor">("viewer");
  const [isSubmittingCollab, setIsSubmittingCollab] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [collabToDelete, setCollabToDelete] = useState<VaultCollaborator | null>(null);
  const [isDeletingCollab, setIsDeletingCollab] = useState(false);
  const [formError, setFormError] = useState("");

  const handleOpenInvite = () => {
    setCollabEmail("");
    setCollabRole("viewer");
    setFormError("");
    setIsInviteCollabOpen(true);
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim() || !collabEmail.includes("@")) {
      setFormError("Please enter a valid email address");
      return;
    }
    setIsSubmittingCollab(true);
    setFormError("");
    try {
      await agentApi.inviteCollaborator({
        email: collabEmail.trim(),
        role: collabRole,
      });
      setIsInviteCollabOpen(false);
      setCollabEmail("");
      setCollabRole("viewer");
      onNotice("Collaborator invitation dispatched.");
      await loadCollaborators();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to invite collaborator");
    } finally {
      setIsSubmittingCollab(false);
    }
  };

  const handleDeleteCollaborator = async () => {
    if (!collabToDelete) return;
    setIsDeletingCollab(true);
    try {
      await agentApi.deleteCollaborator(collabToDelete.id);
      setCollabToDelete(null);
      onNotice("Collaborator removed.");
      await loadCollaborators();
    } catch (err: unknown) {
      alert("Failed to remove collaborator: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsDeletingCollab(false);
    }
  };

  const handleCopyInviteLink = async (collab: VaultCollaborator) => {
    const link =
      collab.invite_link ||
      `https://mark.obel.workers.dev/join?token=${collab.invite_token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(collab.id);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (err) {
      console.warn("Failed to copy link:", err);
    }
  };

  return (
    <section className="studio-card p-4 sm:p-6 relative space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
              Vault Collaboration & Shared Access
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Invite team members and autonomous agents to your vault with granular viewer or editor permissions.
            </p>
          </div>
        </div>

        {!isGuestMode && (
          <button
            type="button"
            onClick={handleOpenInvite}
            className="btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Invite Collaborator</span>
          </button>
        )}
      </div>

      {isGuestMode ? (
        <div className="p-4 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)] space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Account Required for Vault Collaboration
              </p>
              <p className="text-[var(--color-text-muted)]">
                You are currently using Markbel in offline guest mode. Sign up or log in to sync your vault across devices and invite peer collaborators.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {parentCollabError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parentCollabError}</span>
            </div>
          )}

          {collabLoading ? (
            <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)] gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
              <span>Loading collaborators...</span>
            </div>
          ) : collaborators.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[var(--color-border-default)] rounded-lg space-y-2">
              <p className="text-xs font-bold text-[var(--color-text-primary)]">No Collaborators Yet</p>
              <p className="text-[11px] text-[var(--color-text-muted)] max-w-sm mx-auto">
                Invite peer users or AI agent operators by email to share access to your bookmarks and smart collections.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--color-border-default)] rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] text-[var(--color-text-muted)] font-semibold">
                    <th className="py-2.5 px-3">Collaborator</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Invited</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)]">
                  {collaborators.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--color-bg-element)]/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[var(--color-text-primary)]">
                        {c.collaborator_email}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.role === "editor"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          }`}
                        >
                          {c.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === "accepted"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                          }`}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--color-text-muted)] text-[11px]">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleCopyInviteLink(c)}
                              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] rounded cursor-pointer transition-colors"
                              title="Copy Invitation Link"
                            >
                              {copiedInviteId === c.id ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCollabToDelete(c)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                            title="Revoke Collaborator"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Collaborator Modal */}
      {isInviteCollabOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingCollab) {
              setIsInviteCollabOpen(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Invite Vault Collaborator
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Grant peer access to your bookmarks and collections
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteCollabOpen(false)}
                disabled={isSubmittingCollab}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteCollaborator} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Collaborator Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={collabEmail}
                  onChange={(e) => setCollabEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-element)] text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Permission Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollabRole("viewer")}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      collabRole === "viewer"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-bold"
                        : "border-[var(--color-border-default)] bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-medium"
                    }`}
                  >
                    <div className="text-xs">Viewer</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Read & search only</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollabRole("editor")}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      collabRole === "editor"
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] font-bold"
                        : "border-[var(--color-border-default)] bg-[var(--color-bg-element)] text-[var(--color-text-muted)] font-medium"
                    }`}
                  >
                    <div className="text-xs">Editor</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Read, write & categorize</div>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
                <button
                  type="button"
                  onClick={() => setIsInviteCollabOpen(false)}
                  disabled={isSubmittingCollab}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCollab}
                  className="btn-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingCollab && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Generate Invitation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Collaborator Confirmation Modal */}
      {collabToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingCollab) {
              setCollabToDelete(null);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Remove Collaborator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCollabToDelete(null)}
                disabled={isDeletingCollab}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Are you sure you want to remove <strong className="text-[var(--color-text-primary)] font-semibold">{collabToDelete.collaborator_email}</strong> from this vault? They will immediately lose access to your bookmarks and collections.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => setCollabToDelete(null)}
                disabled={isDeletingCollab}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCollaborator}
                disabled={isDeletingCollab}
                className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingCollab && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Remove Collaborator</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
