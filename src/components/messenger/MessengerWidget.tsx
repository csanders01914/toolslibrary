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
import { useSession } from "next-auth/react";
import { ChevronLeft, MessageSquare, Send, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  NOTIFICATION_COUNTS_EVENT,
  NOTIFICATION_REFRESH_EVENT,
  type NotificationCounts,
} from "@/components/layout/NotificationBell";

interface Thread {
  partnerId: string;
  partnerAlias: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface WidgetMessage {
  id: string;
  content: string;
  fromId: string;
  toId: string;
  read: boolean;
  createdAt: string;
  sender: { id: string; alias: string };
  receiver: { id: string; alias: string };
}

interface ActiveThread {
  partnerId: string;
  partnerAlias: string;
}

// Live-tail cadence for the open channel: keeps the popup chat current
// without any persistent connection (ephemeral, poll-based, zero-PII).
const CHAT_POLL_INTERVAL_MS = 5000;

/**
 * Popup messenger. Two in-widget views:
 * - Channel list: one row per conversation partner; selecting a row opens
 *   the conversation INSIDE the popup instead of navigating away.
 * - Channel view: the full chat box — history, live-tail polling, composer
 *   (Enter sends, Shift+Enter newline) — with a back button to the list and
 *   a footer link that hands off to the full messenger console.
 * The launcher button carries an unread badge driven by the navbar bell's
 * shared notification poll (single endpoint for the whole surface).
 */
export function MessengerWidget() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [unreadBadge, setUnreadBadge] = useState(0);

