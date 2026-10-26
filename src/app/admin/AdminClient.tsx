"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Hammer,
  ArrowLeftRight,
  Wrench,
  ScanSearch,
  Check,
  X,
  AlertTriangle,
  Eye,
  Lock,
  Unlock,
  Save,
  Minus,
  Plus,
  KeyRound,
  Terminal,
  LifeBuoy,
} from "lucide-react";
import type { AdminAudit } from "@/lib/services/admin-ai";
import {
  runAiAudit,
  applyAuditDecision,
  updateUserRole,
  adjustTrustScore,
  setToolStatus,
  type AdminActionState,
} from "@/lib/actions/admin";
import {
  resolveHelpRequestAction,
  escalateHelpRequestAction,
  type HelpActionState,
} from "@/lib/actions/help";

// ================================================================
// Admin Command Console — terminal aesthetic.
// Sections: telemetry, AUTOMATION CONFIGURATION, OPERATIONS CONSOLE
// (tool-calling), GUARDRAIL QUEUE (human-in-the-loop), HELP QUEUE
// (triage outcomes), audit queues, member governance.
// ================================================================

interface OwnerRef {
  id: string;
  alias: string;
  trustScore: number;
}

interface ToolRow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  createdAt: Date;
  owner: OwnerRef;
}

interface SkillRow {
  id: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  createdAt: Date;
  owner: OwnerRef;
}

interface UserRow {
  id: string;
  username: string;
  alias: string;
  role: string;
  trustScore: number;
  banned: boolean;
  createdAt: Date;
}

interface HelpRequestRow {
  id: string;
  alias: string | null;
  category: string;
  message: string;
  urgency: string;
  route: string;
  triageReason: string;
  confidence: number;
  status: string;
  resolution: string | null;
  createdAt: Date;
}

interface Stats {
  totalMembers: number;
  totalTools: number;
  availableTools: number;
  borrowedTools: number;
  maintenanceTools: number;
  activeLoans: number;
  skillsCount: number;
}

interface AdminClientProps {
  currentUserId: string;
  stats: Stats;
  auditTools: ToolRow[];
  auditSkills: SkillRow[];
  users: UserRow[];
  helpRequests: HelpRequestRow[];
}

type ActionState = AdminActionState;

// ---- Automation config types (mirror /api/llm/config GET) ----

interface PublicLlmConfig {
  configured: boolean;
  source: "DB" | "ENV" | "NONE";
  provider: string | null;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  keyHint: string | null;
}

interface ProviderOption {
  id: string;
  label: string;
  baseUrl: string;
  requiresKey: boolean;
}

// ---- Operations chat types (mirror /api/agent/chat POST) ----

interface AgentToolCallRecord {
  name: string;
  args: unknown;
  status: "EXECUTED" | "PENDING_APPROVAL" | "FAILED" | "ERROR";
  result?: unknown;
  error?: string;
  actionId?: string;
}

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolCallRecord[];
}

// ---- Guardrail queue types (mirror /api/agent/confirm GET) ----

interface AgentActionRow {
  id: string;
  toolName: string;
  argsJson: string;
  destructive: boolean;
  status: string;
  resultJson: string | null;
  error: string | null;
  createdAt: string;
  decidedAt: string | null;
}

// ---- Shared terminal primitives ----

function chip(variant: string): string {
  const map: Record<string, string> = {
    cyan: "border-cyan-500/50 text-cyan-400",
    purple: "border-purple-500/50 text-purple-400",
    green: "border-emerald-500/50 text-emerald-400",
    red: "border-red-500/50 text-red-400",
    amber: "border-amber-500/50 text-amber-400",
    zinc: "border-zinc-700 text-zinc-400",
  };
  return `font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border ${map[variant] ?? map.zinc}`;
}

const STATUS_CHIP: Record<string, string> = {
  AVAILABLE: "green",
  OFFERED: "green",
  BORROWED: "red",
  PAUSED: "red",
  MAINTENANCE: "amber",
  PENDING: "red",
  AUTO_EXECUTED: "green",
  EXECUTED: "green",
  REJECTED: "zinc",
  FAILED: "amber",
  OPEN: "cyan",
  AGENT_DISPATCHED: "cyan",
  RESOLVED: "green",
  ESCALATED: "red",
  LLM_AGENT: "cyan",
  HUMAN_ADMIN: "red",
  CRITICAL: "red",
  HIGH: "amber",
  MEDIUM: "cyan",
  LOW: "zinc",
};

