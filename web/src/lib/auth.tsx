"use client";

// Purpose: Client auth context — role-gated login, password change flag, logout.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearAuthStorage, setToken } from "./api";
import type { AuthUser, Role } from "./types";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, expectedRole: Role) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(data: AuthUser & { student?: { id: string }; teacher?: { id: string } }): AuthUser {
  return {
    id: data.id,
    fullName: data.fullName,
    email: data.email,
    role: data.role,
    mustChangePassword: Boolean(data.mustChangePassword),
    schoolId: data.schoolId ?? null,
    studentId: data.studentId ?? data.student?.id ?? null,
    teacherId: data.teacherId ?? data.teacher?.id ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{
        success: true;
        data: AuthUser & { student?: { id: string }; teacher?: { id: string } };
      }>("/api/auth/me");
      setUser(mapUser(res.data));
    } catch {
      // Invalid / expired token — treat as logged out.
      clearAuthStorage();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sms_token") : null;
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Only restore a session after /api/auth/me succeeds with this token.
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, expectedRole: Role) => {
    const res = await api<{
      success: true;
      data: { token: string; user: AuthUser };
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, expectedRole }),
    });
    setToken(res.data.token);
    const mapped = mapUser(res.data.user);
    setUser(mapped);
    return mapped;
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPath(role: Role) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "ADMIN") return "/dashboard/admin";
  if (role === "TEACHER") return "/dashboard/teacher";
  return "/dashboard/student";
}

export function loginPath(role: Role) {
  if (role === "SUPER_ADMIN") return "/admin/login";
  if (role === "ADMIN") return "/login/admin";
  if (role === "TEACHER") return "/login/teacher";
  return "/login/student";
}