  // Which channel the in-flight/next fetch belongs to — guards against a
  // slow response for a previously open thread overwriting the current one.
  const activePartnerRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const loadMessages = useCallback(
    async (partnerId: string, silent: boolean) => {
      if (!silent) {
        setLoadingMessages(true);
        setLoadError(false);
      }
      try {
        const res = await fetch(`/api/messages?partnerId=${encodeURIComponent(partnerId)}`);
        if (!res.ok) {
          throw new Error("Failed to load messages");
        }
        const data = await res.json();
        const fetched: WidgetMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (activePartnerRef.current === partnerId) {
          setMessages(fetched);
          // Opening or tailing a channel implies the member has seen it:
          // mark unread incoming messages read and refresh the indicators.
          if (fetched.some((m) => m.toId === session?.user?.id && !m.read)) {
            await fetch("/api/messages/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ partnerId }),
            });
            setThreads((prev) =>
              prev.map((t) => (t.partnerId === partnerId ? { ...t, unreadCount: 0 } : t))
            );
            window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
          }
        }
      } catch {
        // Silent polls keep the last good history; only the initial load
        // surfaces an error state.
        if (activePartnerRef.current === partnerId && !silent) {
          setLoadError(true);
        }
      } finally {
        if (activePartnerRef.current === partnerId && !silent) {
          setLoadingMessages(false);
        }
      }
    },
    [session?.user?.id]
  );

  // Launcher unread badge: driven by the navbar bell's shared poll so the
  // whole notification surface hits the counts endpoint once.
  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    const onCounts = (event: Event) => {
      const detail = (event as CustomEvent<NotificationCounts>).detail;
      if (detail && typeof detail.unreadMessages === "number") {
        setUnreadBadge(detail.unreadMessages);
      }
    };
    window.addEventListener(NOTIFICATION_COUNTS_EVENT, onCounts);
    return () => window.removeEventListener(NOTIFICATION_COUNTS_EVENT, onCounts);
  }, [status]);

  useEffect(() => {
    if (!open) {
      // Reset transient chat state so reopening lands on the channel list.
      activePartnerRef.current = null;
      setActiveThread(null);
      setMessages([]);
      setDraft("");
      setSendError(null);
      setLoadError(false);
      return;
    }
    loadThreads();
  }, [open, loadThreads]);

  // Live tail: poll the open channel so the popup chat stays current.
  useEffect(() => {
    if (!open || !activeThread) {
      return;
    }
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadMessages(activeThread.partnerId, true);
      }
    }, CHAT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, activeThread, loadMessages]);

  // Auto-scroll the channel view: always on first history load or when the
  // member is already near the bottom; never yank the view while they are
  // reading further up the history when a polled message arrives.
  useEffect(() => {
    const container = scrollContainerRef.current;
    const firstLoad = messages.length > 0 && lastMessageCountRef.current === 0;
    lastMessageCountRef.current = messages.length;
    const nearBottom =
      !container || container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    if (firstLoad || nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, activeThread]);

  // Focus the composer once the channel (and its history) is on screen.
  useEffect(() => {
    if (open && activeThread && !loadingMessages) {
      inputRef.current?.focus();
    }
  }, [open, activeThread, loadingMessages]);

  const openThread = async (thread: Thread) => {
    activePartnerRef.current = thread.partnerId;
    setActiveThread({ partnerId: thread.partnerId, partnerAlias: thread.partnerAlias });
    setMessages([]);
    setDraft("");
    setSendError(null);
    setLoadError(false);
    if (thread.unreadCount > 0) {
      setThreads((prev) =>
        prev.map((t) => (t.partnerId === thread.partnerId ? { ...t, unreadCount: 0 } : t))
      );
    }
    await loadMessages(thread.partnerId, false);
  };

  const closeThread = () => {
    activePartnerRef.current = null;
    setActiveThread(null);
    setMessages([]);
    setDraft("");
    setSendError(null);
    setLoadError(false);
    loadThreads();
  };

  const submitMessage = async () => {
    const content = draft.trim();
    if (!content || !activeThread || sending) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: activeThread.partnerId, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data?.error || "Failed to send message");
        return;
      }
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
      setThreads((prev) =>
        prev.map((t) =>
          t.partnerId === activeThread.partnerId
            ? { ...t, lastMessage: data.message.content, lastMessageAt: data.message.createdAt }
            : t
        )
      );
    } catch {
      setSendError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Inside a channel, Escape steps back to the channel list first.
        if (activeThread) {
          closeThread();
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeThread]);

  if (status === "loading" || !session) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 font-mono text-xs uppercase tracking-widest px-4 py-2 border border-emerald-500/60 text-emerald-400 bg-black hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors cursor-pointer flex items-center gap-2"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label={
          unreadBadge > 0 ? `Messenger: ${unreadBadge} unread messages` : "Open messenger"
        }
      >
        <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
        MESSENGER
        {unreadBadge > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-2 -right-2 min-w-[18px] bg-red-500 px-1 py-px text-center font-mono text-[10px] font-bold leading-none text-black"
          >
            {unreadBadge > 9 ? "9+" : unreadBadge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ephemeral messenger"
      className="fixed bottom-6 left-6 z-50 w-[calc(100vw-3rem)] max-w-[380px] h-[min(420px,calc(100dvh-9rem))] bg-black border border-emerald-500/40 rounded-none flex flex-col"
    >
      <div className="bg-[#0a0a0a] border-b border-emerald-500/30 px-3 py-2 flex items-center justify-between gap-2">
        {activeThread ? (
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={closeThread}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-white active:text-white transition-colors cursor-pointer"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="font-mono text-xs text-zinc-200 truncate">
              {activeThread.partnerAlias}
            </span>
          </div>
        ) : (
          <span className="font-mono text-xs text-emerald-400 tracking-widest">
            EPHEMERAL MESSENGER
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-500 hover:text-white active:text-white transition-colors cursor-pointer"
          aria-label="Close messenger"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {activeThread ? (
        <>
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-2"
            role="log"
            aria-live="polite"
            aria-label={`Messages with ${activeThread.partnerAlias}`}
          >
            {loadingMessages ? (
              <p className="font-mono text-[11px] text-zinc-500">LOADING CHANNEL...</p>
            ) : loadError ? (
              <p className="font-mono text-[11px] text-red-400">FAILED TO LOAD MESSAGES.</p>
            ) : messages.length === 0 ? (
              <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">
                NO MESSAGES YET. Say hello — conversations linked to a loan are purged the moment
                the tool is returned.
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.fromId === session.user.id;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] border p-2 font-mono text-[11px] ${
                        isOwn
                          ? "border-cyan-500/30 bg-cyan-500/5 text-zinc-100"
                          : "border-zinc-800 bg-[#0a0a0a] text-zinc-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <time
                        className="mt-1 block text-right font-mono text-[9px] text-zinc-600"
                        dateTime={new Date(msg.createdAt).toISOString()}
                      >
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </time>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {sendError && (
            <p className="px-3 pb-1 font-mono text-[10px] text-red-400" role="alert">
              {sendError}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMessage();
            }}
            className="border-t border-zinc-900 p-2 flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              maxLength={1000}
              aria-label="Message"
              disabled={sending}
              className="flex-1 resize-none rounded-none border border-zinc-800 bg-black px-2 py-2 font-mono text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="flex shrink-0 cursor-pointer items-center justify-center border border-cyan-500/60 px-3 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </form>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="font-mono text-[11px] text-zinc-500 p-4">LOADING CHANNELS...</p>
          ) : error ? (
            <p className="font-mono text-[11px] text-red-400 p-4">FAILED TO LOAD THREADS. TRY AGAIN.</p>
          ) : threads.length === 0 ? (
            <p className="font-mono text-[11px] text-zinc-500 leading-relaxed p-4">
              NO ACTIVE THREADS. Request a tool, book a skill session, or message a neighbor to open a
              channel. Conversations linked to a loan are purged the moment the tool is returned.
            </p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.partnerId}
                type="button"
                onClick={() => openThread(thread)}
                className="block w-full text-left border-b border-zinc-900 px-3 py-2 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                aria-label={`Open conversation with ${thread.partnerAlias}${
                  thread.unreadCount > 0 ? `, ${thread.unreadCount} unread` : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-200 truncate">{thread.partnerAlias}</span>
                  {thread.unreadCount > 0 && (
                    <span className="font-mono text-[10px] text-emerald-400">{thread.unreadCount}</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{thread.lastMessage}</p>
              </button>
            ))
          )}
        </div>
      )}

      <Link
        href={activeThread ? `/messages?to=${activeThread.partnerId}` : "/messages"}
        onClick={() => setOpen(false)}
        className="font-mono text-[11px] text-cyan-400 hover:text-cyan-300 px-3 py-2 border-t border-zinc-900 block transition-colors"
      >
        OPEN FULL CONSOLE →
      </Link>
    </div>
  );
}
