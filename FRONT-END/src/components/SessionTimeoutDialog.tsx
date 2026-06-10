import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import "./SessionTimeoutDialog.css";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_COUNTDOWN_SECONDS = 60;

type SessionTimeoutDialogProps = {
  sessionId?: string | null;
  isEnabled?: boolean;
  idleTimeoutMs?: number;
  countdownSeconds?: number;
  apiBase?: string;
  apiPrefix?: string;
  onSessionExpired?: () => void;
  onLogout?: () => void;
};

export default function SessionTimeoutDialog({
  sessionId,
  isEnabled = true,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  countdownSeconds = DEFAULT_COUNTDOWN_SECONDS,
  apiBase = import.meta.env.VITE_SQL_GPT_API_BASE || import.meta.env.VITE_API_BASE || "http://localhost:5010",
  apiPrefix = "/api/agentai/sql_gpt",
  onSessionExpired,
  onLogout,
}: SessionTimeoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const deleteRequestedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  }, []);

  const deleteSession = useCallback(async () => {
    const normalizedSessionId = (sessionId || "").trim();
    if (!normalizedSessionId || deleteRequestedRef.current) return;

    deleteRequestedRef.current = true;

    try {
      await fetch(`${apiBase}${apiPrefix}/session/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ref_no: normalizedSessionId }),
        keepalive: true,
      });
    } catch (error) {
      console.error("Failed to delete expired session", error);
    }
  }, [apiBase, apiPrefix, sessionId]);

  const finalizeSession = useCallback(async (expired: boolean) => {
    clearTimers();
    setOpen(false);
    await deleteSession();

    if (expired) {
      onSessionExpired?.();
    } else {
      onLogout?.();
    }
  }, [clearTimers, deleteSession, onLogout, onSessionExpired]);

  const startIdleTimer = useCallback(() => {
    clearTimers();

    if (!isEnabled || !sessionId) return;

    idleTimer.current = setTimeout(() => {
      setSecondsLeft(countdownSeconds);
      setOpen(true);

      countdownInterval.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            void finalizeSession(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, idleTimeoutMs);
  }, [clearTimers, countdownSeconds, finalizeSession, idleTimeoutMs, isEnabled, sessionId]);

  const handleKeepLoggedIn = useCallback(() => {
    deleteRequestedRef.current = false;
    clearTimers();
    setOpen(false);
    setSecondsLeft(countdownSeconds);
    startIdleTimer();
  }, [clearTimers, countdownSeconds, startIdleTimer]);

  const handleLogout = useCallback(() => {
    void finalizeSession(false);
  }, [finalizeSession]);

  useEffect(() => {
    if (!isEnabled || !sessionId) {
      clearTimers();
      setOpen(false);
      return;
    }

    deleteRequestedRef.current = false;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    const resetIdle = () => {
      if (!open) {
        startIdleTimer();
      }
    };

    events.forEach((eventName) => window.addEventListener(eventName, resetIdle));
    startIdleTimer();

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdle));
      clearTimers();
    };
  }, [clearTimers, isEnabled, open, sessionId, startIdleTimer]);

  if (!isEnabled || !sessionId) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const progress = secondsLeft / countdownSeconds;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="session-timeout-dialog"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="session-timeout-header">
          <DialogTitle className="session-timeout-title">Session timeout</DialogTitle>
          <DialogDescription className="session-timeout-description text-muted-foreground">
            You have been inactive for a while. When the countdown ends, this session will be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="session-timeout-visual">
          <div className="session-timeout-ring">
            <svg className="session-timeout-svg" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="hsl(var(--foreground))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className="session-timeout-progress"
              />
            </svg>
            <span className="session-timeout-time">
              {display}
            </span>
          </div>
        </div>

        <DialogFooter className="session-timeout-footer">
          <Button onClick={handleKeepLoggedIn} className="session-timeout-button">
            Keep session
          </Button>
          <Button variant="outline" onClick={handleLogout} className="session-timeout-button">
            Delete session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
