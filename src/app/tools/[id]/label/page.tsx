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

import { auth } from "@/auth";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import QRCode from "qrcode";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Printable QR handoff label (PHASE_24_QR_LOAN_LIFECYCLE). Owner-only. The QR
 * encodes the tool's handoff URL — a stable, per-tool address the operator
 * prints once and sticks on the tool case; scanning it during a handoff opens
 * the handoff page, which steps the current loan through its lifecycle.
 *
 * The QR SVG is generated server-side by our own process (node-qrcode) — no
 * external CDN or image service is involved, keeping the zero-external-
 * dependency invariant. The label is printed white-on-black-text so it stays
 * legible on paper.
 */
export default async function ToolLabelPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/tools/${id}/label`);
  }

  const tool = await prisma.tool.findUnique({
    where: { id },
    select: { id: true, name: true, ownerId: true },
  });
  if (!tool) {
    notFound();
  }

  if (tool.ownerId !== session.user.id && session.user.role !== "ADMIN") {
    notFound();
  }

  // Resolve the deployment origin from the request: behind a Cloudflare
  // Tunnel the Host header is the public hostname and x-forwarded-proto is
  // https; direct exposure falls back to http + the local host.
  const h = await headers();
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = h.get("host") ?? "localhost:3000";
  const handoffUrl = `${proto}://${host}/tools/${tool.id}/handoff`;

  const qrSvg = await QRCode.toString(handoffUrl, {
    type: "svg",
    margin: 1,
    width: 320,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-label, #print-label * { visibility: visible; }
          #print-label { position: absolute; inset: 0; margin: auto; }
        }
      `}</style>

      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
          QR HANDOFF LABEL
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white tracking-tight">{tool.name}</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          Print this label and stick it on the tool case. Scanning it opens the handoff page,
          which steps the loan through its lifecycle.
        </p>
      </div>

      <div
        id="print-label"
        className="border-4 border-black bg-white p-8 text-center text-black"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-black/60">
          TOOL LIBRARY // HANDOFF
        </p>
        <h2 className="mt-2 text-2xl font-bold break-words">{tool.name}</h2>
        <div
          className="mx-auto mt-6 w-[320px] max-w-full [&_svg]:h-auto [&_svg]:w-full"
          role="img"
          aria-label={`QR code linking to the handoff page for ${tool.name}`}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-black/70">
          Scan during handoff to update the loan
        </p>
        <p className="mt-2 break-all font-mono text-[10px] text-black/50">{handoffUrl}</p>
      </div>

      <PrintButton />
    </div>
  );
}
