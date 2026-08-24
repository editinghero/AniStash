import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Sparkles, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { LibraryEntry } from "@/lib/types";
import { MarkdownRenderer } from "./ui/markdown-renderer";
import { ThinkingProcess } from "./ui/thinking-process";

interface ChatMessage {
  role: "user" | "model";
  text: string;
  thought?: string;
}

export function CardAIChat({ entry }: { entry: LibraryEntry }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory();
    }, 120);
    return () => clearTimeout(timer);
  }, [entry.id]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/ai/history?type=card&id=${entry.id}`);
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
    shouldAutoScrollRef.current = true;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/ai/card-chat/${entry.id}`, {
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
      setMessages((prev) => prev.slice(0, -1)); // Revert
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear this item's chat history?"))
      return;
    try {
      const res = await fetch("/api/ai/clear-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "card", id: String(entry.id) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear chat");
      }

      setMessages([]);
      toast.success("Chat history cleared");
    } catch (err: any) {
      toast.error(err.message || "Failed to clear chat");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[rgba(34,25,26,0.65)] rounded-2xl border border-[rgba(255,243,224,0.08)] overflow-hidden mt-5 shadow-lg backdrop-blur-xl">
      <div className="bg-[rgba(255,243,224,0.03)] px-3.5 py-2.5 border-b border-[rgba(255,243,224,0.08)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#fff3e0]">AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[#968677] hover:text-[#e02e2a] p-1 rounded-full hover:bg-[rgba(224,46,42,0.1)] transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="stash-scrollbar flex-1 overflow-y-auto p-3.5 space-y-3.5 max-h-[350px] min-h-[180px]"
      >
        {isInitializing ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f0788a] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[#968677] p-4">
            <Bot className="h-7 w-7 mb-2 text-[#f0788a] opacity-80" />
            <p className="text-xs">Ask me anything about {entry.title}!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user"
                    ? "border border-[rgba(255,243,224,0.1)] bg-[rgba(255,243,224,0.05)] text-[#dbc9b5]"
                    : "border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a] shadow-[0_0_10px_rgba(240,120,138,0.2)]"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div
                className={`rounded-2xl px-3 py-2 text-xs leading-relaxed max-w-[85%] ${
                  msg.role === "user"
                    ? "border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.15)] text-[#fff3e0] whitespace-pre-wrap"
                    : "border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.85)] text-[#dbc9b5]"
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
          <div className="flex gap-2.5 flex-row">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a]">
              <Bot className="h-3 w-3" />
            </div>
            <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.85)] px-3 py-2 flex items-center gap-1">
              <span className="w-1 h-1 bg-[#f0788a] rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>
      <div className="p-2.5 bg-[rgba(25,18,19,0.7)] border-t border-[rgba(255,243,224,0.08)]">
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI..."
            className="pr-10 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-9 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a]"
            disabled={isLoading || isInitializing}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || isInitializing}
            className="absolute right-1 h-7 w-7 rounded-full bg-[#f0788a] text-[#191213] shadow-[0_0_10px_rgba(240,120,138,0.25)] hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
          >
            <Send className="h-3 w-3" />
          </Button>
        </form>
      </div>
    </div>
  );
}
