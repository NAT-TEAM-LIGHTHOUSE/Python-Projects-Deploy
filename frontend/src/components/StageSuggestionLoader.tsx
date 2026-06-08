import { Database, TableProperties, Sparkles, CheckCircle2 } from "lucide-react";

const SUGGESTION_STAGES = [
  { label: "Reading your dataset", icon: Database },
  { label: "Analyzing columns & types", icon: TableProperties },
  { label: "Generating suggestions", icon: Sparkles },
];

interface SuggestionStageLoaderProps {
  currentStage: number;
}

export function SuggestionStageLoader({ currentStage }: SuggestionStageLoaderProps) {
  return (
    <div className="flex flex-col gap-3 py-4">
      {SUGGESTION_STAGES.map((stage, i) => {
        const isActive = i === currentStage;
        const isDone = i < currentStage;
        const Icon = stage.icon;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
              isActive
                ? "border-primary/40 bg-primary/5"
                : isDone
                ? "border-border bg-muted/40"
                : "border-border/50 bg-muted/20 opacity-50"
            }`}
          >
            <div className="shrink-0">
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : (
                <span className={isActive ? "flex rounded-full animate-[heartbeat_1.2s_ease-in-out_infinite]" : "flex"}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-primary drop-shadow-[0_0_10px_rgba(244,63,94,0.35)]" : "text-muted-foreground"}`} />
                </span>
              )}
            </div>
            <span className={`text-sm font-medium ${isDone ? "text-muted-foreground" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
              {stage.label}
            </span>
            {isActive && (
              <span className="inline-flex items-center gap-[3px] ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[loader-bounce_0.9s_cubic-bezier(0.34,1.56,0.64,1)_infinite]" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[loader-bounce_0.9s_cubic-bezier(0.34,1.56,0.64,1)_infinite]" style={{ animationDelay: "120ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[loader-bounce_0.9s_cubic-bezier(0.34,1.56,0.64,1)_infinite]" style={{ animationDelay: "240ms" }} />
              </span>
            )}
          </div>
        );
      })}
      <style>{`
        @keyframes loader-bounce {
          0%, 100% {
            transform: translateY(0) scale(0.9);
            opacity: 0.55;
          }
          35% {
            transform: translateY(-5px) scale(1.2);
            opacity: 1;
          }
          65% {
            transform: translateY(1px) scale(0.95);
            opacity: 0.85;
          }
        }

        @keyframes heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.16);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.12);
          }
          70% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
