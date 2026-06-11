import {
  Database,
  TableProperties,
  Brain,
  MessageSquare,
  BarChart3,
  Map,
  Code2,
  Play,
  SearchCheck,
  Wrench,
  FileText,
  Sparkles,
} from "lucide-react";

const STAGES = [
  { key: "database_login", label: "Validating database session", icon: Database },
  { key: "load_selected_objects", label: "Loading selected table or view", icon: TableProperties },
  { key: "load_metadata_prompt_files", label: "Reading metadata guidance", icon: Map },
  { key: "schema_extraction", label: "Understanding table structure", icon: TableProperties },
  { key: "agent_initialization", label: "Preparing SQL agents", icon: Wrench },
  { key: "user_query_submission", label: "Receiving your question", icon: MessageSquare },
  { key: "intent_understanding", label: "Detecting user intent", icon: Brain },
  { key: "metadata_mapping", label: "Mapping business terms", icon: SearchCheck },
  { key: "sql_generation", label: "Generating SQL", icon: Code2 },
  { key: "sql_validation", label: "Validating SQL", icon: Play },
  { key: "query_execution", label: "Executing query", icon: Database },
  { key: "result_analysis", label: "Analyzing results", icon: BarChart3 },
  { key: "nlp_response_generation", label: "Generating answer", icon: FileText },
] as const;

interface StageLoaderProps {
  currentStage?: string;
}

export function StageLoader({ currentStage }: StageLoaderProps) {
  const activeIndex = currentStage
    ? STAGES.findIndex((s) => s.key === currentStage)
    : 0;

  const stage = STAGES[Math.max(0, activeIndex)] ?? STAGES[0];
  const ActiveIcon = stage.icon;

  return (
    <div className="flex items-start gap-3 px-1 py-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div className="relative w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-primary/10 border border-primary/20 overflow-hidden">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping opacity-60" />
        <div
          className="absolute inset-[2px] rounded-full border border-primary/20 border-t-primary/70 border-r-primary/45"
          style={{ animation: "spin 1.8s linear infinite" }}
        />
        <div className="absolute inset-[3px] rounded-full bg-gradient-to-br from-primary/20 via-background to-primary/10" />
        <div
          className="relative z-10 flex items-center justify-center"
          style={{ animation: "spin 4s linear infinite" }}
        >
          <Sparkles
            className="w-4 h-4 text-primary"
            style={{ animation: "pulse 1.2s ease-in-out infinite" }}
          />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center gap-2.5 bg-muted/60 border border-border/50 rounded-2xl rounded-tl-sm pl-3.5 pr-4 py-3 min-w-[240px] shadow-sm backdrop-blur-sm">
          <div className="inline-flex items-center gap-2.5">
            <div className="relative shrink-0 w-5 h-5">
              <div className="absolute inset-0 rounded-full bg-primary/15 animate-ping" />
              <div className="absolute inset-[3px] rounded-full bg-primary/10" />
              <ActiveIcon
                className="relative z-10 w-5 h-5 text-primary animate-pulse"
                key={stage.key}
              />
            </div>

            <span className="text-sm text-foreground/85 font-medium">
              {stage.label}
            </span>

            <span className="inline-flex items-center gap-[4px] ml-0.5">
              <span
                className="w-2 h-2 rounded-full bg-primary/90 animate-bounce"
                style={{ animationDelay: "0ms", animationDuration: "700ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary/75 animate-bounce"
                style={{ animationDelay: "140ms", animationDuration: "700ms" }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: "280ms", animationDuration: "700ms" }}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
