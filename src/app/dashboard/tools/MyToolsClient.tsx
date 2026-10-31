/*
 * ToolsLibrary - A self-hostable, zero-PII tool library and skill-sharing platform built for local communities.
 * Copyright (C) 2026  Chris Sanders
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Package, Pencil, Trash2, X } from "lucide-react";
import { deleteTool } from "@/lib/actions/tools";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/format";

type ActionState = { success?: boolean; error?: string } | undefined;

interface ToolLoan {
  id: string;
  status: string;
  borrower: { id: string; alias: string };
}

interface ToolRow {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  imageUrl: string | null;
  createdAt: Date | string;
  loans: ToolLoan[];
}

function statusClass(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "text-emerald-400";
    case "BORROWED":
      return "text-red-400";
    case "MAINTENANCE":
      return "text-amber-400";
    default:
      return "text-zinc-400";
  }
}

const actionButton =
  "inline-flex min-h-[44px] items-center gap-2 border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * One management card per listed tool. Each card owns its delete action state
 * so pending/error feedback is scoped to the tool being deleted, mirroring
 * the per-action useActionState pattern used across the dashboard.
 */
function ToolCard({ tool }: { tool: ToolRow }) {
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteTool, undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const router = useRouter();

  // A successful delete removes the row server-side — re-fetch the listing so
  // the card disappears and the header count drops without a full navigation.
  useEffect(() => {
    if (deleteState?.success) {
      setShowDeleteModal(false);
      router.refresh();
    }
  }, [deleteState, router]);

  const pendingRequests = tool.loans.filter((loan) => loan.status === "REQUESTED").length;
  const activeLoan = tool.loans.find((loan) => loan.status === "APPROVED" || loan.status === "ACTIVE");

  return (
    <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none p-5 flex flex-col">
      <div className="flex items-start gap-4">
        {tool.imageUrl ? (
          <img
            src={`/api/uploads/${tool.imageUrl}`}
            alt=""
            className="h-14 w-14 flex-shrink-0 border border-zinc-800 object-cover"
          />
        ) : (
          <div
            className="h-14 w-14 flex-shrink-0 border border-zinc-800 bg-black flex items-center justify-center"
            aria-hidden="true"
          >
            <Package className="h-6 w-6 text-zinc-700" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-white truncate">
              <Link href={`/tools/${tool.id}`} className="hover:text-cyan-400 transition-colors">
                {tool.name}
              </Link>
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-zinc-700 text-zinc-400 whitespace-nowrap">
              {tool.category}
            </span>
          </div>
          <p className={`mt-1 font-mono text-xs uppercase tracking-widest ${statusClass(tool.status)}`}>
            {tool.status}
          </p>
        </div>
      </div>

      <div className="font-mono text-xs space-y-1 pt-3 mt-3 border-t border-zinc-900">
        <p>
          <span className="text-zinc-500">LISTED: </span>
          <span className="text-zinc-300">{formatDate(tool.createdAt)}</span>
        </p>
        <p>
          <span className="text-zinc-500">PENDING REQUESTS: </span>
          <span className={pendingRequests > 0 ? "text-cyan-400" : "text-zinc-300"}>{pendingRequests}</span>
        </p>
        {activeLoan && (
          <p>
            <span className="text-zinc-500">ON LOAN TO: </span>
            <span className="text-zinc-300">{activeLoan.borrower.alias}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 mt-auto">
        <Link href={`/tools/${tool.id}`} className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}>
          View
        </Link>
        <Link href={`/tools/${tool.id}/edit`} className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Link>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className={`${actionButton} border-red-500/60 text-red-400 hover:bg-red-500/10`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>

      {/* Delete confirmation */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} label={`Delete ${tool.name}`}>
        <form action={deleteAction} className="space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">DELETE TOOL</h3>
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              data-autofocus
              className="flex min-h-[44px] min-w-[44px] items-center justify-center p-2 text-zinc-500 hover:text-white active:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400">
            <p className="font-mono text-xs uppercase tracking-widest">THIS ACTION CANNOT BE UNDONE.</p>
            <p className="text-sm mt-2 text-zinc-400">
              <span className="font-mono text-zinc-300">{tool.name}</span> will be permanently removed along with its
              loan history. Deletion is blocked while the tool is out on an active loan.
            </p>
          </div>

          {deleteState?.error && (
            <div
              className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 font-mono text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {deleteState.error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deletePending}
              className={`${actionButton} border-red-500/60 text-red-400 hover:bg-red-500/10`}
            >
              {deletePending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              )}
              Delete Tool
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function MyToolsClient({ tools }: { tools: ToolRow[] }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            MY TOOLS // {tools.length} LISTED
          </p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold text-white tracking-tight">My Tools</h1>
          <p className="mt-2 font-mono text-xs text-zinc-500">
            Every tool you have offered to the library — add more or remove listings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className={`${actionButton} border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <Link href="/tools/new" className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10`}>
            <Package className="h-4 w-4" aria-hidden="true" />
            Add Tool
          </Link>
        </div>
      </section>

      {/* Tools grid */}
      {tools.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-none py-12 text-center">
          <Package className="h-8 w-8 text-zinc-600 mx-auto" aria-hidden="true" />
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-4">NO TOOLS LISTED</p>
          <p className="text-sm text-zinc-400 mt-2">List your first tool so neighbors can borrow it.</p>
          <Link
            href="/tools/new"
            className={`${actionButton} border-cyan-500/60 text-cyan-400 hover:bg-cyan-500/10 mt-6`}
          >
            <Package className="h-4 w-4" aria-hidden="true" />
            Add Tool
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
