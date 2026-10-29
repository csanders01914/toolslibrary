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

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Pending-activity counts served by GET /api/notifications. Every field is a
 * queue the member can act on from the dashboard or the messenger.
 */
export interface NotificationCounts {
  unreadMessages: number;
  incomingRequests: number;
  awaitingPickup: number;
  awaitingReturn: number;
  awaitingVouch: number;
}

/** Broadcast with fresh counts after every successful poll (detail = counts). */
export const NOTIFICATION_COUNTS_EVENT = "toolslibrary:notifications:counts";

/** Ping to request an immediate re-poll (fired after read/send mutations). */
export const NOTIFICATION_REFRESH_EVENT = "toolslibrary:notifications:refresh";

const POLL_INTERVAL_MS = 30_000;

interface ActivityRow {
  key: keyof NotificationCounts;
  href: string;
  label: string;
  plural: string;
  Icon: LucideIcon;
  tone: string;
}

const ACTIVITY_ROWS: ActivityRow[] = [
  {
    key: "incomingRequests",
    href: "/dashboard",
    label: "pending tool request",
    plural: "pending tool requests",
    Icon: Wrench,
    tone: "text-amber-400",
  },
  {
    key: "awaitingPickup",
    href: "/dashboard",
    label: "tool pickup to confirm",
    plural: "tool pickups to confirm",
    Icon: Truck,
    tone: "text-amber-400",
  },
  {
    key: "awaitingReturn",
    href: "/dashboard",
    label: "loan return to mark",
    plural: "loan returns to mark",
    Icon: RotateCcw,
    tone: "text-amber-400",
  },
  {
    key: "unreadMessages",
    href: "/messages",
    label: "unread message",
    plural: "unread messages",
    Icon: MessageSquare,
    tone: "text-emerald-400",
  },
  {
    key: "awaitingVouch",
    href: "/dashboard",
    label: "vouch waiting",
    plural: "vouches waiting",
    Icon: ShieldCheck,
    tone: "text-cyan-400",
  },
];

/**
 * Navbar notification indicator: a bell with a total-pending badge that opens
 * a breakdown of every pending queue (tool requests, pickups, returns,
 * unread messages, vouches), each row linking to the surface that resolves
 * it. Polls the counts endpoint on mount, on navigation, on tab focus, on a
 * 30s interval, and on the shared refresh event the messenger fires after
 * read/send mutations.
 */
export function NotificationBell() {
  const { status } = useSession();
  const pathname = usePathname();
  const [counts, setCounts] = useState<NotificationCounts | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (data?.counts) {
        setCounts(data.counts);
        window.dispatchEvent(
          new CustomEvent<NotificationCounts>(NOTIFICATION_COUNTS_EVENT, { detail: data.counts })
        );
      }
    } catch {
      // Transient network failure: keep the last known counts; the next
      // poll, navigation, or focus event will catch up.
    }
  }, []);

  const total = counts
    ? counts.unreadMessages +
      counts.incomingRequests +
      counts.awaitingPickup +
      counts.awaitingReturn +
      counts.awaitingVouch
    : 0;

  // Initial load + re-fetch after every navigation: acting on a queue item
  // (approve, confirm pickup, read a thread) clears its indicator at once.
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchCounts();
  }, [status, pathname, fetchCounts]);

  // Steady-state polling + mutation-driven refresh pings.
  useEffect(() => {
    if (status !== "authenticated") return;
    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);
    const onRefresh = () => fetchCounts();
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIFICATION_REFRESH_EVENT, onRefresh);
    };
  }, [status, fetchCounts]);

  // Catch up when the tab becomes visible again (laptop sleep, phone switch).
  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchCounts();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, fetchCounts]);

  // Dismiss on Escape or any pointer press outside the bell.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={total > 0 ? `Notifications: ${total} pending` : "Notifications: all clear"}
        className="relative flex cursor-pointer items-center justify-center border border-zinc-800 px-2 py-1.5 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {total > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 min-w-[18px] bg-red-500 px-1 py-px text-center font-mono text-[10px] font-bold leading-none text-black"
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Pending activity"
          className="absolute right-0 top-full z-50 mt-2 w-72 border border-zinc-800 bg-black shadow-xl"
        >
          <p className="border-b border-zinc-800 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            PENDING ACTIVITY
          </p>
          {total === 0 || !counts ? (
            <p className="px-3 py-3 font-mono text-[11px] leading-relaxed text-zinc-500">
              ALL CLEAR — nothing is waiting on you right now.
            </p>
          ) : (
            <ul>
              {ACTIVITY_ROWS.filter((row) => counts[row.key] > 0).map((row) => {
                const count = counts[row.key];
                return (
                  <li key={row.key}>
                    <Link
                      href={row.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-zinc-900/60"
                    >
                      <row.Icon className={`h-3.5 w-3.5 shrink-0 ${row.tone}`} aria-hidden="true" />
                      <span className={`font-mono text-[11px] ${row.tone}`}>{count}</span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {count === 1 ? row.label : row.plural}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
