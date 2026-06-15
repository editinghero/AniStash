import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split into blocks by double newlines or lines starting with structural elements
  const blocks = content.split(/\n\n+/);

  const parseInline = (text: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    // Matches **bold**, *italic*, _italic_, `code`
    const regex = /(\*\*.*?\*\*|\*.*?\*|_.*?_|`.*?`|\[.*?\]\(.*?\))/;

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
            {matchedText.slice(2, -2)}
          </strong>
        );
      } else if (
        (matchedText.startsWith("*") && matchedText.endsWith("*")) ||
        (matchedText.startsWith("_") && matchedText.endsWith("_"))
      ) {
        tokens.push(<em key={keyIdx++}>{matchedText.slice(1, -1)}</em>);
      } else if (matchedText.startsWith("`") && matchedText.endsWith("`")) {
        tokens.push(
          <code key={keyIdx++} className="px-1 py-0.5 rounded bg-muted/60 text-xs font-mono font-medium text-foreground">
            {matchedText.slice(1, -1)}
          </code>
        );
      } else if (matchedText.startsWith("[") && matchedText.includes("](")) {
        const closeBrack = matchedText.indexOf("]");
        const label = matchedText.slice(1, closeBrack);
        const url = matchedText.slice(closeBrack + 2, -1);
        tokens.push(
          <a
            key={keyIdx++}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-status-planning hover:underline font-medium break-all"
          >
            {label}
          </a>
        );
      }

      remaining = remaining.slice(matchIdx + matchedText.length);
    }

    return tokens;
  };

  const renderBlock = (block: string, blockIdx: number) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Code block
    if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
      const lines = trimmed.split("\n");
      const codeLines = lines.slice(1, -1).join("\n");
      return (
        <pre key={blockIdx} className="p-3 my-2 rounded-lg bg-surface border border-border/40 font-mono text-xs overflow-x-auto text-foreground/90">
          <code>{codeLines}</code>
        </pre>
      );
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      return (
        <h1 key={blockIdx} className="text-xl font-bold font-display mt-4 mb-2 text-foreground">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={blockIdx} className="text-lg font-bold font-display mt-3 mb-2 text-foreground">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    }
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={blockIdx} className="text-base font-bold font-display mt-3 mb-1.5 text-foreground">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    }

    // Bullet list
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const items = trimmed.split(/\n[*\-•]\s+/);
      return (
        <ul key={blockIdx} className="list-disc pl-5 my-2 space-y-1 text-foreground/80">
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
      const items = trimmed.split(/\n\d+\.\s+/);
      return (
        <ol key={blockIdx} className="list-decimal pl-5 my-2 space-y-1 text-foreground/80">
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

  return <div className="space-y-2">{blocks.map((block, idx) => renderBlock(block, idx))}</div>;
}
