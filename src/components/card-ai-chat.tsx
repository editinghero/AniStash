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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, [entry.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

      setMessages((prev) => [...prev, { role: "model", text: data.text, thought: data.thought }]);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setMessages((prev) => prev.slice(0, -1)); // Revert
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear this item's chat history?")) return;
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
    <div className="flex flex-col h-full bg-surface/30 rounded-xl border border-border/60 overflow-hidden mt-6">
      <div className="bg-gradient-accent/10 px-4 py-2 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-status-planning" />
          <span className="text-xs font-semibold">AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[350px] min-h-[200px]">
        {isInitializing ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-4">
            <Bot className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-xs">Ask me anything about {entry.title}!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${msg.role === "user" ? "bg-surface ring-1 ring-border" : "bg-gradient-accent text-white"}`}>
                {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              </div>
              <div className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed max-w-[85%] ${msg.role === "user" ? "bg-surface text-foreground whitespace-pre-wrap" : "bg-background text-foreground/90 shadow-sm"}`}>
                {msg.role === "model" && msg.thought && (
                  <ThinkingProcess thought={msg.thought} />
                )}
                {msg.role === "user" ? msg.text : <MarkdownRenderer content={msg.text} />}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 flex-row">
            <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-accent text-white">
              <Bot className="h-3 w-3" />
            </div>
            <div className="rounded-xl bg-background px-3 py-2 flex items-center gap-1 shadow-sm">
              <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 bg-background/50 border-t border-border/60">
        <form onSubmit={handleSend} className="relative flex items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI..."
            className="pr-10 bg-surface/50 h-9 text-sm rounded-lg"
            disabled={isLoading || isInitializing}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || isInitializing}
            className="absolute right-1 h-7 w-7 rounded-md bg-gradient-accent text-white"
          >
            <Send className="h-3 w-3" />
          </Button>
        </form>
      </div>
    </div>
  );
}
