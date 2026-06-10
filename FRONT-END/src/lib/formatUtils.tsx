import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { detectList, detectSteps, detectHeading, splitIntoBlocks, normalizeContent, type DetectedList, type DetectedSteps, type DetectedHeading } from "@/lib/detectors";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Bold regex: **text** or __text__
const BOLD_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;

// Report style heading regex - matches ALL CAPS with underline
const REPORT_TITLE_RE = /^=+\s*([A-Z][A-Z\s]+)\s*=+$/;

// Report section regex - matches numbered sections like "1. DATASET OVERVIEW"
const REPORT_SECTION_RE = /^\d+\.\s+([A-Z][A-Z\s]+)$/;

// Section separator regex - matches lines of dashes
const SECTION_SEPARATOR_RE = /^-+$/;

// Heading regex for markdown headings
const HEADING_RE = /^(#{1,6})\s+(.+)$/;

// Bullet prefix regex for list detection
const BULLET_PREFIX_RE =
  /^(\s*)([-*•‣▪▫–—·]|(?:\(\s*\d+\s*\))|(?:\d{1,2}[.)]))\s+/;

export function parseInlineStyles(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex
  BOLD_RE.lastIndex = 0;

  while ((match = BOLD_RE.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add bold text
    const boldText = match[1] || match[2];
    parts.push(
      <strong key={match.index} className="font-semibold text-foreground">
        {boldText}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export interface ParsedContent {
  type: "paragraph" | "heading" | "list" | "list-item" | "report-title" | "report-section" | "steps";
  level?: number;
  content: string;
  items?: string[];
  steps?: string[];
}

export function parseContent(content: string): ParsedContent[] {
  const normalized = normalizeContent(content);
  const blocks = splitIntoBlocks(normalized);
  
  const parsedLines: ParsedContent[] = [];

  blocks.forEach((block) => {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) return;

    // Check for report title (ALL CAPS with equal signs)
    const titleMatch = trimmedBlock.match(REPORT_TITLE_RE);
    if (titleMatch) {
      parsedLines.push({
        type: "report-title",
        content: titleMatch[1].trim(),
      });
      return;
    }

    // Check for report section (numbered sections like "1. DATASET OVERVIEW")
    const sectionMatch = trimmedBlock.match(REPORT_SECTION_RE);
    if (sectionMatch) {
      parsedLines.push({
        type: "report-section",
        content: sectionMatch[1].trim(),
      });
      return;
    }

    // Check for markdown headings
    const headingMatch = trimmedBlock.match(HEADING_RE);
    if (headingMatch) {
      parsedLines.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      return;
    }

    // Check for steps using detectors.ts
    const detectedSteps = detectSteps(trimmedBlock);
    if (detectedSteps) {
      parsedLines.push({
        type: "steps",
        content: "",
        steps: detectedSteps.steps,
      });
      return;
    }

    // Check for list using detectors.ts
    const detectedList = detectList(trimmedBlock);
    if (detectedList) {
      parsedLines.push({
        type: "list",
        content: "",
        items: detectedList.items,
      });
      return;
    }

    // Check for heading using detectors.ts
    const detectedHeading = detectHeading(trimmedBlock);
    if (detectedHeading) {
      parsedLines.push({
        type: "heading",
        content: detectedHeading.text,
      });
      return;
    }

    // Check for section separator (lines of dashes)
    if (SECTION_SEPARATOR_RE.test(trimmedBlock)) {
      return; // Skip separator lines
    }

    // Default to paragraph
    parsedLines.push({
      type: "paragraph",
      content: trimmedBlock,
    });
  });

  return parsedLines;
}

export function renderListItems(items: string[]): React.ReactNode[] {
  return items.map((item, index) => {
    // Parse inline styles within list items
    const parsedContent = parseInlineStyles(item);
    
    return (
      <li key={index} className="text-sm leading-relaxed">
        {parsedContent}
      </li>
    );
  });
}

export function renderSteps(steps: string[]): React.ReactNode[] {
  return steps.map((step, index) => {
    const parsedContent = parseInlineStyles(step);
    
    return (
      <li key={index} className="text-sm leading-relaxed flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <span>{parsedContent}</span>
      </li>
    );
  });
}

export function renderFormattedContent(content: string): React.ReactNode {
  const parsed = parseContent(content);

  if (parsed.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {parsed.map((item, index) => {
        switch (item.type) {
          case "report-title":
            return (
              <h1
                key={index}
                className="text-[0.8rem] font-bold text-foreground border-b-2 border-primary pb-2"
              >
                {parseInlineStyles(item.content)}
              </h1>
            );

          case "report-section":
            return (
              <h2
                key={index}
                className="text-xl font-semibold text-foreground bg-muted/50 px-3 py-2 rounded-md mt-4"
              >
                {parseInlineStyles(item.content)}
              </h2>
            );

          case "heading":
            const HeadingTag = `h${Math.min(item.level || 2, 6)}` as keyof JSX.IntrinsicElements;
            const headingClasses = {
              1: "text-2xl font-bold text-foreground",
              2: "text-xl font-semibold text-foreground",
              3: "text-lg font-semibold text-foreground",
              4: "text-base font-semibold text-foreground",
              5: "text-sm font-semibold text-foreground",
              6: "text-sm font-semibold text-foreground",
            };
            return (
              <HeadingTag
                key={index}
                className={headingClasses[item.level || 5]}
              >
                {parseInlineStyles(item.content)}
              </HeadingTag>
            );

          case "steps":
            return (
              <ol
                key={index}
                className="list-decimal list-inside space-y-2 ml-2"
              >
                {renderSteps(item.steps || [])}
              </ol>
            );

          case "list":
            return (
              <ul
                key={index}
                className="list-disc list-inside space-y-1 ml-2"
              >
                {renderListItems(item.items || [])}
              </ul>
            );

          case "paragraph":
          default:
            return (
              <p key={index} className="text-sm w-full overflow-hidden text-ellipsis whitespace-pre-wrap">
                {parseInlineStyles(item.content)}
              </p>
            );
        }
      })}
    </div>
  );
}

// Check if content contains styled elements that need special rendering
export function needsSpecialRendering(content: string): boolean {
  const normalized = normalizeContent(content);
  const blocks = splitIntoBlocks(normalized);
  
  return blocks.some((block) => {
    const trimmed = block.trim();
    return (
      trimmed.includes("**") ||
      trimmed.includes("##") ||
      trimmed.includes("# ") ||
      trimmed.includes("=") ||
      REPORT_TITLE_RE.test(trimmed) ||
      REPORT_SECTION_RE.test(trimmed) ||
      detectList(trimmed) !== null ||
      detectSteps(trimmed) !== null ||
      detectHeading(trimmed) !== null ||
      BULLET_PREFIX_RE.test(trimmed)
    );
  });
}
