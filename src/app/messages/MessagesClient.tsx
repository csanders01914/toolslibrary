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

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Shield, User, ChevronLeft, MoreVertical, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { NOTIFICATION_REFRESH_EVENT } from "@/components/layout/NotificationBell";

interface Conversation {
  partnerId: string;
  partnerAlias: string;
  partnerTrustScore: number;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

interface Message {
  id: string;
  content: string;
  fromId: string;
  toId: string;
  read: boolean;
  createdAt: Date;
  sender: { id: string; alias: string };
  receiver: { id: string; alias: string };
}

interface MessagesClientProps {
  initialConversations: Conversation[];
  currentUserId: string;
  unreadCount: number;
  initialPartnerId?: string | null;
}

export default function MessagesClient({ initialConversations, currentUserId, unreadCount: initialUnreadCount, initialPartnerId }: MessagesClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-select conversation from ?to= query param
  useEffect(() => {
    if (initialPartnerId && !selectedPartner) {
      const target = initialConversations.find((c) => c.partnerId === initialPartnerId);
      if (target) {
        handleSelectConversation(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPartnerId]);

  const fetchMessages = async (partnerId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages?partnerId=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedPartner(conversation);
    await fetchMessages(conversation.partnerId);

    if (conversation.unreadCount > 0) {
      try {
        await fetch("/api/messages/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId: conversation.partnerId }),
        });
        setConversations((prev) =>
          prev.map((c) => (c.partnerId === conversation.partnerId ? { ...c, unreadCount: 0 } : c))
        );
        setUnreadCount((prev) => Math.max(0, prev - conversation.unreadCount));
        // Ping the navbar indicator so the unread badge drops immediately.
        window.dispatchEvent(new CustomEvent(NOTIFICATION_REFRESH_EVENT));
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPartner || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toId: selectedPartner.partnerId, content: newMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
        setConversations((prev) =>
          prev.map((c) =>
            c.partnerId === selectedPartner.partnerId
              ? { ...c, lastMessage: data.message.content, lastMessageTime: new Date(data.message.createdAt) }
              : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return formatDistanceToNow(d, { addSuffix: true });
  };

  // Client-side filter for the conversation list (alias + last message).
  const filteredConversations = conversations.filter((conv) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      conv.partnerAlias.toLowerCase().includes(q) ||
      conv.lastMessage.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-[calc(100dvh-6rem)] min-h-[480px] bg-black border border-zinc-800 rounded-none overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-black px-4 py-3">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
              EPHEMERAL MESSENGER // FULL CONSOLE
            </p>
            <h1 className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Zero-PII peer-to-peer messaging
            </h1>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="border border-emerald-500/50 bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane - Conversation List */}
        <aside
          className={`w-full flex-col border-r border-zinc-800 bg-black md:flex md:w-80 ${
            isMobile && selectedPartner ? "hidden" : "flex"
          }`}
        >
          {/* Search/Filter */}
          <div className="border-b border-zinc-800 p-3">
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-none border border-zinc-800 bg-black py-2 pl-10 pr-3 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                aria-label="Search conversations"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <MessageSquare className="mb-4 h-12 w-12 text-zinc-600" aria-hidden="true" />
                <h3 className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-300">No conversations yet</h3>
                <p className="font-mono text-[11px] text-zinc-500">Start a conversation from a tool or skill page</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <MessageSquare className="mb-4 h-12 w-12 text-zinc-600" aria-hidden="true" />
                <h3 className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-300">No matches</h3>
                <p className="font-mono text-[11px] text-zinc-500">No conversation matches &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <ul className="space-y-1" role="list" aria-label="Conversations">
                {filteredConversations.map((conv) => (
                  <li key={conv.partnerId}>
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className={`flex w-full items-start gap-3 border-l-2 p-3 text-left transition-colors ${
                        selectedPartner?.partnerId === conv.partnerId
                          ? "border-l-cyan-500 bg-zinc-900/60"
                          : "border-l-transparent hover:bg-zinc-900/40"
                      }`}
                      aria-current={selectedPartner?.partnerId === conv.partnerId ? "true" : "false"}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-800 bg-black text-zinc-500">
                        <User className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="truncate font-mono text-xs text-zinc-200">{conv.partnerAlias}</h4>
                          <time className="whitespace-nowrap font-mono text-[10px] text-zinc-600" dateTime={conv.lastMessageTime.toISOString()}>
                            {formatTime(conv.lastMessageTime)}
                          </time>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Shield className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                          <span className="font-mono text-[10px] text-cyan-400">{conv.partnerTrustScore}</span>
                          {conv.unreadCount > 0 && (
                            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                              {conv.unreadCount > 9 ? "9+" : conv.unreadCount} UNREAD
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{conv.lastMessage}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Pane - Chat Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selectedPartner ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-black px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="p-2 text-zinc-400 transition-colors hover:text-white md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-800 bg-black text-zinc-500">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-mono text-xs text-zinc-200">{selectedPartner.partnerAlias}</h3>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-cyan-400" aria-hidden="true" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">
                        Trust: {selectedPartner.partnerTrustScore}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-zinc-500 transition-colors hover:text-white" aria-label="Notifications">
                    <Bell className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button className="p-2 text-zinc-500 transition-colors hover:text-white" aria-label="More options">
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-black p-4" role="log" aria-live="polite" aria-label="Messages">
                {isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">Loading thread...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center text-zinc-500">
                    <MessageSquare className="mb-3 h-10 w-10 text-zinc-700" aria-hidden="true" />
                    <p className="font-mono text-[11px] uppercase tracking-widest">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.fromId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-none border p-3 font-mono text-xs ${
                            isOwn
                              ? "border-cyan-500/30 bg-cyan-500/5 text-zinc-100"
                              : "border-zinc-800 bg-[#0a0a0a] text-zinc-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <time className={`mt-1 block text-right font-mono text-[10px] text-zinc-600`}>
                            {formatTime(msg.createdAt)}
                          </time>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="border-t border-zinc-800 bg-black p-4">
                <div className="flex items-end gap-3">
                  <div className="relative flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      rows={1}
                      className="max-h-32 w-full resize-none rounded-none border border-zinc-800 bg-black px-3 py-2 font-mono text-base text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none"
                      aria-label="Message"
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="flex shrink-0 cursor-pointer items-center gap-2 border border-cyan-500/60 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-black px-6 text-center">
              <MessageSquare className="mb-6 h-14 w-14 text-zinc-700" aria-hidden="true" />
              <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300">Select a conversation</h2>
              <p className="max-w-sm font-mono text-[11px] text-zinc-500">Choose a conversation from the sidebar or start a new one from a tool or skill page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