// Public-safe chip labels for internal enum values.
const CHIP_LABEL: Record<string, string> = {
  LLM_AGENT: "AUTOMATED",
  AGENT_DISPATCHED: "DISPATCHED",
};

function StatusChip({ value }: { value: string }) {
  return <span className={chip(STATUS_CHIP[value] ?? "zinc")}>{CHIP_LABEL[value] ?? value}</span>;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date | string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DecisionBadge({ decision }: { decision: string }) {
  const variant =
    decision === "APPROVE"
      ? "green"
      : decision === "FLAG"
        ? "red"
        : decision === "NEEDS_REVIEW"
          ? "amber"
          : "zinc";
  return (
    <span className={chip(variant)}>
      {decision === "APPROVE" && <Check className="w-3 h-3 inline mr-1" aria-hidden="true" />}
      {decision === "FLAG" && <AlertTriangle className="w-3 h-3 inline mr-1" aria-hidden="true" />}
      {decision === "NEEDS_REVIEW" && <Eye className="w-3 h-3 inline mr-1" aria-hidden="true" />}
      {decision}
    </span>
  );
}

function AuditResultPanel({
  audit,
  targetType,
  targetId,
  applyState,
  applyAction,
  applyPending,
}: {
  audit: AdminAudit;
  targetType: string;
  targetId: string;
  applyState: ActionState;
  applyAction: (formData: FormData) => void;
  applyPending: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="mt-4 border border-zinc-800 bg-black p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DecisionBadge decision={audit.decision} />
        <span className="font-mono text-[11px] text-zinc-500">
          CONFIDENCE: <span className="text-cyan-400">{Math.round(audit.confidenceScore * 100)}%</span>
        </span>
      </div>
      <p className="text-sm text-zinc-300">{audit.auditSummary}</p>
      {audit.suggestedCategory && (
        <p className="font-mono text-[11px] text-zinc-500">
          SUGGESTED CATEGORY: <span className="text-purple-400">{audit.suggestedCategory}</span>
        </p>
      )}
      {(audit.decision === "APPROVE" || audit.decision === "FLAG") && (
        <form action={applyAction} className="space-y-3">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <input type="hidden" name="decision" value={audit.decision} />
          {audit.suggestedCategory && (
            <input type="hidden" name="suggestedCategory" value={audit.suggestedCategory} />
          )}
          <label className="flex items-start gap-2 font-mono text-[11px] text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-cyan-500 cursor-pointer"
            />
            <span>
              HUMAN CONFIRMATION REQUIRED: I have reviewed this audit and authorize the
              {audit.decision === "FLAG" ? " lockout" : " approval"} of this listing.
            </span>
          </label>
          <button
            type="submit"
            disabled={!confirmed || applyPending}
            className={`font-mono text-xs uppercase tracking-widest px-4 py-2 border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              audit.decision === "FLAG"
                ? "border-red-500/60 text-red-400 hover:bg-red-500/10"
                : "border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            {applyPending ? "Applying..." : `Apply ${audit.decision}`}
          </button>
          {applyState?.error && (
            <p role="status" className="font-mono text-[11px] text-red-400">
              {applyState.error}
            </p>
          )}
        </form>
      )}
      {(audit.decision === "NEEDS_REVIEW" || audit.decision === "NO_ACTION") && (
        <p className="font-mono text-[11px] text-zinc-600">
          No automatic status change is applied for this decision. Review manually below.
        </p>
      )}
    </div>
  );
}

// ================================================================

export default function AdminClient({
  currentUserId,
  stats,
  auditTools,
  auditSkills,
  users,
  helpRequests,
}: AdminClientProps) {
  const router = useRouter();

  const [auditState, auditAction, auditPending] = useActionState<ActionState, FormData>(runAiAudit, undefined);
  const [applyState, applyAction, applyPending] = useActionState<ActionState, FormData>(applyAuditDecision, undefined);
  const [roleState, roleAction, rolePending] = useActionState<ActionState, FormData>(updateUserRole, undefined);
  const [trustState, trustAction, trustPending] = useActionState<ActionState, FormData>(adjustTrustScore, undefined);
  const [statusState, statusAction, statusPending] = useActionState<ActionState, FormData>(setToolStatus, undefined);
  const [resolveState, resolveAction, resolvePending] = useActionState<HelpActionState, FormData>(
    resolveHelpRequestAction,
    undefined
  );
  const [escalateState, escalateAction, escalatePending] = useActionState<HelpActionState, FormData>(
    escalateHelpRequestAction,
    undefined
  );

  const [auditResults, setAuditResults] = useState<Record<string, AdminAudit>>({});
  const [promptAudit, setPromptAudit] = useState<AdminAudit | null>(null);
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    if (auditState?.success && auditState.audit) {
      if (auditState.targetType === "PROMPT") {
        setPromptAudit(auditState.audit);
      } else if (auditState.targetType && auditState.targetId) {
        const key = `${auditState.targetType}:${auditState.targetId}`;
        setAuditResults((prev) => ({ ...prev, [key]: auditState.audit as AdminAudit }));
      }
    }
  }, [auditState]);

  // Refresh server data after help queue actions.
  useEffect(() => {
    if (resolveState?.success || escalateState?.success) router.refresh();
  }, [resolveState, escalateState, router]);

  // ---------------- AUTOMATION CONFIGURATION ----------------

  const [llmConfig, setLlmConfig] = useState<PublicLlmConfig | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLlmConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/llm/config");
      if (!res.ok) return;
      const data = (await res.json()) as {
        config: PublicLlmConfig;
        providers: ProviderOption[];
        modelSuggestions: string[];
      };
      setLlmConfig(data.config);
      setProviders(data.providers);
      setModelSuggestions(data.modelSuggestions);
      setProvider((prev) => prev || data.config.provider || "OPENROUTER");
      setModel((prev) => prev || data.config.model || "");
      setBaseUrl((prev) => prev || data.config.baseUrl || "");
    } catch {
      // Config panel stays empty; status line shows the error.
      setCfgMsg({ ok: false, text: "Failed to load configuration" });
    }
  }, []);

  useEffect(() => {
    loadLlmConfig();
  }, [loadLlmConfig]);

  async function saveConfig(clearKey: boolean) {
    setCfgSaving(true);
    setCfgMsg(null);
    try {
      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          baseUrl,
          apiKey: clearKey ? "CLEAR" : apiKeyInput,
        }),
      });
      const data = (await res.json()) as { config?: PublicLlmConfig; error?: string };
      if (!res.ok) {
        setCfgMsg({ ok: false, text: data.error || "Save failed" });
      } else if (data.config) {
        setLlmConfig(data.config);
        setApiKeyInput("");
        setCfgMsg({ ok: true, text: clearKey ? "API KEY CLEARED" : "CONFIGURATION SAVED" });
      }
    } catch {
      setCfgMsg({ ok: false, text: "Network error while saving configuration" });
    } finally {
      setCfgSaving(false);
    }
  }

  const selectedProvider = providers.find((p) => p.id === provider);

  // ---------------- OPERATIONS CONSOLE ----------------

  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // ---------------- GUARDRAIL QUEUE ----------------

  const [pendingActions, setPendingActions] = useState<AgentActionRow[]>([]);
  const [recentActions, setRecentActions] = useState<AgentActionRow[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [guardrailMsg, setGuardrailMsg] = useState<string | null>(null);

  const refreshGuardrail = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/confirm");
      if (!res.ok) return;
      const data = (await res.json()) as { pending: AgentActionRow[]; recent: AgentActionRow[] };
      setPendingActions(data.pending);
      setRecentActions(data.recent);
    } catch {
      // Non-fatal; queue stays as-is.
    }
  }, []);

  useEffect(() => {
    refreshGuardrail();
  }, [refreshGuardrail]);

  async function decideAction(actionId: string, approve: boolean) {
    setDecidingId(actionId);
    setGuardrailMsg(null);
    try {
      const res = await fetch("/api/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, approve }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setGuardrailMsg(data.error || "Confirmation failed");
      } else {
        setGuardrailMsg(
          approve ? `ACTION ${data.status ?? "EXECUTED"}` : "ACTION REJECTED — nothing executed"
        );
      }
      await refreshGuardrail();
    } catch {
      setGuardrailMsg("Network error during confirmation");
    } finally {
      setDecidingId(null);
    }
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatting) return;
    const withUser: ChatEntry[] = [...chatLog, { role: "user", content: text }];
    setChatLog(withUser);
    setChatInput("");
    setChatting(true);
    setChatError(null);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: withUser
            .filter((m) => !m.toolCalls || m.toolCalls.length === 0)
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        toolCalls?: AgentToolCallRecord[];
        error?: string;
      };
      if (!res.ok) {
        setChatLog([...withUser, { role: "assistant", content: `ERROR: ${data.error ?? "request failed"}` }]);
      } else {
        setChatLog([
          ...withUser,
          { role: "assistant", content: data.reply ?? "", toolCalls: data.toolCalls ?? [] },
        ]);
        if ((data.toolCalls ?? []).some((tc) => tc.status === "PENDING_APPROVAL")) {
          await refreshGuardrail();
        }
      }
    } catch {
      setChatError("Network error — service unreachable");
    } finally {
      setChatting(false);
    }
  }

  // ---------------- Derived ----------------

  const statCards = [
    { label: "MEMBERS", value: stats.totalMembers, accent: "text-cyan-400" },
    { label: "TOOLS", value: stats.totalTools, accent: "text-purple-400" },
    { label: "ACTIVE LOANS", value: stats.activeLoans, accent: "text-emerald-400" },
    { label: "SKILLS", value: stats.skillsCount, accent: "text-red-400" },
  ];

  const moderationError =
    roleState?.error || trustState?.error || statusState?.error || applyState?.error;
  const moderationSuccess =
    (roleState?.success || trustState?.success || statusState?.success || applyState?.success) &&
    !moderationError;

  const openHelp = helpRequests.filter((r) => r.status === "OPEN" || r.status === "AGENT_DISPATCHED");
  const closedHelp = helpRequests.filter((r) => r.status === "RESOLVED" || r.status === "ESCALATED");

  const renderToolCard = (tool: ToolRow) => {
    const key = `TOOL:${tool.id}`;
    const audit = auditResults[key];
    return (
      <div key={tool.id} className="bg-[#0a0a0a] border border-zinc-800 p-5 transition-colors hover:border-zinc-600">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Link href={`/tools/${tool.id}`} className="font-semibold text-white hover:text-cyan-400 transition-colors">
              {tool.name}
            </Link>
            <p className="font-mono text-[11px] text-zinc-500 mt-1">
              {tool.category} · OWNER: <span className="text-zinc-300">{tool.owner.alias}</span> · TRUST:{" "}
              {tool.owner.trustScore}
            </p>
          </div>
          <StatusChip value={tool.status} />
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          <form action={auditAction}>
            <input type="hidden" name="targetType" value="TOOL" />
            <input type="hidden" name="targetId" value={tool.id} />
            <button
              type="submit"
              disabled={auditPending}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {auditPending ? "Auditing..." : "Run Audit"}
            </button>
          </form>
          {tool.status !== "BORROWED" && (
            <>
              <form action={statusAction}>
                <input type="hidden" name="toolId" value={tool.id} />
                <input type="hidden" name="status" value="AVAILABLE" />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Set Available
                </button>
              </form>
              <form action={statusAction}>
                <input type="hidden" name="toolId" value={tool.id} />
                <input type="hidden" name="status" value="MAINTENANCE" />
                <button
                  type="submit"
                  disabled={statusPending}
                  className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lock for Maintenance
                </button>
              </form>
            </>
          )}
        </div>

        {audit && (
          <AuditResultPanel
            audit={audit}
            targetType="TOOL"
            targetId={tool.id}
            applyState={applyState}
            applyAction={applyAction}
            applyPending={applyPending}
          />
        )}
      </div>
    );
  };

  const renderSkillCard = (skill: SkillRow) => {
    const key = `SKILL:${skill.id}`;
    const audit = auditResults[key];
    return (
      <div key={skill.id} className="bg-[#0a0a0a] border border-zinc-800 p-5 transition-colors hover:border-zinc-600">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Link href={`/skills/${skill.id}`} className="font-semibold text-white hover:text-purple-400 transition-colors">
              {skill.name}
            </Link>
            <p className="font-mono text-[11px] text-zinc-500 mt-1">
              {skill.category} · PROVIDER: <span className="text-zinc-300">{skill.owner.alias}</span> · TRUST:{" "}
              {skill.owner.trustScore}
            </p>
          </div>
          <StatusChip value={skill.available ? "OFFERED" : "PAUSED"} />
        </div>

        <div className="mt-4">
          <form action={auditAction}>
            <input type="hidden" name="targetType" value="SKILL" />
            <input type="hidden" name="targetId" value={skill.id} />
            <button
              type="submit"
              disabled={auditPending}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-purple-500/60 text-purple-400 hover:bg-purple-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {auditPending ? "Auditing..." : "Run Audit"}
            </button>
          </form>
        </div>

        {audit && (
          <AuditResultPanel
            audit={audit}
            targetType="SKILL"
            targetId={skill.id}
            applyState={applyState}
            applyAction={applyAction}
            applyPending={applyPending}
          />
        )}
      </div>
    );
  };

  const renderToolCall = (tc: AgentToolCallRecord, index: number) => {
    const statusVariant =
      tc.status === "EXECUTED" ? "green" : tc.status === "PENDING_APPROVAL" ? "red" : tc.status === "FAILED" ? "amber" : "red";
    return (
      <div key={index} className="border border-zinc-800 bg-black p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-cyan-400">TOOL_CALL: {tc.name}</span>
          <span className={chip(statusVariant)}>{tc.status}</span>
        </div>
        <pre className="font-mono text-[10px] text-zinc-500 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
          {JSON.stringify(tc.args, null, 2)}
        </pre>
        {tc.result !== undefined && tc.result !== null && (
          <pre className="font-mono text-[10px] text-emerald-400/80 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
            {JSON.stringify(tc.result, null, 2)}
          </pre>
        )}
        {tc.error && <p className="font-mono text-[10px] text-red-400">{tc.error}</p>}
        {tc.status === "PENDING_APPROVAL" && (
          <p className="font-mono text-[10px] text-red-400">
            GUARDRAIL: intercepted — awaiting human approval in the guardrail queue.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2">
            ADMIN // COMMAND CONSOLE
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
            Fleet telemetry, operations, and member governance.
          </h1>
        </div>
        <span className={`self-start ${chip("red")} px-3 py-1`}>
          <Shield className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />
          ADMIN
        </span>
      </section>

      {/* Telemetry */}
      <section aria-label="Fleet telemetry">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-[#0a0a0a] border border-zinc-800 p-5">
              <p className={`font-mono text-3xl font-bold ${card.accent}`}>{card.value}</p>
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mt-2">{card.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            AVAILABLE: <span className="text-emerald-400">{stats.availableTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            BORROWED: <span className="text-red-400">{stats.borrowedTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            MAINTENANCE: <span className="text-amber-400">{stats.maintenanceTools}</span>
          </span>
          <span className="px-3 py-2 border border-zinc-800 font-mono text-[11px] text-zinc-500">
            MEMBERS: <span className="text-cyan-400">{stats.totalMembers}</span>
          </span>
        </div>
      </section>

      {/* Action feedback */}
      {(moderationError || moderationSuccess) && (
        <div
          role="status"
          className={`px-4 py-3 border font-mono text-xs ${
            moderationError
              ? "border-red-500/50 text-red-400 bg-red-500/5"
              : "border-emerald-500/50 text-emerald-400 bg-emerald-500/5"
          }`}
        >
          {moderationError || "Action applied successfully."}
        </div>
      )}
      {auditState?.error && (
        <div role="status" className="px-4 py-3 border border-red-500/50 text-red-400 bg-red-500/5 font-mono text-xs">
          Audit failed: {auditState.error}
        </div>
      )}

      {/* AUTOMATION CONFIGURATION */}
      <section aria-label="Automation configuration">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4" aria-hidden="true" />
            AUTOMATION CONFIGURATION
          </h2>
          <p className="font-mono text-[11px] text-zinc-500 mb-6">
            API key is encrypted at rest (AES-256-GCM) and never returned to the browser. No keys are hardcoded.
          </p>

          {llmConfig && (
            <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px]">
              <span className="text-zinc-500">
                SOURCE: <span className="text-zinc-300">{llmConfig.source}</span>
              </span>
              <span className="text-zinc-500">
                PROVIDER: <span className="text-zinc-300">{llmConfig.provider ?? "none"}</span>
              </span>
              <span className="text-zinc-500">
                MODEL: <span className="text-zinc-300">{llmConfig.model ?? "none"}</span>
              </span>
              <span className="text-zinc-500">
                KEY:{" "}
                {llmConfig.hasApiKey ? (
                  <span className="text-emerald-400">{llmConfig.keyHint ?? "configured"}</span>
                ) : (
                  <span className="text-zinc-600">not set</span>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="automation-provider" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                Provider
              </label>
              <select
                id="automation-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="automation-model" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                Model
              </label>
              <input
                id="automation-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                list="automation-model-suggestions"
                placeholder="e.g. z-ai/glm-5.3, deepseek-chat"
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
              <datalist id="automation-model-suggestions">
                {modelSuggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="automation-baseurl" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                Base URL {provider === "CUSTOM" ? "(required)" : "(optional override)"}
              </label>
              <input
                id="automation-baseurl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://openrouter.ai/api/v1/chat/completions"
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="automation-apikey" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">
                API Key {llmConfig?.hasApiKey ? `(configured: ${llmConfig.keyHint ?? "••••"} — leave blank to keep)` : "(masked input)"}
              </label>
              <input
                id="automation-apikey"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={llmConfig?.hasApiKey ? "••••••••••••" : "sk-..."}
                autoComplete="off"
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3 flex-wrap items-center">
            <button
              type="button"
              onClick={() => saveConfig(false)}
              disabled={cfgSaving || !provider || model.trim().length === 0}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {cfgSaving ? "Saving..." : "Save Configuration"}
            </button>
            {llmConfig?.hasApiKey && (
              <button
                type="button"
                onClick={() => saveConfig(true)}
                disabled={cfgSaving}
                className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear Key
              </button>
            )}
            {selectedProvider?.requiresKey && !llmConfig?.hasApiKey && apiKeyInput.length === 0 && (
              <span className="font-mono text-[11px] text-amber-400">
                {selectedProvider.label} requires an API key.
              </span>
            )}
          </div>
          {cfgMsg && (
            <p
              role="status"
              className={`mt-4 px-4 py-3 border font-mono text-xs ${
                cfgMsg.ok
                  ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/5"
                  : "border-red-500/50 text-red-400 bg-red-500/5"
              }`}
            >
              {cfgMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* OPERATIONS CONSOLE */}
      <section aria-label="Operations console">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2 mb-1">
            <Terminal className="w-4 h-4" aria-hidden="true" />
            OPERATIONS CONSOLE
          </h2>
          <p className="font-mono text-[11px] text-zinc-500 mb-4">
            Automated operations with tool calling. Destructive calls are guardrail-intercepted and
            require human approval below.
          </p>

          {!llmConfig?.configured && (
            <p className="mb-4 px-4 py-3 border border-amber-500/50 text-amber-400 bg-amber-500/5 font-mono text-xs">
              NOT CONFIGURED — set a provider and model in AUTOMATION CONFIGURATION above to activate.
            </p>
          )}

          <div
            className="border border-zinc-800 bg-black p-4 h-80 overflow-y-auto space-y-3"
            role="log"
            aria-live="polite"
            aria-label="Operations conversation log"
          >
            {chatLog.length === 0 && (
              <p className="font-mono text-[11px] text-zinc-600">
                STANDBY. Issue an operational directive — e.g. &quot;query available tools&quot;, &quot;set tool
                X to maintenance&quot;, &quot;summarize open help tickets&quot;.
              </p>
            )}
            {chatLog.map((entry, i) => (
              <div key={i} className="space-y-2">
                <p className={entry.role === "user" ? "font-mono text-xs text-cyan-400" : "font-mono text-xs text-zinc-200"}>
                  {entry.role === "user" ? `> ${entry.content}` : entry.content}
                </p>
                {entry.toolCalls && entry.toolCalls.length > 0 && (
                  <div className="space-y-2 pl-4 border-l border-zinc-800">
                    {entry.toolCalls.map((tc, j) => renderToolCall(tc, j))}
                  </div>
                )}
              </div>
            ))}
            {chatting && <p className="font-mono text-[11px] text-zinc-600">WORKING...</p>}
          </div>

          <form
            className="mt-4 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
          >
            <label htmlFor="operations-input" className="sr-only">
              Operations directive
            </label>
            <input
              id="operations-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Enter directive..."
              maxLength={4000}
              className="flex-1 bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={chatting || chatInput.trim().length === 0}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
          {chatError && (
            <p role="status" className="mt-3 font-mono text-[11px] text-red-400">
              {chatError}
            </p>
          )}
        </div>
      </section>

      {/* GUARDRAIL QUEUE */}
      <section aria-label="Guardrail queue">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400 flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            GUARDRAIL QUEUE — DESTRUCTIVE ACTIONS
          </h2>
          <p className="font-mono text-[11px] text-zinc-500 mb-4">
            Every destructive automated call (ban, delete, purge) is intercepted here. Nothing executes until a human
            approves it.
          </p>

          {guardrailMsg && (
            <p
              role="status"
              className="mb-4 px-4 py-3 border border-zinc-800 font-mono text-xs text-zinc-300"
            >
              {guardrailMsg}
            </p>
          )}

          {pendingActions.length === 0 ? (
            <p className="font-mono text-[11px] text-zinc-600">No pending destructive actions.</p>
          ) : (
            <div className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.id} className="border border-red-500/40 bg-red-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs text-red-400">{action.toolName}</span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      QUEUED: {formatTime(action.createdAt)}
                    </span>
                  </div>
                  <pre className="font-mono text-[10px] text-zinc-400 whitespace-pre-wrap break-all">
                    {JSON.stringify(JSON.parse(action.argsJson), null, 2)}
                  </pre>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => decideAction(action.id, true)}
                      disabled={decidingId === action.id}
                      className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {decidingId === action.id ? "..." : "Approve & Execute"}
                    </button>
                    <button
                      type="button"
                      onClick={() => decideAction(action.id, false)}
                      disabled={decidingId === action.id}
                      className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentActions.length > 0 && (
            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">RECENT DECISIONS</p>
              <ul className="space-y-1">
                {recentActions.map((action) => (
                  <li key={action.id} className="font-mono text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                    <StatusChip value={action.status} />
                    <span className="text-zinc-300">{action.toolName}</span>
                    <span>{formatTime(action.decidedAt)}</span>
                    {action.error && <span className="text-red-400">{action.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* HELP QUEUE */}
      <section aria-label="Help request queue">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2 mb-1">
            <LifeBuoy className="w-4 h-4" aria-hidden="true" />
            HELP QUEUE — TRIAGE OUTCOMES
          </h2>
          <p className="font-mono text-[11px] text-zinc-500 mb-4">
            Requests are triaged automatically and routed here when human judgment is needed.
          </p>

          {(resolveState?.error || escalateState?.error) && (
            <p role="status" className="mb-4 px-4 py-3 border border-red-500/50 text-red-400 bg-red-500/5 font-mono text-xs">
              {resolveState?.error || escalateState?.error}
            </p>
          )}
          {(resolveState?.success || escalateState?.success) && (
            <p role="status" className="mb-4 px-4 py-3 border border-emerald-500/50 text-emerald-400 bg-emerald-500/5 font-mono text-xs">
              Help queue updated.
            </p>
          )}

          {openHelp.length === 0 ? (
            <p className="font-mono text-[11px] text-zinc-600">No open help requests.</p>
          ) : (
            <div className="space-y-4">
              {openHelp.map((request) => (
                <div key={request.id} className="border border-zinc-800 bg-black p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-zinc-500">TICKET {request.id.slice(0, 10)}</span>
                    <StatusChip value={request.category} />
                    <StatusChip value={request.route} />
                    <StatusChip value={request.urgency} />
                    <StatusChip value={request.status} />
                    <span className="font-mono text-[10px] text-zinc-600">
                      CONF {Math.round(request.confidence * 100)}% · {formatTime(request.createdAt)}
                      {request.alias ? ` · ${request.alias}` : " · guest"}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-600">{request.triageReason}</p>
                  <p className="text-sm text-zinc-300">{request.message}</p>
                  {request.resolution && (
                    <p className="font-mono text-[11px] text-emerald-400 border-l-2 border-emerald-500/50 pl-3">
                      {request.resolution}
                    </p>
                  )}
                  {request.status !== "RESOLVED" && (
                    <div className="space-y-3">
                      <form action={resolveAction} className="space-y-2">
                        <input type="hidden" name="requestId" value={request.id} />
                        <label htmlFor={`resolution-${request.id}`} className="sr-only">
                          Resolution for ticket {request.id}
                        </label>
                        <textarea
                          id={`resolution-${request.id}`}
                          name="resolution"
                          rows={2}
                          maxLength={2000}
                          required
                          placeholder="Resolution note (min 10 chars)..."
                          className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
                        />
                        <button
                          type="submit"
                          disabled={resolvePending}
                          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {resolvePending ? "..." : "Resolve"}
                        </button>
                      </form>
                      <form action={escalateAction}>
                        <input type="hidden" name="requestId" value={request.id} />
                        <button
                          type="submit"
                          disabled={escalatePending}
                          className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {escalatePending ? "..." : "Escalate to Human"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {closedHelp.length > 0 && (
            <div className="mt-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2">CLOSED TICKETS</p>
              <ul className="space-y-1">
                {closedHelp.map((request) => (
                  <li key={request.id} className="font-mono text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
                    <StatusChip value={request.status} />
                    <span className="text-zinc-400">{request.category}</span>
                    <span>{request.id.slice(0, 10)}</span>
                    <span>{formatTime(request.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Free-form prompt audit */}
      <section aria-label="Prompt audit">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2 mb-4">
            <ScanSearch className="w-4 h-4" aria-hidden="true" />
            LISTING AUDIT — FREE-FORM PROMPT
          </h2>
          <form action={auditAction} className="space-y-4">
            <input type="hidden" name="targetType" value="PROMPT" />
            <label htmlFor="prompt" className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Ask the audit service to evaluate a policy question or listing snippet
            </label>
            <textarea
              id="prompt"
              name="prompt"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Audit this description: 'Cordless drill, 18V, includes two batteries...'"
              className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={auditPending || promptText.trim().length === 0}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {auditPending ? "Running..." : "Run Audit"}
            </button>
          </form>
          {promptAudit && (
            <div className="mt-4 border border-zinc-800 bg-black p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <DecisionBadge decision={promptAudit.decision} />
                <span className="font-mono text-[11px] text-zinc-500">
                  CONFIDENCE: <span className="text-cyan-400">{Math.round(promptAudit.confidenceScore * 100)}%</span>
                </span>
              </div>
              <p className="text-sm text-zinc-300">{promptAudit.auditSummary}</p>
              {promptAudit.suggestedCategory && (
                <p className="font-mono text-[11px] text-zinc-500">
                  SUGGESTED CATEGORY: <span className="text-purple-400">{promptAudit.suggestedCategory}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Audit Queue — Tools */}
      <section aria-label="Tool audit queue">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-6">
          TOOL AUDIT QUEUE ({auditTools.length})
        </h2>
        {auditTools.length === 0 ? (
          <div className="py-10 bg-[#0a0a0a] border border-zinc-800 text-center">
            <p className="font-mono text-[11px] text-zinc-600">No tool listings to audit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auditTools.map(renderToolCard)}
          </div>
        )}
      </section>

      {/* Audit Queue — Skills */}
      <section aria-label="Skill audit queue">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-purple-400 mb-6">
          SKILL AUDIT QUEUE ({auditSkills.length})
        </h2>
        {auditSkills.length === 0 ? (
          <div className="py-10 bg-[#0a0a0a] border border-zinc-800 text-center">
            <p className="font-mono text-[11px] text-zinc-600">No skill listings to audit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {auditSkills.map(renderSkillCard)}
          </div>
        )}
      </section>

      {/* User Management */}
      <section aria-label="User role and trust score management">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400 mb-6">
          MEMBER GOVERNANCE ({users.length})
        </h2>
        <div className="bg-[#0a0a0a] border border-zinc-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Member</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Handle</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Joined</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Trust</th>
                <th scope="col" className="px-6 py-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-white font-medium">{user.alias}</span>
                    {user.banned && (
                      <span className={`ml-2 ${chip("red")}`}>BANNED</span>
                    )}
                    {user.id === currentUserId && (
                      <span className={`ml-2 ${chip("cyan")}`}>you</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">@{user.username}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-zinc-500">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono font-semibold ${
                          user.trustScore >= 90
                            ? "text-emerald-400"
                            : user.trustScore >= 60
                              ? "text-cyan-400"
                              : "text-red-400"
                        }`}
                      >
                        {user.trustScore}
                      </span>
                      <form action={trustAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="-5" />
                        <button
                          type="submit"
                          disabled={trustPending}
                          aria-label={`Decrease trust score for ${user.alias} by 5`}
                          className="w-7 h-7 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                      <form action={trustAction}>
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="delta" value="5" />
                        <button
                          type="submit"
                          disabled={trustPending}
                          aria-label={`Increase trust score for ${user.alias} by 5`}
                          className="w-7 h-7 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.id === currentUserId ? (
                      <span className={chip("red")}>{user.role}</span>
                    ) : (
                      <form action={roleAction} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <label htmlFor={`role-${user.id}`} className="sr-only">
                          Role for {user.alias}
                        </label>
                        <select
                          id={`role-${user.id}`}
                          name="role"
                          defaultValue={user.role}
                          className="bg-black border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none cursor-pointer"
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <button
                          type="submit"
                          disabled={rolePending}
                          className="font-mono text-xs uppercase tracking-widest px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:border-cyan-500/60 hover:text-cyan-400 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" aria-hidden="true" />
                          Save
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
