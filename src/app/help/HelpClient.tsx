"use client";

import { useActionState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { submitHelpRequest, type HelpActionState } from "@/lib/actions/help";
import { HELP_CATEGORIES } from "@/lib/services/triage";

/**
 * Request Help — public triage intake.
 * Submissions run through the random forest classifier (src/lib/services/triage.ts)
 * and are routed to either the LLM agent (automated resolution) or the human
 * admin intervention queue. The verdict is rendered immediately.
 */

const CATEGORY_LABELS: Record<string, string> = {
  TOOL_ISSUE: "TOOL_ISSUE — a listing or tool problem",
  SKILL_ISSUE: "SKILL_ISSUE — a skill listing problem",
  LOAN_DISPUTE: "LOAN_DISPUTE — disagreement over a loan",
  ACCOUNT_ACCESS: "ACCOUNT_ACCESS — login or account trouble",
  SAFETY_INCIDENT: "SAFETY_INCIDENT — injury, danger, or threat",
  BUG_REPORT: "BUG_REPORT — the site misbehaves",
  GENERAL: "GENERAL — anything else",
};

const ROUTE_COPY: Record<string, { label: string; variant: string; blurb: string }> = {
  LLM_AGENT: {
    label: "ROUTED TO LLM AGENT",
    variant: "border-cyan-500/60 text-cyan-400",
    blurb:
      "The operations agent is handling this ticket with read-only and safe tools. Destructive actions it attempts are intercepted and require human approval.",
  },
  HUMAN_ADMIN: {
    label: "ROUTED TO HUMAN ADMIN QUEUE",
    variant: "border-red-500/60 text-red-400",
    blurb:
      "This request needs human judgment. An administrator will pick it up from the intervention queue.",
  },
};

const URGENCY_VARIANT: Record<string, string> = {
  CRITICAL: "border-red-500/60 text-red-400",
  HIGH: "border-amber-500/60 text-amber-400",
  MEDIUM: "border-cyan-500/60 text-cyan-400",
  LOW: "border-zinc-700 text-zinc-400",
};

export default function HelpClient({ authenticatedAlias }: { authenticatedAlias: string | null }) {
  const [state, action, pending] = useActionState<HelpActionState, FormData>(
    submitHelpRequest,
    undefined
  );

  const ticket = state?.ticket;
  const routeInfo = ticket ? ROUTE_COPY[ticket.route] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400 mb-2 flex items-center gap-2">
          <LifeBuoy className="w-4 h-4" aria-hidden="true" />
          SUPPORT // REQUEST HELP
        </p>
        <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
          Describe the problem. The triage forest decides who handles it.
        </h1>
        <p className="mt-3 text-sm text-zinc-400 max-w-2xl">
          Requests are classified by a random forest decision pipeline and routed to either the
          autonomous LLM operations agent or a human administrator. Safety incidents and disputes
          always reach a human. Zero PII required — an optional alias is enough.
        </p>
      </section>

      {/* Intake form */}
      <section aria-label="Help request form">
        <div className="bg-[#0a0a0a] border border-zinc-800 p-6">
          <form action={action} className="space-y-5">
            <div>
              <label
                htmlFor="help-category"
                className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2"
              >
                Category
              </label>
              <select
                id="help-category"
                name="category"
                required
                defaultValue="GENERAL"
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
              >
                {HELP_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category] ?? category}
                  </option>
                ))}
              </select>
            </div>

            {!authenticatedAlias && (
              <div>
                <label
                  htmlFor="help-alias"
                  className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2"
                >
                  Alias (optional — so we can reach you)
                </label>
                <input
                  id="help-alias"
                  type="text"
                  name="alias"
                  maxLength={32}
                  placeholder="how the community knows you"
                  className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="help-message"
                className="block font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-2"
              >
                What happened? (10–2000 characters)
              </label>
              <textarea
                id="help-message"
                name="message"
                rows={6}
                required
                minLength={10}
                maxLength={2000}
                placeholder="Describe the issue factually. Include tool or skill names and dates if relevant. Do not include personal contact information."
                className="w-full bg-black border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>

            {state?.error && (
              <p role="alert" className="px-4 py-3 border border-red-500/50 text-red-400 bg-red-500/5 font-mono text-xs">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              {pending ? "Triaging..." : "Submit Request"}
            </button>
          </form>
        </div>
      </section>

      {/* Triage verdict */}
      {ticket && routeInfo && (
        <section aria-label="Triage verdict" aria-live="polite">
          <div className="bg-[#0a0a0a] border border-zinc-800 p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-mono text-xs px-3 py-1 border ${routeInfo.variant}`}>
                {routeInfo.label}
              </span>
              <span className={`font-mono text-[10px] px-2 py-0.5 border ${URGENCY_VARIANT[ticket.urgency] ?? URGENCY_VARIANT.LOW}`}>
                {ticket.urgency}
              </span>
              <span className="font-mono text-[10px] text-zinc-600">
                TICKET {ticket.id.slice(0, 10)} · CONFIDENCE {Math.round(ticket.confidence * 100)}%
              </span>
            </div>

            <p className="font-mono text-[11px] text-zinc-500">{ticket.triageReason}</p>
            <p className="text-sm text-zinc-400">{routeInfo.blurb}</p>

            {ticket.resolution && (
              <div className="border-l-2 border-cyan-500/50 pl-4">
                <p className="font-mono text-[11px] uppercase tracking-widest text-cyan-400 mb-2">
                  AGENT RESPONSE
                </p>
                <p className="font-mono text-xs text-zinc-300 whitespace-pre-wrap">{ticket.resolution}</p>
              </div>
            )}

            {ticket.status === "OPEN" && (
              <p className="font-mono text-[11px] text-zinc-600">
                Ticket status: OPEN — queued for processing.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
