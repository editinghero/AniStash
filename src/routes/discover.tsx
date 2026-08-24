import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Trash2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDocumentMetadata } from "@/lib/router";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ThinkingProcess } from "@/components/ui/thinking-process";

interface ChatMessage {
  role: "user" | "model";
  text: string;
  thought?: string;
}

export default function DiscoverPage() {
  useDocumentMetadata(
    "Discover AI — AniStash",
    "Chat with AI to discover new anime and query your stash.",
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/ai/history?type=global");
      if (res.ok) {
        const data = await res.json();
        if (data.history) setMessages(data.history);
      }
    } catch (e) {
      console.error("Failed to fetch AI history", e);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/global-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to communicate with AI");
      }

      setMessages((prev) => [
        ...prev,
        { role: "model", text: data.text, thought: data.thought },
      ]);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear the chat history?")) return;
    try {
      await fetch("/api/ai/clear-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "global" }),
      });
      setMessages([]);
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f0788a] mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>AI Discover</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#fff3e0]">
            Ask & Discover
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#968677]">
            Ask questions about your library or discover personalized recommendations.
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="rounded-full text-xs text-[#968677] hover:text-[#e02e2a] hover:bg-[#e02e2a]/10 self-start sm:self-auto"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear Chat
          </Button>
        )}
      </div>

      <div className="flex h-[calc(100vh-270px)] md:h-[65vh] min-h-[420px] flex-col rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden">
        <div className="stash-scrollbar flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          {isInitializing ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#f0788a] border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center space-y-3.5 text-[#968677] px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(240,120,138,0.4)] bg-[#22191a] shadow-[0_0_20px_rgba(240,120,138,0.25)] text-[#f0788a]">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-[#fff3e0]">
                  Welcome to Discover AI
                </p>
                <p className="text-xs sm:text-sm mt-1 max-w-sm text-[#968677]">
                  Ask what to watch or read next, find hidden gems, or query statistics from your stash!
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "user"
                      ? "border border-[rgba(255,243,224,0.1)] bg-[rgba(255,243,224,0.05)] text-[#dbc9b5]"
                      : "border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a] shadow-[0_0_12px_rgba(240,120,138,0.25)]"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed max-w-[90%] sm:max-w-[75%] ${
                    msg.role === "user"
                      ? "border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.12)] text-[#fff3e0] whitespace-pre-wrap"
                      : "border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.8)] text-[#dbc9b5] shadow-sm backdrop-blur-md"
                  }`}
                >
                  {msg.role === "model" && msg.thought && (
                    <ThinkingProcess thought={msg.thought} />
                  )}
                  {msg.role === "user" ? (
                    msg.text
                  ) : (
                    <MarkdownRenderer content={msg.text} variant="basic" />
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a] shadow-[0_0_12px_rgba(240,120,138,0.25)]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.8)] px-5 py-4 text-sm max-w-[90%] sm:max-w-[75%] flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[rgba(255,243,224,0.07)] bg-[rgba(25,18,19,0.8)] p-3 sm:p-4 backdrop-blur-md">
          <form onSubmit={handleSend} className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for anime/manga recommendations..."
              className="pr-12 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-11 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none transition-all"
              disabled={isLoading || isInitializing}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || isInitializing}
              className="absolute right-1 h-9 w-9 rounded-full bg-[#f0788a] text-white shadow-[0_0_14px_rgba(240,120,138,0.3)] hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
