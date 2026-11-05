import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Code,
  FileJson,
  FlaskConical,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  X as CloseIcon,
} from "lucide-react";
import {
  CompoundSmartGroupRule,
  RuleConstraint,
  ConstraintOperator,
  PRESET_SMART_RULES,
  calculateRuleSpecificity,
  inspectSmartGroupMatch,
  installPresetRule,
  uninstallPresetRule,
  saveCustomSmartGroupRules,
} from "../../lib/smartGroups.js";
import { db, autoOrganizeUnsortedBookmarks } from "../../db/db.js";
import { syncManager } from "../../db/SyncManager.js";
import { useAuth } from "../../lib/auth.js";
import {
  COLOR_OPTIONS,
  OPERATOR_CONFIG,
  OPERATOR_OPTIONS,
  getGroupBadgeClass,
  getPresetIcon,
} from "./settingsConstants.js";

interface SmartGroupsCardProps {
  customRules: CompoundSmartGroupRule[];
  availableGroups: string[];
  groupColorMap: Record<string, string>;
  onRefresh: () => Promise<void>;
  onNotice: (msg: string) => void;
}

export default function SmartGroupsCard({
  customRules,
  availableGroups,
  groupColorMap,
  onRefresh,
  onNotice,
}: SmartGroupsCardProps) {
  const { user } = useAuth();
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleError, setRuleError] = useState("");

  // Live Test Sandbox State
  const [sandboxUrl, setSandboxUrl] = useState("");

  // Compound Constraint Builder State
  const [builderRuleName, setBuilderRuleName] = useState("");
  const [builderTargetGroup, setBuilderTargetGroup] = useState(() => availableGroups[0] || "");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState("blue");
  const [builderConstraints, setBuilderConstraints] = useState<RuleConstraint[]>([
    { id: crypto.randomUUID(), operator: "domain_equals", value: "" },
  ]);

  // JSON Editor State
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Sandbox evaluation
  const sandboxResult = sandboxUrl.trim()
    ? inspectSmartGroupMatch(sandboxUrl.trim(), availableGroups, customRules)
    : null;

  // 1-Click Preset Installation & Removal
  const handleInstallPreset = async (presetId: string) => {
    setRulesLoading(true);
    setRuleError("");
    try {
      const installed = await installPresetRule(presetId);
      await autoOrganizeUnsortedBookmarks(user?.id || "local-user");
      syncManager.sync(true);
      await onRefresh();
      onNotice(
        `Preset "${installed.name}" installed and group "${installed.group}" activated.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRuleError("Failed to install preset: " + msg);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleUninstallPreset = async (presetId: string) => {
    setRulesLoading(true);
    setRuleError("");
    try {
      await uninstallPresetRule(presetId);
      await onRefresh();
      onNotice("Preset rule removed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRuleError("Failed to remove preset: " + msg);
    } finally {
      setRulesLoading(false);
    }
  };

  // Constraint Builder Dynamic Form Handlers
  const handleAddConstraintRow = () => {
    setBuilderConstraints((prev) => [
      ...prev,
      { id: crypto.randomUUID(), operator: "url_contains", value: "" },
    ]);
  };

  const handleUpdateConstraintRow = (
    id: string,
    field: "operator" | "value",
    val: string
  ) => {
    setBuilderConstraints((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const handleRemoveConstraintRow = (id: string) => {
    if (builderConstraints.length <= 1) return;
    setBuilderConstraints((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveCompoundRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError("");
    const trimmedName = builderRuleName.trim();
    if (!trimmedName) {
      setRuleError("Please provide a name for this auto-categorization rule.");
      return;
    }

    let finalGroup = builderTargetGroup.trim();
    let finalColor = groupColorMap[finalGroup.toLowerCase()] || "blue";

    if (isCreatingNewGroup) {
      finalGroup = newGroupName.trim();
      finalColor = newGroupColor;
      if (!finalGroup) {
        setRuleError("Please enter a name for the new target group.");
        return;
      }

      const existingGroup = availableGroups.find(
        (g) => g.toLowerCase() === finalGroup.toLowerCase()
      );
      if (!existingGroup) {
        const now = new Date().toISOString();
        const newGroupId = crypto.randomUUID();
        const groupRecord = {
          id: newGroupId,
          userId: user?.id || "local-user",
          name: finalGroup,
          color: finalColor,
          version: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };

        await db.transaction("rw", [db.groups, db.syncOutbox], async () => {
          await db.groups.add(groupRecord);
          await db.syncOutbox.add({
            id: crypto.randomUUID(),
            entityType: "group",
            entityId: newGroupId,
            operation: "create",
            baseVersion: 0,
            payload: groupRecord,
            status: "pending",
            attempts: 0,
            createdAt: now,
          });
        });
      }
    }

    if (!finalGroup) {
      setRuleError("Please specify or select a target group.");
      return;
    }

    const validConstraints = builderConstraints
      .map((c) => ({
        ...c,
        value: c.value.trim(),
      }))
      .filter((c) => c.value.length > 0);

    if (validConstraints.length === 0) {
      setRuleError("Please add at least one constraint with a non-empty value.");
      return;
    }

    const newRule: CompoundSmartGroupRule = {
      id: crypto.randomUUID(),
      name: trimmedName,
      group: finalGroup,
      groupColor: finalColor,
      constraints: validConstraints,
      isPreset: false,
      createdAt: new Date().toISOString(),
    };

    setRulesLoading(true);
    try {
      const updated = [newRule, ...customRules];
      await saveCustomSmartGroupRules(updated);
      await autoOrganizeUnsortedBookmarks(user?.id || "local-user");
      syncManager.sync(true);
      await onRefresh();

      setBuilderRuleName("");
      setIsCreatingNewGroup(false);
      setNewGroupName("");
      setBuilderConstraints([
        { id: crypto.randomUUID(), operator: "domain_equals", value: "" },
      ]);
      onNotice(`Rule "${trimmedName}" created and active.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRuleError("Failed to save rule: " + msg);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const updated = customRules.filter((r) => r.id !== id);
    setRulesLoading(true);
    try {
      await saveCustomSmartGroupRules(updated);
      await onRefresh();
      onNotice("Auto-categorization rule removed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to delete rule: " + msg);
    } finally {
      setRulesLoading(false);
    }
  };

  const handleOpenJsonEditor = () => {
    setJsonText(JSON.stringify(customRules, null, 2));
    setJsonError("");
    setShowJsonEditor(true);
  };

  const handleSaveJsonEditor = async () => {
    setJsonError("");
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON root must be an array of rules.");
      }
      for (const item of parsed) {
        if (!item.name || !item.group || !Array.isArray(item.constraints)) {
          throw new Error("Each rule must contain at least 'name', 'group', and 'constraints'.");
        }
      }
      setRulesLoading(true);
      await saveCustomSmartGroupRules(parsed);
      await onRefresh();
      setShowJsonEditor(false);
      onNotice("Smart group rules updated via JSON editor.");
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON syntax or schema.");
    } finally {
      setRulesLoading(false);
    }
  };

  return (
    <section id="groups" className="studio-card p-4 sm:p-6 relative space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] flex items-center justify-center font-bold rounded">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] tracking-wide">
              Auto-Categorization Engine
            </h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Route bookmarks automatically with multi-constraint rules, 1-click presets, and live testing
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenJsonEditor}
            className="p-1.5 px-2.5 bg-[var(--color-bg-element)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Edit rules as JSON"
          >
            <FileJson className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="hidden sm:inline">JSON Editor</span>
          </button>
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] bg-[var(--color-bg-element)] px-2.5 py-1 rounded border border-[var(--color-border-default)]">
            {customRules.length} {customRules.length === 1 ? "Active Rule" : "Active Rules"}
          </span>
        </div>
      </div>

      {ruleError && (
        <div className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-status-error)]/40 text-[var(--color-text-primary)] rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-[var(--color-status-error)] shrink-0" />
          <span>{ruleError}</span>
        </div>
      )}

      {/* 1. Live Sandbox / Rule Tester */}
      <div className="p-4 bg-[var(--color-bg-element)]/60 border border-[var(--color-border-default)] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-primary)]">
            <FlaskConical className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Live Test Sandbox</span>
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
            Real-Time Heuristics
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Paste any URL to test how your configured rules and defaults evaluate before saving.
        </p>

        <div className="relative">
          <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={sandboxUrl}
            onChange={(e) => setSandboxUrl(e.target.value)}
            placeholder="e.g. https://www.youtube.com/watch?v=123&list=PLabc"
            className="w-full pl-9 pr-9 py-2 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
          />
          {sandboxUrl && (
            <button
              type="button"
              onClick={() => setSandboxUrl("")}
              className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer"
              title="Clear input"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {sandboxResult ? (
          <div className="p-3 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg space-y-2 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                  Resolved Group:
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-xs border ${getGroupBadgeClass(
                    groupColorMap[sandboxResult.group.toLowerCase()] ||
                      sandboxResult.matchedRule?.groupColor
                  )}`}
                >
                  <Tag className="w-3 h-3" />
                  <span>{sandboxResult.group}</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">
                  Matched Rule:
                </span>
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {sandboxResult.ruleName || "Unsorted"}
                </span>
                {sandboxResult.isDefault && (
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] px-2 py-0.5 rounded border border-[var(--color-border-default)]">
                    Default Heuristic
                  </span>
                )}
              </div>
            </div>

            {sandboxResult.matchedRule && (
              <div className="pt-2 border-t border-[var(--color-border-default)]/60 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[var(--color-text-muted)] font-semibold mr-1">
                  Matched Conditions:
                </span>
                {sandboxResult.matchedRule.constraints.map((c, idx) => (
                  <span
                    key={c.id || idx}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--color-bg-element)] text-[var(--color-text-primary)] px-2 py-0.5 rounded border border-[var(--color-border-default)] truncate max-w-[180px]"
                  >
                    <span className="text-[var(--color-text-muted)] shrink-0">
                      {OPERATOR_CONFIG[c.operator]?.prefix || c.operator}:
                    </span>
                    <span className="truncate">{c.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)] italic">
            Awaiting URL input to evaluate resolution logic.
          </p>
        )}
      </div>

      {/* 2. 1-Click Quick Presets Gallery */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Click Preset Library</span>
            </h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Instantly activate curated routing workflows with automatic group provisioning
            </p>
          </div>
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {PRESET_SMART_RULES.map((preset) => {
            const isInstalled = customRules.some(
              (r) =>
                r.id === preset.id ||
                r.name.toLowerCase() === preset.name.toLowerCase()
            );

            return (
              <div
                key={preset.id}
                className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-xl flex flex-col justify-between space-y-3 hover:border-[var(--color-accent)]/50 transition-colors snap-start shrink-0 w-[240px] sm:w-auto"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)]">
                        {getPresetIcon(preset.id)}
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">
                        {preset.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getGroupBadgeClass(
                        preset.groupColor
                      )}`}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>{preset.group}</span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    {preset.constraints.map((c, i) => (
                      <div
                        key={i}
                        className="font-mono text-[9px] text-[var(--color-text-muted)] truncate bg-[var(--color-bg-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-border-default)]/60"
                      >
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {OPERATOR_CONFIG[c.operator]?.prefix}:
                        </span>{" "}
                        {c.value}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {isInstalled ? (
                    <button
                      type="button"
                      onClick={() => handleUninstallPreset(preset.id)}
                      disabled={rulesLoading}
                      className="w-full py-1.5 px-2 bg-emerald-500/10 hover:bg-red-500/10 text-emerald-600 hover:text-red-600 border border-emerald-500/20 hover:border-red-500/30 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                      title="Click to remove preset"
                    >
                      <Check className="w-3 h-3 group-hover:hidden" />
                      <Trash2 className="w-3 h-3 hidden group-hover:inline" />
                      <span className="group-hover:hidden">Installed</span>
                      <span className="hidden group-hover:inline">Uninstall</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleInstallPreset(preset.id)}
                      disabled={rulesLoading}
                      className="w-full py-1.5 px-2 bg-[var(--color-bg-canvas)] hover:bg-[var(--color-accent)] hover:text-white border border-[var(--color-border-default)] hover:border-transparent rounded-lg text-[10px] font-bold text-[var(--color-text-primary)] flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Preset</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Custom Compound Constraint Builder */}
      <form
        onSubmit={handleSaveCompoundRule}
        className="pt-4 border-t border-[var(--color-border-default)] space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Compound Constraint Builder</span>
            </h4>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Create custom rules combining multiple conditions evaluated with logical AND
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Rule Label / Name
            </label>
            <input
              type="text"
              value={builderRuleName}
              onChange={(e) => setBuilderRuleName(e.target.value)}
              placeholder="e.g. YouTube Dev Playlists"
              required
              className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Target Group
            </label>
            <select
              value={isCreatingNewGroup ? "__NEW__" : builderTargetGroup}
              onChange={(e) => {
                if (e.target.value === "__NEW__") {
                  setIsCreatingNewGroup(true);
                } else {
                  setIsCreatingNewGroup(false);
                  setBuilderTargetGroup(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-[var(--color-bg-element)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
            >
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="__NEW__">+ Create New Group...</option>
            </select>
          </div>
        </div>

        {/* Inline New Group Provisioning */}
        {isCreatingNewGroup && (
          <div className="p-3 bg-[var(--color-bg-element)] border border-[var(--color-accent)]/30 rounded-xl space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-text-primary)]">
                Provision New Vault Group
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNewGroup(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                  New Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Tutorials"
                  className="w-full px-3 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-lg text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                  Group Color Tag
                </label>
                <div className="flex items-center gap-1 pt-1 flex-wrap">
                  {COLOR_OPTIONS.map((col) => (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => setNewGroupColor(col.name)}
                      className="w-11 h-11 flex items-center justify-center cursor-pointer"
                      title={col.label}
                    >
                      <span
                        className={`w-6 h-6 rounded-full ${col.bg} transition-all block ${
                          newGroupColor === col.name
                            ? "ring-2 ring-offset-2 ring-[var(--color-accent)] scale-110"
                            : "opacity-75 hover:opacity-100"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Condition Rows List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[var(--color-text-muted)]">
              Constraints (All must match - AND)
            </label>
            <button
              type="button"
              onClick={handleAddConstraintRow}
              className="text-[11px] font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Condition</span>
            </button>
          </div>

          <div className="space-y-2">
            {builderConstraints.map((constraint, index) => {
              const config = OPERATOR_CONFIG[constraint.operator];

              return (
                <div
                  key={constraint.id}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-[var(--color-bg-element)] rounded-lg border border-[var(--color-border-default)]"
                >
                  {index > 0 && (
                    <span className="text-[10px] font-bold text-[var(--color-accent)] px-2 py-1 bg-[var(--color-accent)]/10 rounded self-start sm:self-center">
                      AND
                    </span>
                  )}

                  <select
                    value={constraint.operator}
                    onChange={(e) =>
                      handleUpdateConstraintRow(
                        constraint.id,
                        "operator",
                        e.target.value as ConstraintOperator
                      )
                    }
                    className="px-2.5 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-md text-xs text-[var(--color-text-primary)] focus:outline-hidden focus:border-[var(--color-accent)] shrink-0 sm:w-44"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={constraint.value}
                    onChange={(e) =>
                      handleUpdateConstraintRow(
                        constraint.id,
                        "value",
                        e.target.value
                      )
                    }
                    placeholder={config.placeholder}
                    required
                    className="grow px-3 py-1.5 bg-[var(--color-bg-canvas)] border border-[var(--color-border-default)] rounded-md text-xs text-[var(--color-text-primary)] font-mono focus:outline-hidden focus:border-[var(--color-accent)]"
                  />

                  {builderConstraints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveConstraintRow(constraint.id)}
                      className="h-11 w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors self-end sm:self-center cursor-pointer shrink-0"
                      title="Remove condition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={rulesLoading || !builderRuleName.trim()}
            className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {rulesLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Save Compound Rule</span>
          </button>
        </div>
      </form>

      {/* 4. Active Rules List */}
      <div className="pt-4 border-t border-[var(--color-border-default)] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--color-text-primary)] tracking-wide">
            Active Configured Rules ({customRules.length})
          </h4>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            Compound rules evaluate with higher specificity priority
          </span>
        </div>

        <div className="space-y-2">
          {customRules.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-[var(--color-border-default)] rounded-lg">
              <Globe className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium text-[var(--color-text-muted)]">
                No custom auto-categorization constraints configured yet.
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Activate a 1-click preset above or create a multi-condition rule to start.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-default)] border border-[var(--color-border-default)] rounded-xl overflow-hidden bg-[var(--color-bg-element)]/40">
              {customRules.map((rule) => {
                const specificity = calculateRuleSpecificity(rule);
                const targetGroupColor =
                  groupColorMap[rule.group.toLowerCase()] ||
                  rule.groupColor ||
                  "blue";

                return (
                  <div
                    key={rule.id}
                    className="p-3.5 hover:bg-[var(--color-bg-hover)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs text-[var(--color-text-primary)]">
                          {rule.name}
                        </span>

                        {rule.isPreset && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase">
                            Preset
                          </span>
                        )}

                        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${getGroupBadgeClass(
                            targetGroupColor
                          )}`}
                        >
                          <Tag className="w-2.5 h-2.5 shrink-0" />
                          <span>{rule.group}</span>
                        </span>

                        <span className="text-[9px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-canvas)] px-1.5 py-0.2 rounded border border-[var(--color-border-default)]">
                          Specificity: {specificity}
                        </span>
                      </div>

                      {/* Connected Condition Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {rule.constraints.map((c, i) => (
                          <span key={c.id || i} className="inline-flex items-center gap-1">
                            {i > 0 && (
                              <span className="text-[9px] font-bold text-[var(--color-accent)] px-1">
                                AND
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-[var(--color-bg-canvas)] text-[var(--color-text-primary)] px-2 py-0.5 rounded border border-[var(--color-border-default)] truncate max-w-[180px]">
                              <span className="text-[var(--color-text-muted)] shrink-0">
                                {OPERATOR_CONFIG[c.operator]?.prefix || c.operator}:
                              </span>
                              <span className="truncate">{c.value}</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      disabled={rulesLoading}
                      className="h-11 w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95 disabled:opacity-50 self-end sm:self-center cursor-pointer shrink-0"
                      title="Remove rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. JSON Editor Modal */}
      {showJsonEditor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowJsonEditor(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl w-full max-w-2xl shadow-2xl p-6 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded flex items-center justify-center">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Smart Group Rules JSON Editor
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Inspect, backup, or batch update your auto-categorization definitions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowJsonEditor(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {jsonError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={14}
                className="w-full text-xs font-mono p-3 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
                placeholder="[ { id: '...', name: '...', group: '...', constraints: [...] } ]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => setShowJsonEditor(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveJsonEditor}
                className="btn-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply JSON Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
