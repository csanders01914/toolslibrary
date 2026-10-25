"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Shield, User, ChevronLeft, MoreVertical, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  return (
    <div className="h-[calc(100vh-6rem)] min-h-[600px] bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/50">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-cyan-400" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-white">Messages</h1>
            <p className="text-xs text-slate-400">Zero-PII peer-to-peer messaging</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium border border-cyan-500/30">
            {unreadCount} unread
          </span>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Conversation List */}
        <aside
          className={`flex-col w-full md:w-80 border-r border-white/10 bg-slate-950/50 transition-all duration-300 md:flex ${
            isMobile && selectedPartner ? "hidden" : "flex"
          }`}
        >
          {/* Search/Filter */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search conversations..."
                className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-2 pl-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                aria-label="Search conversations"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageSquare className="w-16 h-16 text-slate-600 mb-4" aria-hidden="true" />
                <h3 className="text-lg font-semibold text-slate-300 mb-1">No conversations yet</h3>
                <p className="text-sm text-slate-500">Start a conversation from a tool or skill page</p>
              </div>
            ) : (
              <ul className="space-y-1" role="list" aria-label="Conversations">
                {conversations.map((conv) => (
                  <li key={conv.partnerId}>
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-start gap-3 ${
                        selectedPartner?.partnerId === conv.partnerId
                          ? "bg-cyan-500/10 border border-cyan-500/30"
                          : "hover:bg-slate-900/50 hover:border-white/10 border border-transparent"
                      }`}
                      aria-current={selectedPartner?.partnerId === conv.partnerId ? "true" : "false"}
                    >
                      <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center overflow-hidden">
                        <User className="w-5 h-5 text-purple-400" aria-hidden="true" />
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-white truncate">{conv.partnerAlias}</h4>
                          <time className="text-xs text-slate-500 whitespace-nowrap" dateTime={conv.lastMessageTime.toISOString()}>
                            {formatTime(conv.lastMessageTime)}
                          </time>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Shield className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                          <span className="text-xs font-medium text-cyan-300">{conv.partnerTrustScore}</span>
                        </div>
                        <p className="text-sm text-slate-400 truncate mt-1">{conv.lastMessage}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right Pane - Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedPartner ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="md:hidden p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <User className="w-5 h-5 text-purple-400" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{selectedPartner.partnerAlias}</h3>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                      <span className="text-xs font-medium text-cyan-300">Trust: {selectedPartner.partnerTrustScore}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-xl text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-all" aria-label="Notifications">
                    <Bell className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button className="p-2 rounded-xl text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-all" aria-label="More options">
                    <MoreVertical className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Messages">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 text-slate-500">
                    <MessageSquare className="w-12 h-12 mb-3" aria-hidden="true" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
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
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                            isOwn
                              ? "bg-gradient-to-r from-cyan-600/40 to-blue-600/40 border border-cyan-400/30 rounded-tr-none"
                              : "bg-slate-800/70 border border-white/10 rounded-tl-none"
                          }`}
                        >
                          <p className="text-sm text-slate-100 whitespace-pre-wrap">{msg.content}</p>
                          <time className={`text-[11px] mt-1 block text-right ${isOwn ? "text-cyan-200/70" : "text-slate-500"}`}>
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
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-slate-950/50">
                <div className="flex items-end gap-3">
                  <div className="relative flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full bg-slate-900/80 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-none max-h-32"
                      aria-label="Message"
                      disabled={sending}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Send message"
                  >
                    <Send className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageSquare className="w-20 h-20 text-slate-700 mb-6" aria-hidden="true" />
              <h2 className="text-2xl font-bold text-slate-300 mb-2">Select a conversation</h2>
              <p className="text-slate-500 max-w-sm">Choose a conversation from the sidebar or start a new one from a tool or skill page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}