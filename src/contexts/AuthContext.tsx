import { createContext, useContext, useState, type ReactNode } from "react";

interface User {
  user_code: string;
  wma_user_name: string;
  session_id: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (userId: string, password: string, options?: { appkey?: string }) => Promise<void>;
  dbLogin: (tns: string, dbUsername: string, dbPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (userId: string, password: string, options?: { appkey?: string }) => {
    const apiBase = import.meta.env.VITE_API_BASE || "";
    const payload = {
      user_id: userId,
      password: password,
      app_key: options?.appkey,
    };

    // Debug: log payload (avoid printing sensitive data in production)
    // eslint-disable-next-line no-console
    console.debug("AuthContext.login payload:", { ...payload, password: "[REDACTED]" });

    const response = await fetch(`${apiBase}/api/agentai/sql_gpt/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errMsg = "Authentication failed";
      try {
        const error = await response.json();
        errMsg = error.message || JSON.stringify(error);
      } catch (e) {
        // ignore
      }
      // eslint-disable-next-line no-console
      console.debug("AuthContext.login error:", response.status, errMsg);
      throw new Error(errMsg);
    }

    const data = await response.json();
    const userData: User = {
      user_code: data.user_code || "",
      wma_user_name: data.wma_user_name || "",
      session_id: data.session_id || "",
      role: data.role || "viewer",
    };
    setUser(userData);
    localStorage.setItem("auth_user", JSON.stringify(userData));
  };

  const dbLogin = async (tns: string, dbUsername: string, dbPassword: string) => {
    const apiBase = import.meta.env.VITE_API_BASE || "";
    const response = await fetch(`${apiBase}/api/v1/auth/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tns,
        username: dbUsername,
        password: dbPassword,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "DB connection failed");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("auth_user");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, dbLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}