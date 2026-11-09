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

/**
 * Next.js instrumentation hook.
 *
 * Runs once when a new server instance boots. In the Node.js runtime it
 * starts the deterministic Matrix long-polling listener so the community
 * chat server and the website share one support pipeline, and drains the
 * durable file-purge queue (Stage 6 of the KILO auth/security plan): any
 * deletion whose post-commit unlink failed outlives the process in
 * PendingFileDeletion and is retried here, idempotently, until the bytes
 * are actually gone.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMatrixBotListener } = await import("./lib/matrixListener");
    startMatrixBotListener();

    const { drainPendingFileDeletions } = await import("./lib/uploads");
    // Fire-and-forget with a logged failure: the boot must not block on
    // disk I/O, and a failed sweep leaves the records for the next boot —
    // nothing is silently lost.
    drainPendingFileDeletions().catch((error) => {
      console.error("[file-purge] boot sweep failed:", error);
    });
  }
}
