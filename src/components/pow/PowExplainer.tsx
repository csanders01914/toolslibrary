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

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * "What's this?" explainer for the proof-of-work gate, shared by the
 * register, chat, and help surfaces. Renders an inline text-link trigger
 * that opens an accessible modal dialog explaining what a proof-of-work
 * hash is, what it is for, and how it is implemented underneath the login
 * (account creation) and chat portal.
 *
 * Accessibility: the dialog is announced via role="dialog" + aria-modal,
 * focus moves into it on open and returns to the trigger on close, Escape
 * closes it, the backdrop click closes it, and Tab is trapped inside the
 * panel so keyboard focus can never escape behind the overlay.
 */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function PowExplainerLink() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus into the dialog as soon as it opens.
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      // Focus trap: cycle Tab/Shift+Tab within the dialog panel.
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the trigger when the dialog closes.
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="inline cursor-pointer font-mono text-zinc-500 underline underline-offset-2 transition-colors hover:text-cyan-400 focus-visible:text-cyan-400 focus-visible:outline-none"
      >
        What&apos;s this?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pow-explainer-title"
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-none border border-zinc-700 bg-[#0a0a0a] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2
                id="pow-explainer-title"
                className="font-mono text-sm uppercase tracking-widest text-zinc-200"
              >
                Proof of work, explained
              </h2>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setOpen(false)}
                aria-label="Close explanation"
                className="shrink-0 cursor-pointer p-1 text-zinc-500 transition-colors hover:text-white focus-visible:text-white focus-visible:outline-none"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono text-xs leading-relaxed text-zinc-400">
              <section>
                <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-200">
                  What it is
                </h3>
                <p className="mt-1">
                  A proof-of-work hash is a small computational puzzle the
                  browser solves before a protected action is accepted. The
                  server picks a random nonce and a difficulty (leading zero
                  bits); the browser hashes{" "}
                  <code className="text-cyan-400">nonce:counter</code> with
                  SHA-256 for counter = 0, 1, 2, … until a hash starts with
                  that many zero bits, then returns the winning counter.
                  Finding it takes real work (~2^difficulty hashes on
                  average); verifying takes the server one hash.
                </p>
              </section>

              <section>
                <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-200">
                  What it&apos;s for
                </h3>
                <p className="mt-1">
                  It makes abuse expensive and humans barely notice — spam and
                  brute-force scripts pay the same compute cost per attempt at
                  scale. Difficulty rises automatically (16→24 bits) when
                  traffic from a connection looks abusive (high volume or
                  repeated failures within 15 minutes). It replaces
                  third-party CAPTCHAs — no external service, no tracking,
                  nothing to solve by hand.
                </p>
              </section>

              <section>
                <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-200">
                  How it&apos;s implemented underneath the login and chat portal
                </h3>
                <p className="mt-1">
                  The server issues a signed challenge (base64url payload +
                  HMAC-SHA256 signature from a per-process random key; expiry
                  10–30 min depending on difficulty; single-use; bound to an
                  anonymous salted hash of your connection, never persisted).
                  The browser solves it with the Web Crypto API. On submit the
                  server checks the signature and client binding with
                  constant-time comparisons, then expiry, single use, surface,
                  and the hash — before creating your account, triaging your
                  help request, or minting a one-time chat token.
                </p>
              </section>

              <p className="border-t border-zinc-800 pt-3 text-zinc-500">
                Zero PII: the whole check is anonymous. Nothing is written to
                the database, and identifiers are hashed with a per-process
                salt that regenerates on restart.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
