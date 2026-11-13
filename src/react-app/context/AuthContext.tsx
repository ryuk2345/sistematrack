import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@/shared/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, passwordOrPin: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  redirectToGoogleLogin: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("sistematrack_user");
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("sistematrack_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/users/me", { headers });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem("sistematrack_user", JSON.stringify(userData));
      } else if (res.status === 401) {
        setUser(null);
        localStorage.removeItem("sistematrack_user");
        localStorage.removeItem("sistematrack_token");
      }
    } catch (err) {
      console.error("Error fetching user session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, passwordOrPin: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: passwordOrPin }),
      });

      let data: any = {};
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch (_) {
        return {
          success: false,
          error: resText.slice(0, 100) || ("Error HTTP " + res.status),
        };
      }

      if (!res.ok) {
        return { success: false, error: data.error || "Credenciales incorrectas" };
      }

      if (data.token) {
        localStorage.setItem("sistematrack_token", data.token);
      }
      if (data.user) {
        localStorage.setItem("sistematrack_user", JSON.stringify(data.user));
        setUser(data.user);
      }

      return { success: true, user: data.user };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error al conectar con el servidor",
      };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem("sistematrack_user");
      localStorage.removeItem("sistematrack_token");
      await fetch("/api/auth/logout", { method: "POST" });
      await fetch("/api/logout").catch(() => {});
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      window.location.href = "/";
    }
  };

  const redirectToGoogleLogin = async () => {
    try {
      const res = await fetch("/api/oauth/google/redirect_url");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Google OAuth aún no está configurado");
      }
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      alert("Autenticación de Google pendiente de configuración en Cloudflare. Usa el acceso con Usuario y Contraseña.");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        redirectToGoogleLogin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
