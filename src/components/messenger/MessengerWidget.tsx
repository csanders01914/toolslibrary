"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MessageSquare, X } from "lucide-react";

interface Thread {
  partnerId: string;
  partnerAlias: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function MessengerWidget() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) {
        throw new Error("Failed to load threads");
      }
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    loadThreads();
  }, [open, loadThreads]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (status === "loading" || !session) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 bg-black hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center gap-2"
        aria-haspopup="dialog"
        aria-expanded={false}
      >
        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
        MESSENGER
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ephemeral messenger"
      className="fixed bottom-4 right-4 z-50 w-[320px] sm:w-[380px] h-[420px] bg-black border border-emerald-500/40 rounded-none flex flex-col"
    >
      <div className="bg-[#0a0a0a] border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between">
        <span className="font-mono text-xs text-emerald-400 tracking-widest">EPHEMERAL MESSENGER</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
          aria-label="Close messenger"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="font-mono text-[11px] text-zinc-500 p-4">LOADING CHANNELS...</p>
        ) : error ? (
          <p className="font-mono text-[11px] text-red-400 p-4">FAILED TO LOAD THREADS. TRY AGAIN.</p>
        ) : threads.length === 0 ? (
          <p className="font-mono text-[11px] text-zinc-500 leading-relaxed p-4">
            NO ACTIVE THREADS. Request a tool, book a skill session, or message a provider to open a
            channel. Conversations linked to a loan are purged the moment the tool is returned.
          </p>
        ) : (
          threads.map((thread) => (
            <Link
              key={thread.partnerId}
              href={`/messages?to=${thread.partnerId}`}
              onClick={() => setOpen(false)}
              className="block border-b border-zinc-900 px-3 py-2 hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-zinc-200 truncate">{thread.partnerAlias}</span>
                {thread.unreadCount > 0 && (
                  <span className="font-mono text-[10px] text-emerald-400">{thread.unreadCount}</span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 truncate">{thread.lastMessage}</p>
            </Link>
          ))
        )}
      </div>

      <Link
        href="/messages"
        onClick={() => setOpen(false)}
        className="font-mono text-[11px] text-cyan-400 hover:text-cyan-300 px-3 py-2 border-t border-zinc-900 block transition-colors"
      >
        OPEN FULL CONSOLE →
      </Link>
    </div>
  );
}
