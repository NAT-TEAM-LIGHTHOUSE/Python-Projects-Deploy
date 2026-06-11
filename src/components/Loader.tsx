import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function Loader({ size = "md", text, className }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
      </div>
      <span className="text-sm text-muted-foreground ml-2">Analyzing...</span>
    </div>
  );
}

interface SuggestionLoaderProps {
  text?: string;
}

export function SuggestionLoader({ text = "Generating suggestions" }: SuggestionLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-12 gap-4">
      <div className="relative flex items-center justify-center gap-1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="w-3 h-3 rounded-full bg-primary animate-pulse"
            style={{
              animationDelay: `${index * 0.2}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}
