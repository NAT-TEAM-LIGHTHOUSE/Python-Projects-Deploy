export type DetectedList = {
  kind: "list";
  items: string[];
};

export type DetectedSteps = {
  kind: "steps";
  steps: string[];
};

export type DetectedHeading = {
  kind: "heading";
  text: string;
};

const normalizeNewlines = (input: string) => input.replace(/\r\n?/g, "\n");

export function normalizeContent(input: string): string {
  const content = normalizeNewlines(input)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u00a0/g, " ")
    .trim();

  return content;
}

const BULLET_PREFIX_RE =
  /^(\s*)([-*•‣▪▫–—·]|(?:\(\s*\d+\s*\))|(?:\d{1,2}[.)]))\s+/;

export function detectList(block: string): DetectedList | null {
  const lines = normalizeNewlines(block)
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return null;

  const bulletLines = lines
    .map((line) => {
      const m = line.match(BULLET_PREFIX_RE);
      if (!m) return null;
      const item = line.slice(m[0].length).trim();
      return item.length ? item : null;
    })
    .filter((x): x is string => Boolean(x));

  if (bulletLines.length >= 2 && bulletLines.length / lines.length >= 0.6) {
    return { kind: "list", items: bulletLines };
  }

  return null;
}

const EXPLICIT_STEP_RE =
  /^(?:\s*(?:step\s*)?)((?:\d{1,2})|(?:[A-Za-z]))[.)\]:-]\s+(.+)$/i;

const WORKFLOW_HINT_RE =
  /\b(then|next|after|before|finally|first|second|third|if|else|when|once|otherwise|in case)\b/i;

const SEPARATOR_LINE_RE = /^[-=]{5,}$/;

const isMeaningfulStepText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (SEPARATOR_LINE_RE.test(trimmed)) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;

  const punctuationChars = (trimmed.match(/[-=_.:]/g) || []).length;
  if (punctuationChars / Math.max(trimmed.length, 1) > 0.5) return false;

  return true;
};

export function detectSteps(block: string): DetectedSteps | null {
  const raw = normalizeNewlines(block).trim();
  if (!raw) return null;

  // Skip if code block present
  if (/```[\s\S]*?```/.test(raw)) return null;
  // Skip if SQL or code-like
  if (/(SELECT|FROM|WHERE|GROUP BY|INSERT|UPDATE|DELETE)/i.test(raw)) return null;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 3) return null;
  if (lines.some((line) => SEPARATOR_LINE_RE.test(line))) return null;
  if (lines.filter((line) => /[A-Za-z]/.test(line)).length < 2) return null;

  // Prefer explicit numbering ("1.", "Step 1:", "A)")
  const explicit: string[] = [];
  for (const line of lines) {
    const m = line.match(EXPLICIT_STEP_RE);
    if (!m) {
      explicit.length = 0;
      break;
    }
    const candidate = m[2].trim();
    if (!isMeaningfulStepText(candidate)) {
      explicit.length = 0;
      break;
    }
    explicit.push(candidate);
  }
  if (explicit.length >= 3) return { kind: "steps", steps: explicit };

  // Heuristic workflow detection: multi-line short actions with connectors.
  const looksLikeList = lines.some((l) => BULLET_PREFIX_RE.test(l));
  if (looksLikeList) return null;

  const shortLines = lines.filter(
    (l) => l.length >= 3 && l.length <= 140 && isMeaningfulStepText(l)
  );
  const hasWorkflowHints = WORKFLOW_HINT_RE.test(raw);

  // Only promote plain multi-line text to "steps" when it contains
  // actual workflow-style hints. Ordinary assistant sentences should
  // stay as paragraphs, not numbered badges.
  if (shortLines.length >= 3 && shortLines.length / lines.length >= 0.75 && hasWorkflowHints) {
    return { kind: "steps", steps: shortLines };
  }

  return null;
}

export function detectHeading(block: string): DetectedHeading | null {
  const raw = normalizeNewlines(block).trim();
  if (!raw) return null;
  if (raw.includes("\n")) return null;
  if (raw.length < 4 || raw.length > 90) return null;

  const text = raw.replace(/^\s*#+\s*/, "").trim();
  if (!text) return null;

  if (text.endsWith("?") || text.endsWith(":")) {
    return { kind: "heading", text };
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const titleLike =
    /^[A-Z][A-Za-z0-9\s/&(),.-]{2,}$/.test(text) && !text.endsWith(".");

  if (titleLike && wordCount >= 2 && wordCount <= 10) {
    return { kind: "heading", text };
  }

  return null;
}

export function splitIntoBlocks(input: string): string[] {
  // Extract code blocks first
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks: string[] = [];
  let text = input;
  let match;
  let idx = 0;
  // Replace code blocks with placeholders
  text = text.replace(codeBlockRegex, (m) => {
    codeBlocks.push(m);
    return `[[CODEBLOCK_${idx++}]]`;
  });
  // Split remaining text by double newlines
  let blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  // Reinsert code blocks
  blocks = blocks.map(b => {
    const codeMatch = b.match(/^\[\[CODEBLOCK_(\d+)\]\]$/);
    if (codeMatch) {
      const codeIdx = parseInt(codeMatch[1], 10);
      return codeBlocks[codeIdx];
    }
    return b;
  });
  return blocks;
}

