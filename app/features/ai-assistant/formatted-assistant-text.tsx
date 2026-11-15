import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface FormattedAssistantTextProps {
  text: string;
  hasCards?: boolean;
  className?: string;
}

export function FormattedAssistantText({
  text,
  hasCards,
  className,
}: FormattedAssistantTextProps) {
  if (!text) return null;

  // Clean raw text: strip leading headings if cards are present to avoid duplication
  let cleanText = text;
  if (hasCards) {
    cleanText = cleanText
      .replace(/^###\s+[^\n]+\n*/g, '')
      .replace(/\[Click to Book\]\([^)]+\)/g, '')
      .trim();
  }

  const paragraphs = cleanText.split(/\n{2,}/);

  return (
    <div className={`space-y-2 text-sm leading-relaxed ${className ?? ''}`}>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Check if paragraph is a bullet list
        const lines = trimmed.split('\n');
        const isBulletList = lines.every(
          (line) =>
            line.trim().startsWith('- ') || line.trim().startsWith('* '),
        );

        if (isBulletList) {
          return (
            <ul key={pIdx} className="space-y-1.5 pl-1 my-1">
              {lines.map((line, lIdx) => {
                const itemContent = line.trim().replace(/^[-*]\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="text-muted-foreground select-none">•</span>
                    <span>{parseInlineMarkdown(itemContent)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Check if paragraph is a heading
        if (trimmed.startsWith('### ')) {
          const headingText = trimmed.replace(/^###\s+/, '');
          return (
            <h4 key={pIdx} className="font-semibold text-foreground pt-1">
              {parseInlineMarkdown(headingText)}
            </h4>
          );
        }

        return <p key={pIdx}>{parseInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function parseInlineMarkdown(text: string): ReactNode[] {
  // Regex to match **bold**, *italic*, and [link](url)
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch && linkMatch[1] && linkMatch[2]) {
      const label = linkMatch[1];
      const url = linkMatch[2];
      if (url.startsWith('/')) {
        return (
          <Link
            key={index}
            to={url}
            className="text-primary font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {label}
          </Link>
        );
      }
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {label}
        </a>
      );
    }

    return part;
  });
}
