import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Brain, Eye, EyeOff, Loader2, LockKeyhole, Search, Zap } from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import brandLogoImg from "../assets/images/lhs-logo.svg";

const REMEMBER_ME_STORAGE_KEY = "rag_remembered_login";
const API_BASE = import.meta.env.VITE_API_BASE || "";

type LoginMode = "normal" | "client";

interface BrandLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

function BrandLogo({
  src = brandLogoImg,
  alt = "Lighthouse AI",
  className = "h-12 w-auto rounded-lg",
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
        LH
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setImgError(true)} loading="eager" />;
}

export default function LoginPage() {
  const { isAuthenticated, login, user } = useAuth();
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("normal");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isVerifyingSession, setIsVerifyingSession] = useState(isAuthenticated);
  const [sessionValid, setSessionValid] = useState(false);

  const appKeyBoost = (import.meta.env.VITE_LHSBOOST_APPKEY as string | undefined) || "LHSBOOSTN";
  const appKeyCare = (import.meta.env.VITE_LHSCARE_APPKEY as string | undefined) || "LHSCAREV7";

  const appkeyForMode = useMemo(() => (mode === "client" ? appKeyCare : appKeyBoost), [mode, appKeyBoost, appKeyCare]);
  const rememberKey = useMemo(() => `${REMEMBER_ME_STORAGE_KEY}:${mode}`, [mode]);

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  useEffect(() => {
    setError("");
    const savedCredentials = localStorage.getItem(rememberKey);
    if (!savedCredentials) {
      setEmail("");
      setPassword("");
      setRememberMe(false);
      return;
    }

    try {
      const parsed = JSON.parse(savedCredentials) as { email?: string; password?: string };
      setEmail(parsed.email ?? "");
      setPassword(parsed.password ?? "");
      setRememberMe(Boolean(parsed.email || parsed.password));
    } catch {
      localStorage.removeItem(rememberKey);
    }
  }, [rememberKey]);

  useEffect(() => {
    if (!rememberMe) {
      localStorage.removeItem(rememberKey);
    }
  }, [rememberMe, rememberKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsVerifyingSession(false);
      return;
    }

    const validateExistingSession = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("auth_token") || localStorage.getItem("access_token") || "";
        
        const response = await fetch(`${API_BASE}/api/auth/validate`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          setSessionValid(true);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("access_token");
          setIsVerifyingSession(false);
        }
      } catch (error) {
        console.error("Session validation failed:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("access_token");
        setIsVerifyingSession(false);
      }
    };

    validateExistingSession();
  }, [isAuthenticated]);

  if (sessionValid) {
    return <Navigate to="/web/agentai/process_gpt" replace />;
  }

  if (isVerifyingSession) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login(email, password, { appkey: appkeyForMode });
      if (rememberMe) {
        localStorage.setItem(rememberKey, JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem(rememberKey);
      }
      navigate("/web/agentai/process_gpt", { replace: true });
    } catch {
      setError("Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Brain,
      title: "Natural Language to SQL",
      description: "Describe what you need — SQL GPT writes accurate, optimized queries for you.",
    },
    {
      icon: Search,
      title: "Schema-Aware Intelligence",
      description: "Understands your tables, joins and relationships across multiple databases.",
    },
    {
      icon: Zap,
      title: "Instant Query Execution",
      description: "Run, refine and visualize results in real time with conversational context.",
    },
    {
      icon: LockKeyhole,
      title: "Secure Multi-DB Access",
      description: "Role-based connections to multiple TNS environments with full audit trails.",
    },
  ] as const;

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen w-full lg:grid-cols-2">
        <div className="relative flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* <div className="flex items-center gap-4">
              <BrandLogo className="h-14 w-auto" />
              <div>
                <h1 className="text-2xl font-extrabold text-foreground">SQL GPT</h1>
                <div className="text-sm text-muted-foreground">Query smarter, not harder</div>
              </div>
            </div> */}

             <div className="mt-6 rounded-2xl border bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              {error ? (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-sm">
                      Enter your LHSBOOST/LHSESS username and password to log in
                    </p>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Username
                    </Label>
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter your username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={255}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        maxLength={128}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember-me" className="text-sm font-medium">
                      Remember Me
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[linear-gradient(90deg,_#7C3AED_0%,_#A855F7_35%,_#F43F5E_80%)] text-white"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Sign In
                  </Button>

                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    Powered by Lighthouse ERP • Knowledge Base Platform
                  </p>

                </form>
              }
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-background via-background to-violet-50/40 px-6 py-12 lg:border-l lg:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(180deg,rgba(250,243,255,0.65),rgba(255,244,245,0.65))]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(to_right,rgba(236,72,153,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(236,72,153,0.06)_1px,transparent_1px)] [background-size:28px_28px]"
          />

          <div className="relative w-full max-w-lg">
            <h2 className="text-3xl font-extrabold tracking-tight text-violet-600 sm:text-4xl">SQL GPT</h2>
            <p className="mt-3 text-sm text-foreground/80 sm:text-base">
              Turn plain English into precise SQL. Explore, query, and understand your data faster than ever.
            </p>

            <div className="mt-8 space-y-6 sm:mt-10">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="flex gap-4 rounded-2xl border bg-background/95 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100/60 p-3 text-violet-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">{f.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{f.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
