import React, { useState } from "react";
import { ChevronDown, ChevronRight, BrainCircuit } from "lucide-react";

interface ThinkingProcessProps {
  thought: string;
}

export function ThinkingProcess({ thought }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!thought || !thought.trim()) return null;

  return (
    <div className="mb-3 rounded-xl border border-border/40 bg-surface/30 overflow-hidden text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-3 py-2 text-muted-foreground hover:bg-surface/50 hover:text-foreground transition-colors text-left"
      >
        <BrainCircuit className="h-3.5 w-3.5 text-status-planning" />
        <span className="font-medium flex-1">Thinking Process</span>
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-border/20 text-muted-foreground/80 leading-relaxed font-sans whitespace-pre-wrap max-h-[180px] overflow-y-auto bg-background/20">
          {thought.trim()}
        </div>
      )}
    </div>
  );
}
