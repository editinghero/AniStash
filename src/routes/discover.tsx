import { useState } from "react";
import { Sparkles, Compass, Bot, Newspaper } from "lucide-react";
import { useDocumentMetadata } from "@/lib/router";
import { SeasonalDiscoverTab } from "@/components/discover/seasonal-discover-tab";
import { AiAssistantTab } from "@/components/discover/ai-assistant-tab";
import { NewsHubTab } from "@/components/discover/news-hub-tab";

type DiscoverSubTab = "discover" | "assistant" | "news";

export default function DiscoverPage() {
  useDocumentMetadata(
    "Discover — AniStash",
    "Explore seasonal anime charts, AI deep-dive media analysis, and live anime news.",
  );

  const [activeTab, setActiveTab] = useState<DiscoverSubTab>("discover");

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 py-4 sm:py-8 space-y-5 sm:space-y-7 animate-page-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#f0788a] mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>AniStash Discovery</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#fff3e0]">
            Discover & Explore
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#968677]">
            Seasonal charts, Google-grounded AI deep-dive chats, and live anime
            news feeds.
          </p>
        </div>

        {/* 3 Sub-Tabs Switcher (Pill Bar matching StatusTabs) */}
        <div
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="flex items-center gap-1 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl self-start md:self-auto max-w-full overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={() => setActiveTab("discover")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              activeTab === "discover"
                ? "bg-[#f0788a] text-white font-bold shadow-[0_0_16px_rgba(240,120,138,0.35)]"
                : "text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.05)]"
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Discover Charts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assistant")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              activeTab === "assistant"
                ? "bg-[#f0788a] text-white font-bold shadow-[0_0_16px_rgba(240,120,138,0.35)]"
                : "text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.05)]"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI Assistant</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("news")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              activeTab === "news"
                ? "bg-[#f0788a] text-white font-bold shadow-[0_0_16px_rgba(240,120,138,0.35)]"
                : "text-[#dbc9b5] hover:text-[#fff3e0] hover:bg-[rgba(255,243,224,0.05)]"
            }`}
          >
            <Newspaper className="h-3.5 w-3.5" />
            <span>News Hub</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === "discover" && <SeasonalDiscoverTab />}
      {activeTab === "assistant" && <AiAssistantTab />}
      {activeTab === "news" && <NewsHubTab />}
    </div>
  );
}
