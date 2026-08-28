import React from "react";

interface MarkdownRendererProps {
  content: string;
  variant?: "basic" | "notes";
}

export function MarkdownRenderer({
  content,
  variant = "notes",
}: MarkdownRendererProps) {
  if (!content) return null;
  const fullMarkdown = variant === "notes";

  const isSafeHref = (href: string) =>
    /^(https?:|mailto:|tel:)/i.test(href.trim());

  const parseInline = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    const regex =
      /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

    while (remaining) {
      const match = remaining.match(regex);
      if (!match) {
        tokens.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      const matchIdx = match.index ?? 0;
      if (matchIdx > 0) {
        tokens.push(<span key={keyIdx++}>{remaining.slice(0, matchIdx)}</span>);
      }

      const matchedText = match[0];
      if (matchedText.startsWith("**") && matchedText.endsWith("**")) {
        tokens.push(
          <strong key={keyIdx++} className="font-semibold text-foreground">
            {parseInline(matchedText.slice(2, -2))}
          </strong>,
        );
      } else if (matchedText.startsWith("~~") && matchedText.endsWith("~~")) {
        tokens.push(
          <del key={keyIdx++} className="text-foreground/70">
            {parseInline(matchedText.slice(2, -2))}
          </del>,
        );
      } else if (
        (matchedText.startsWith("*") && matchedText.endsWith("*")) ||
        (matchedText.startsWith("_") && matchedText.endsWith("_"))
      ) {
        tokens.push(
          <em key={keyIdx++}>{parseInline(matchedText.slice(1, -1))}</em>,
        );
      } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
        tokens.push(
          <code
            key={keyIdx++}
            className="px-1 py-0.5 rounded bg-muted/60 text-xs font-mono font-medium text-foreground"
          >
            {matchedText.slice(1, -1)}
          </code>,
        );
      } else if (matchedText.startsWith("[") && matchedText.includes("](")) {
        const closeBrack = matchedText.indexOf("]");
        const label = matchedText.slice(1, closeBrack);
        const url = matchedText.slice(closeBrack + 2, -1).trim();
        const safeUrl = isSafeHref(url) ? url : "#";
        tokens.push(
          <a
            key={keyIdx++}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary/80 hover:decoration-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {parseInline(label)}
          </a>,
        );
      }

      remaining = remaining.slice(matchIdx + matchedText.length);
    }

    return tokens;
  };

  const getBlocks = (raw: string) => {
    const lines = raw.replace(/\r\n/g, "\n").split("\n");
    const blocks: string[] = [];
    let current: string[] = [];
    let inFence = false;

    const flush = () => {
      if (!current.length) return;
      blocks.push(current.join("\n"));
      current = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (fullMarkdown && trimmed.startsWith("```")) {
        current.push(line);
        inFence = !inFence;
        if (!inFence) flush();
        continue;
      }
      if (inFence) {
        current.push(line);
        continue;
      }
      if (!trimmed) {
        flush();
        continue;
      }
      if (
        /^#{1,3}\s/.test(trimmed) ||
        (fullMarkdown && /^---+$/.test(trimmed)) ||
        (fullMarkdown && /^>\s?/.test(trimmed))
      ) {
        flush();
        blocks.push(line);
        continue;
      }
      const currentIsList = current.every((item) =>
        /^(\s*[-*]\s+|\s*\d+\.\s+|\s*[-*]\s+\[[ xX]\]\s+)/.test(item),
      );
      const lineIsList =
        /^(\s*[-*]\s+|\s*\d+\.\s+|\s*[-*]\s+\[[ xX]\]\s+)/.test(line);
      if (current.length && currentIsList !== lineIsList) flush();
      current.push(line);
    }
    flush();
    return blocks;
  };

  const renderBlock = (block: string, blockIdx: number) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Code block
    if (fullMarkdown && trimmed.startsWith("```") && trimmed.endsWith("```")) {
      const lines = trimmed.split("\n");
      const codeLines = lines.slice(1, -1).join("\n");
      return (
        <pre
          key={blockIdx}
          className="stash-scrollbar p-3 my-2 rounded-lg bg-surface border border-border/40 font-mono text-xs overflow-x-auto text-foreground/90"
        >
          <code>{codeLines}</code>
        </pre>
      );
    }

    if (fullMarkdown && /^---+$/.test(trimmed)) {
      return <hr key={blockIdx} className="my-3 border-border/60" />;
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      return (
        <h1
          key={blockIdx}
          className="text-xl font-bold font-display mt-4 mb-2 text-foreground"
        >
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={blockIdx}
          className="text-lg font-bold font-display mt-3 mb-2 text-foreground"
        >
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3
          key={blockIdx}
          className="text-base font-bold font-display mt-3 mb-1.5 text-foreground"
        >
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    }

    if (fullMarkdown && trimmed.startsWith(">")) {
      const quote = trimmed
        .split("\n")
        .map((line) => line.replace(/^>\s?/, ""))
        .join("\n");
      return (
        <blockquote
          key={blockIdx}
          className="my-2 border-l-2 border-primary/60 pl-3 text-foreground/80"
        >
          {quote.split("\n").map((line, lineIdx) => (
            <React.Fragment key={lineIdx}>
              {lineIdx > 0 && <br />}
              {parseInline(line)}
            </React.Fragment>
          ))}
        </blockquote>
      );
    }

    // Task list
    if (fullMarkdown && /^[-*]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const items = trimmed.split("\n");
      return (
        <ul key={blockIdx} className="my-2 space-y-1 text-foreground/80">
          {items.map((item, itemIdx) => {
            const checked = /^[-*]\s+\[[xX]\]\s+/.test(item);
            const label = item.replace(/^[-*]\s+\[[ xX]\]\s+/, "");
            return (
              <li key={itemIdx} className="flex gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mt-0.5 h-3.5 w-3.5 accent-primary"
                />
                <span>{parseInline(label)}</span>
              </li>
            );
          })}
        </ul>
      );
    }

    // Bullet list
    if (
      trimmed.startsWith("* ") ||
      trimmed.startsWith("- ") ||
      trimmed.startsWith("• ")
    ) {
      const items = trimmed.split("\n");
      return (
        <ul
          key={blockIdx}
          className="list-disc pl-5 my-2 space-y-1 text-foreground/80"
        >
          {items.map((item, itemIdx) => {
            // Clean up prefix if any
            const cleaned = item.replace(/^[*\-•]\s+/, "");
            return <li key={itemIdx}>{parseInline(cleaned)}</li>;
          })}
        </ul>
      );
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = trimmed.split("\n");
      return (
        <ol
          key={blockIdx}
          className="list-decimal pl-5 my-2 space-y-1 text-foreground/80"
        >
          {items.map((item, itemIdx) => {
            const cleaned = item.replace(/^\d+\.\s+/, "");
            return <li key={itemIdx}>{parseInline(cleaned)}</li>;
          })}
        </ol>
      );
    }

    // Paragraph (may contain line breaks inside it)
    const lines = trimmed.split("\n");
    return (
      <p key={blockIdx} className="my-1.5 leading-relaxed text-foreground/95">
        {lines.map((line, lineIdx) => (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && <br />}
            {parseInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  };

  return (
    <div className="space-y-2">
      {getBlocks(content).map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}
