import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Trash2,
  Bot,
  User,
  Shield,
  ShieldAlert,
  Search,
  BookOpen,
  Film,
  Tv,
  FileText,
  Clock,
  Compass,
  Layers,
  Newspaper,
  History,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { ThinkingProcess } from "@/components/ui/thinking-process";
import { useLibrary } from "@/lib/use-library";
import { searchAnilist, type AnilistMedia } from "@/lib/anilist-client";
import type { LibraryEntry } from "@/lib/types";

interface ChatMessage {
  role: "user" | "model";
  text: string;
  thought?: string;
}

interface CardChatHistory {
  id: string;
  title: string;
  history: ChatMessage[];
}

interface HistorySection {
  id: string;
  title: string;
  type: "series" | "general" | "card";
  seriesTitle?: string;
  messages: ChatMessage[];
}

type ActionMode = "direct-chat" | "where-was-i" | "plot-summary" | "similar-titles" | "latest-news";

export function AiAssistantTab() {
  const library = useLibrary();

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cardChats, setCardChats] = useState<CardChatHistory[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  // Settings & Toggles
  const [allowSpoilers, setAllowSpoilers] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);

  // Series Selection State (Default is null -> general AI chat)
  const [selectedSeries, setSelectedSeries] = useState<{
    title: string;
    type?: string;
    isFromLibrary: boolean;
    notes?: string;
  } | null>(null);

  // Series Search Box
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    libraryMatches: LibraryEntry[];
    anilistMatches: AnilistMedia[];
  }>({ libraryMatches: [], anilistMatches: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // "Where was I?" Modal Inputs
  const [whereWasIOpen, setWhereWasIOpen] = useState(false);
  const [whereSeason, setWhereSeason] = useState("");
  const [whereEpisode, setWhereEpisode] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Click outside to close series search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live series search across library and AniList
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ libraryMatches: [], anilistMatches: [] });
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const libMatches = library
      .filter((e) => {
        const t1 = e.title.toLowerCase();
        const t2 = (e.englishTitle || "").toLowerCase();
        return t1.includes(q) || t2.includes(q);
      })
      .slice(0, 5);

    setSearchResults((prev) => ({ ...prev, libraryMatches: libMatches }));

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const aniMatches = await searchAnilist(searchQuery, "ANIME", 5);
        setSearchResults((prev) => ({ ...prev, anilistMatches: aniMatches }));
      } catch {
        // silent fail
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, library]);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/ai/history?type=global");
      if (res.ok) {
        const data = await res.json();
        if (data.history) setMessages(data.history);
        if (data.cardChats) setCardChats(data.cardChats);
      }
    } catch (e) {
      console.error("Failed to fetch AI history", e);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear your AI chat history?")) return;
    try {
      await fetch("/api/ai/clear-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "global" }),
      });
      setMessages([]);
      setHistoryOpen(false);
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  const executeDeepDive = async (
    mode: ActionMode,
    overrideMsg?: string,
    extraEpisode?: string,
    extraSeason?: string,
  ) => {
    if (isLoading) return;

    const userText =
      overrideMsg ||
      (mode === "where-was-i"
        ? `Where was I in "${selectedSeries?.title || "this series"}"?`
        : mode === "plot-summary"
          ? `Spoiler-free summary for "${selectedSeries?.title || "this series"}"`
          : mode === "similar-titles"
            ? `Similar titles to "${selectedSeries?.title || "this series"}"`
            : mode === "latest-news"
              ? `Latest news for "${selectedSeries?.title || "this series"}"`
              : input.trim());

    if (!userText && mode === "direct-chat") return;
    if (mode === "direct-chat") setInput("");

    setIsLoading(true);
    setMessages((prev) => [...prev, { role: "user", text: userText }]);

    try {
      const payload = {
        mode,
        seriesTitle: selectedSeries?.title,
        seasonNum: extraSeason || whereSeason || undefined,
        episodeNum: extraEpisode || whereEpisode || undefined,
        message: overrideMsg || input.trim(),
        allowSpoilers,
        includeNotes: Boolean(selectedSeries?.isFromLibrary && includeNotes),
        userNotes: selectedSeries?.isFromLibrary && includeNotes ? selectedSeries.notes : undefined,
      };

      const res = await fetch("/api/ai/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      toast.error(err.message || "An error occurred with AI assistant");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    executeDeepDive("direct-chat", input.trim());
  };

  const handleSelectLibraryItem = (entry: LibraryEntry) => {
    const title = entry.englishTitle || entry.title;
    setSelectedSeries({
      title,
      type: entry.type,
      isFromLibrary: true,
      notes: entry.notes || "",
    });
    setSearchQuery("");
    setIsDropdownOpen(false);
    toast.success(`Context set to "${title}"`);
  };

  const handleSelectAnilistItem = (media: AnilistMedia) => {
    const title = media.title.english || media.title.romaji || "Untitled";
    setSelectedSeries({
      title,
      type: media.type,
      isFromLibrary: false,
    });
    setSearchQuery("");
    setIsDropdownOpen(false);
    toast.success(`Context set to "${title}"`);
  };

  const handleSelectCustomTitle = () => {
    if (!searchQuery.trim()) return;
    const title = searchQuery.trim();
    setSelectedSeries({
      title,
      isFromLibrary: false,
    });
    setSearchQuery("");
    setIsDropdownOpen(false);
    toast.success(`Context set to "${title}"`);
  };

  const handleClearContext = () => {
    setSelectedSeries(null);
    toast.info("Switched to general AI chat");
  };

  const submitWhereWasI = () => {
    if (!whereEpisode.trim()) {
      toast.error("Please enter an episode or chapter number.");
      return;
    }
    setWhereWasIOpen(false);
    executeDeepDive("where-was-i", undefined, whereEpisode, whereSeason);
  };

  // Build grouped history sections
  const historySections: HistorySection[] = React.useMemo(() => {
    const sections: HistorySection[] = [];

    // Group assistant messages by pairs or title tags
    if (messages.length > 0) {
      const seriesBuckets: Record<string, ChatMessage[]> = {};
      const generalMsgs: ChatMessage[] = [];

      for (let i = 0; i < messages.length; i += 2) {
        const uMsg = messages[i];
        const aMsg = messages[i + 1];
        if (!uMsg) continue;

        const pair = aMsg ? [uMsg, aMsg] : [uMsg];

        // Check if message mentions a series tag like [Regarding "Title"]: or "Title"
        const match = uMsg.text.match(/\[Regarding "([^"]+)"\]/) || uMsg.text.match(/in "([^"]+)"/);
        if (match && match[1]) {
          const sTitle = match[1];
          if (!seriesBuckets[sTitle]) seriesBuckets[sTitle] = [];
          seriesBuckets[sTitle].push(...pair);
        } else {
          generalMsgs.push(...pair);
        }
      }

      Object.entries(seriesBuckets).forEach(([sTitle, msgs], idx) => {
        sections.push({
          id: `series-${idx}`,
          title: `Series: ${sTitle}`,
          type: "series",
          seriesTitle: sTitle,
          messages: msgs,
        });
      });

      if (generalMsgs.length > 0) {
        sections.push({
          id: "general-chat",
          title: "General Stash Conversations",
          type: "general",
          messages: generalMsgs,
        });
      }
    }

    // Card-specific chat histories
    cardChats.forEach((cChat) => {
      if (cChat.history && cChat.history.length > 0) {
        sections.push({
          id: `card-${cChat.id}`,
          title: `Show Chat: ${cChat.title}`,
          type: "card",
          seriesTitle: cChat.title,
          messages: cChat.history,
        });
      }
    });

    return sections;
  }, [messages, cardChats]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const restoreSection = (sec: HistorySection) => {
    setMessages(sec.messages);
    if (sec.seriesTitle) {
      // Find if in library
      const libEntry = library.find(
        (e) =>
          e.title.toLowerCase() === sec.seriesTitle!.toLowerCase() ||
          (e.englishTitle && e.englishTitle.toLowerCase() === sec.seriesTitle!.toLowerCase()),
      );
      if (libEntry) {
        setSelectedSeries({
          title: libEntry.englishTitle || libEntry.title,
          type: libEntry.type,
          isFromLibrary: true,
          notes: libEntry.notes || "",
        });
      } else {
        setSelectedSeries({
          title: sec.seriesTitle,
          isFromLibrary: false,
        });
      }
    } else {
      setSelectedSeries(null);
    }
    setHistoryOpen(false);
    toast.success(`Restored "${sec.title}" conversation`);
  };

  return (
    <div className="space-y-4 animate-page-in">
      {/* Top Configuration & Series Context Bar */}
      <div className="rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl space-y-3 relative z-30">
        {/* Header row: Context selector + Toggles */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Series Context Selector Box */}
          <div className="flex-1 relative" ref={searchContainerRef}>
            {selectedSeries ? (
              <div className="flex items-center justify-between gap-2 rounded-full border border-[#f0788a]/40 bg-[rgba(240,120,138,0.08)] px-4 py-1.5 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f0788a] text-white">
                    {selectedSeries.type === "MANGA" ? (
                      <BookOpen className="h-3 w-3" />
                    ) : selectedSeries.type === "SERIES" ? (
                      <Tv className="h-3 w-3" />
                    ) : (
                      <Film className="h-3 w-3" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#fff3e0]">
                      {selectedSeries.title}
                    </p>
                    <p className="text-[10px] text-[#968677]">
                      {selectedSeries.isFromLibrary ? "From Stash" : "Custom/AniList"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedSeries.isFromLibrary && (
                    <div className="flex items-center gap-1.5 rounded-full bg-[rgba(25,18,19,0.8)] px-3 py-1 border border-[rgba(255,243,224,0.08)]">
                      <FileText className="h-3 w-3 text-[#f0788a]" />
                      <span className="text-[10px] font-semibold text-[#dbc9b5]">Notes</span>
                      <Switch
                        checked={includeNotes}
                        onCheckedChange={setIncludeNotes}
                        className="scale-75 data-[state=checked]:bg-[#f0788a]"
                      />
                    </div>
                  )}
                  {/* Circular Glassmorphic X Button */}
                  <button
                    type="button"
                    onClick={handleClearContext}
                    className="h-7 w-7 rounded-full border border-[rgba(255,243,224,0.12)] bg-[rgba(34,25,26,0.7)] text-[#968677] hover:text-[#fff3e0] hover:bg-[rgba(240,120,138,0.15)] hover:border-[rgba(240,120,138,0.4)] backdrop-blur-xl shadow-xs hover:scale-105 active:scale-90 flex items-center justify-center transition-all cursor-pointer"
                    title="Clear series context (Switch to general chat)"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#968677]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Select title from stash or search AniList / enter custom title..."
                  className="pl-9 pr-4 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-9 text-xs text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none transition-all"
                />

                {/* Dropdown Results */}
                {isDropdownOpen && searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-[rgba(255,243,224,0.12)] bg-[#22191a] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.9)] backdrop-blur-2xl max-h-64 overflow-y-auto stash-scrollbar space-y-2">
                    {/* Custom Title Option */}
                    <button
                      type="button"
                      onClick={handleSelectCustomTitle}
                      className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:scale-[1.01] active:scale-95 transition-all text-xs text-[#f0788a] font-medium"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>Use custom title: "{searchQuery.trim()}"</span>
                    </button>

                    {/* Library Matches */}
                    {searchResults.libraryMatches.length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#968677]">
                          From Your Stash
                        </div>
                        {searchResults.libraryMatches.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => handleSelectLibraryItem(entry)}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:scale-[1.01] active:scale-95 transition-all text-xs text-[#fff3e0]"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="rounded-full bg-[rgba(240,120,138,0.2)] px-2 py-0.5 text-[10px] font-bold text-[#f0788a]">
                                {entry.type}
                              </span>
                              <span className="truncate">{entry.englishTitle || entry.title}</span>
                            </div>
                            {entry.notes && (
                              <FileText className="h-3 w-3 text-[#968677] shrink-0 ml-1" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* AniList Matches */}
                    {searchResults.anilistMatches.length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#968677]">
                          AniList Database
                        </div>
                        {searchResults.anilistMatches.map((media) => (
                          <button
                            key={media.id}
                            type="button"
                            onClick={() => handleSelectAnilistItem(media)}
                            className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:scale-[1.01] active:scale-95 transition-all text-xs text-[#dbc9b5]"
                          >
                            <span className="truncate">
                              {media.title.english || media.title.romaji}
                            </span>
                            <span className="text-[10px] text-[#968677] shrink-0 ml-2">
                              {media.format || media.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {isSearching && (
                      <div className="p-2 text-center text-xs text-[#968677]">
                        Searching AniList...
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggles & History Controls */}
          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-auto">
            {/* Spoiler Protection Toggle */}
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-all ${
                allowSpoilers
                  ? "border-[rgba(224,46,42,0.4)] bg-[rgba(224,46,42,0.1)] text-[#e02e2a]"
                  : "border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.08)] text-[#f0788a]"
              }`}
            >
              {allowSpoilers ? (
                <ShieldAlert className="h-3.5 w-3.5" />
              ) : (
                <Shield className="h-3.5 w-3.5" />
              )}
              <span className="font-semibold">
                {allowSpoilers ? "Spoilers: Allowed" : "Spoiler-Free"}
              </span>
              <Switch
                checked={allowSpoilers}
                onCheckedChange={setAllowSpoilers}
                className="scale-75 data-[state=checked]:bg-[#e02e2a] data-[state=unchecked]:bg-[#f0788a]"
              />
            </div>

            {/* Chat History Button */}
            <button
              type="button"
              onClick={() => {
                fetchHistory();
                setHistoryOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 py-1.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0"
            >
              <History className="h-3.5 w-3.5 text-[#f0788a]" />
              <span>History</span>
            </button>
          </div>
        </div>

        {/* Action Modes Bar (Smooth horizontal scroll on mobile without cutting off, hidden scrollbars) */}
        <div
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pt-3 pb-1 w-full max-w-full [&::-webkit-scrollbar]:hidden border-t border-[rgba(255,243,224,0.06)]"
        >
          <button
            type="button"
            disabled={isLoading || !selectedSeries}
            onClick={() => {
              if (selectedSeries) {
                setWhereWasIOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0 whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Clock className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>Where was I?</span>
          </button>

          <button
            type="button"
            disabled={isLoading || !selectedSeries}
            onClick={() => executeDeepDive("plot-summary")}
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0 whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Compass className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>Plot Summary</span>
          </button>

          <button
            type="button"
            disabled={isLoading || !selectedSeries}
            onClick={() => executeDeepDive("similar-titles")}
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0 whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Layers className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>Similar Titles</span>
          </button>

          <button
            type="button"
            disabled={isLoading || !selectedSeries}
            onClick={() => executeDeepDive("latest-news")}
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.03)] px-3.5 text-xs font-semibold text-[#dbc9b5] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200 shrink-0 whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <Newspaper className="h-3.5 w-3.5 text-[#f0788a]" />
            <span>Latest News</span>
          </button>
        </div>
      </div>

      {/* Main Chat Stream Box */}
      <div
        className={`flex flex-col rounded-3xl border border-[rgba(255,243,224,0.08)] bg-[rgba(34,25,26,0.85)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden transition-all duration-300 ${
          messages.length > 0
            ? "h-[50vh] min-h-[380px] max-h-[65vh]"
            : "h-[260px]"
        }`}
      >
        <div className="stash-scrollbar flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isInitializing ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#f0788a] border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center space-y-2 text-[#968677] px-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(240,120,138,0.4)] bg-[#22191a] shadow-[0_0_16px_rgba(240,120,138,0.2)] text-[#f0788a]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display font-bold text-sm text-[#fff3e0]">
                  AI Anime Assistant & Stash Intelligence
                </p>
                <p className="text-xs text-[#968677] max-w-md">
                  {selectedSeries
                    ? `Ready to analyze "${selectedSeries.title}". Ask questions or trigger quick actions above!`
                    : "Ask anything about anime, manga, notes, or your stash records."}
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "user"
                      ? "border border-[rgba(255,243,224,0.1)] bg-[rgba(255,243,224,0.05)] text-[#dbc9b5]"
                      : "border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a] shadow-[0_0_10px_rgba(240,120,138,0.25)]"
                  }`}
                >
                  {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed max-w-[88%] sm:max-w-[80%] min-w-0 break-words overflow-x-auto ${
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
            <div className="flex gap-2.5 flex-row">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(240,120,138,0.4)] bg-[#22191a] text-[#f0788a] shadow-[0_0_10px_rgba(240,120,138,0.25)]">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.8)] px-4 py-3 text-xs max-w-[90%] sm:max-w-[80%] flex items-center gap-1.5 backdrop-blur-md">
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-[#f0788a] rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-[rgba(255,243,224,0.07)] bg-[rgba(25,18,19,0.8)] p-3 backdrop-blur-md">
          <form onSubmit={handleSendChat} className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedSeries
                  ? `Ask about "${selectedSeries.title}"...`
                  : "Ask anything about anime, manga, notes, or your stash..."
              }
              className="pr-12 rounded-full border border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-10 text-xs sm:text-sm text-[#fff3e0] placeholder:text-[#968677] focus:border-[#f0788a] focus:outline-none transition-all"
              disabled={isLoading || isInitializing}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isInitializing}
              className="absolute right-1 h-8 w-8 rounded-full bg-[#f0788a] text-white shadow-[0_0_12px_rgba(240,120,138,0.3)] hover:scale-[1.05] active:scale-95 disabled:opacity-40 flex items-center justify-center transition-all duration-200"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </form>
        </div>
      </div>

      {/* "Where was I?" Modal Dialog */}
      <Dialog open={whereWasIOpen} onOpenChange={setWhereWasIOpen}>
        <DialogContent className="rounded-3xl border border-[rgba(255,243,224,0.12)] bg-[#22191a] p-6 shadow-2xl text-[#fff3e0] sm:max-w-md backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold text-[#fff3e0] flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#f0788a]" />
              Where was I?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#968677]">
              Enter the exact season and episode/chapter you stopped at. The AI will strictly recap events up to that point without future spoilers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.6)] p-3 text-xs">
              <span className="font-bold text-[#f0788a]">Target Series: </span>
              <span>{selectedSeries?.title}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#dbc9b5]">
                  Season (optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 1 or 2"
                  value={whereSeason}
                  onChange={(e) => setWhereSeason(e.target.value)}
                  className="rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-9 text-xs text-[#fff3e0]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#dbc9b5]">
                  Episode / Chapter #
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 12"
                  value={whereEpisode}
                  onChange={(e) => setWhereEpisode(e.target.value)}
                  className="rounded-full border-[rgba(255,243,224,0.08)] bg-[rgba(255,243,224,0.04)] h-9 text-xs text-[#fff3e0]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWhereWasIOpen(false)}
                className="rounded-full px-4 py-1.5 text-xs text-[#968677] hover:text-[#fff3e0] hover:scale-[1.02] active:scale-95 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitWhereWasI}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#f0788a] text-white text-xs font-semibold px-4 py-2 hover:scale-[1.02] active:scale-95 shadow-[0_0_14px_rgba(240,120,138,0.3)] transition-all duration-200"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Get Recap</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grouped & Collapsible History Dialog with Restore Action */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="rounded-3xl border border-[rgba(255,243,224,0.12)] bg-[#22191a] p-6 shadow-2xl text-[#fff3e0] sm:max-w-xl backdrop-blur-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-lg font-bold text-[#fff3e0] flex items-center gap-2">
                <History className="h-5 w-5 text-[#f0788a]" />
                Saved Conversations
              </DialogTitle>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-[#968677] hover:text-[#e02e2a] hover:bg-[#e02e2a]/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
            <DialogDescription className="text-xs text-[#968677]">
              Organized by series and topics. Click Restore to continue any conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto stash-scrollbar space-y-3 pt-2">
            {historySections.length === 0 ? (
              <p className="text-center text-xs text-[#968677] py-8">
                No conversations recorded yet. Start chatting above!
              </p>
            ) : (
              historySections.map((sec) => {
                const isCollapsed = collapsedSections[sec.id] ?? false;

                return (
                  <div
                    key={sec.id}
                    className="rounded-2xl border border-[rgba(255,243,224,0.08)] bg-[rgba(25,18,19,0.7)] overflow-hidden shadow-sm transition-all"
                  >
                    {/* Collapsible Header Row */}
                    <div className="flex items-center justify-between p-3 bg-[rgba(255,243,224,0.02)] border-b border-[rgba(255,243,224,0.05)]">
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.id)}
                        className="flex items-center gap-2 text-left font-bold text-xs text-[#fff3e0] hover:text-[#f0788a] transition-colors truncate flex-1 mr-2"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-[#968677] shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-[#f0788a] shrink-0" />
                        )}
                        <span className="truncate">{sec.title}</span>
                        <span className="text-[10px] text-[#968677] tabular-nums font-normal">
                          ({sec.messages.length} msg)
                        </span>
                      </button>

                      {/* Restore Button */}
                      <button
                        type="button"
                        onClick={() => restoreSection(sec)}
                        className="inline-flex items-center gap-1 rounded-full border border-[rgba(240,120,138,0.3)] bg-[rgba(240,120,138,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#f0788a] hover:scale-105 active:scale-95 transition-all shrink-0"
                        title="Restore this conversation into the active chat session"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Restore</span>
                      </button>
                    </div>

                    {/* Messages in Section */}
                    {!isCollapsed && (
                      <div className="p-3 space-y-2 max-h-60 overflow-y-auto stash-scrollbar">
                        {sec.messages.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className={`rounded-xl p-2.5 text-xs leading-relaxed ${
                              m.role === "user"
                                ? "border border-[rgba(240,120,138,0.15)] bg-[rgba(240,120,138,0.06)] text-[#fff3e0]"
                                : "border border-[rgba(255,243,224,0.05)] bg-[rgba(34,25,26,0.6)] text-[#dbc9b5]"
                            }`}
                          >
                            <span className="font-bold uppercase tracking-wider text-[10px] text-[#f0788a] block mb-0.5">
                              {m.role === "user" ? "You" : "AI"}
                            </span>
                            <div className="line-clamp-3">{m.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
