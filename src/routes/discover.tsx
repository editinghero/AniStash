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
  useDocumentMetadata("Discover AI — AniStash", "Chat with AI to discover new anime and query your stash.");

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

      setMessages((prev) => [...prev, { role: "model", text: data.text, thought: data.thought }]);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
      setMessages((prev) => prev.slice(0, -1)); // Revert user message on error
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
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight inline-flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-status-planning" />
            Discover
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask questions about your stash or get personalized recommendations.
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground self-start sm:self-auto">
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Chat
          </Button>
        )}
      </div>

      <div className="flex h-[calc(100vh-290px)] md:h-[65vh] min-h-[400px] flex-col rounded-2xl border border-border/60 bg-surface/50 backdrop-blur-md shadow-card overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
          {isInitializing ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center space-y-4 text-muted-foreground">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-accent shadow-glow text-white">
                <Sparkles className="h-8 w-8" />
              </div>
              <div>
                <p className="font-medium text-foreground">Welcome to Discover AI</p>
                <p className="text-sm mt-1 max-w-xs">I know what you've watched and read. Ask me what you should start next, or ask for your stats!</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${msg.role === "user"
                      ? "bg-surface ring-1 ring-border"
                      : "bg-gradient-accent text-white shadow-glow"
                    }`}
                >
                  {msg.role === "user" ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[90%] sm:max-w-[75%] ${msg.role === "user"
                      ? "bg-surface text-foreground ring-1 ring-border/60 whitespace-pre-wrap"
                      : "bg-background text-foreground/90 shadow-sm ring-1 ring-border/40"
                    }`}
                >
                  {msg.role === "model" && msg.thought && (
                    <ThinkingProcess thought={msg.thought} />
                  )}
                  {msg.role === "user" ? msg.text : <MarkdownRenderer content={msg.text} />}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-accent text-white shadow-glow">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl bg-background px-5 py-4 text-sm max-w-[90%] sm:max-w-[75%] ring-1 ring-border/40 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/60 bg-background/50 p-4">
          <form onSubmit={handleSend} className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for recommendations..."
              className="pr-12 bg-surface/50 h-12 rounded-xl border-border/60 focus-visible:ring-status-planning/50 focus-visible:border-status-planning transition-all"
              disabled={isLoading || isInitializing}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || isInitializing}
              className="absolute right-1.5 h-9 w-9 rounded-lg bg-gradient-accent hover:opacity-90 text-white transition-opacity"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
