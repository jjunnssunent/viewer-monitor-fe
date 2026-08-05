"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError, parseAuthUser, subscribeToAccessDenied, subscribeToAuthExpired, subscribeToAuthRefreshed } from "@/lib/api-client";
import type { AuthUser } from "@/lib/types";
import { useToast } from "./toast-provider";

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  loading: boolean;
  setAuthenticatedUser: (user: AuthUser) => void;
  clearAuthentication: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authExpirationHandledRef = useRef(false);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeToAuthExpired((message) => {
      if (authExpirationHandledRef.current) return;
      authExpirationHandledRef.current = true;

      setUser(null);
      setLoading(false);
      const usageExpired = message?.includes("이용기간") || message?.includes("usage period");
      showToast(usageExpired ? "서비스 이용기간이 만료되었습니다. 관리자에게 문의해주세요." : "로그인이 만료되었습니다. 다시 로그인해주세요.", "error");
      router.replace("/login");
    });

    return unsubscribe;
  }, [router, showToast]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthRefreshed((refreshedUser) => {
      authExpirationHandledRef.current = false;
      setUser(refreshedUser);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAccessDenied((path) => {
      if (!path.startsWith("/api/viewers")) {
        showToast(path === "/api/users/me/links" ? "이용기간 또는 허용 방송 링크를 확인해주세요." : "접근 권한이 없습니다.", "error");
      }
    });

    return unsubscribe;
  }, [showToast]);

  useEffect(() => {
    let active = true;
    apiClient<unknown>("/api/auth/me", { cache: "no-store", suppressAuthExpired: true })
      .then((data) => {
        if (active) {
          authExpirationHandledRef.current = false;
          setUser(parseAuthUser(data));
        }
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        if (!(error instanceof ApiError && error.status === 401) && window.location.pathname !== "/login") {
          showToast(error instanceof Error ? error.message : "인증 상태를 확인하지 못했습니다.", "error");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [showToast]);

  const logout = useCallback(async () => {
    try {
      await apiClient("/api/auth/logout", { method: "POST", cache: "no-store" });
    } catch {
      // 로컬 인증 상태는 서버 응답 여부와 관계없이 반드시 초기화합니다.
    } finally {
      setUser(null);
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const setAuthenticatedUser = useCallback((nextUser: AuthUser) => {
    authExpirationHandledRef.current = false;
    setUser(nextUser);
    setLoading(false);
  }, []);

  const clearAuthentication = useCallback(() => { setUser(null); setLoading(false); }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: user !== null,
    isAdmin: user?.role === "admin",
    isLoading: loading,
    loading,
    setAuthenticatedUser,
    clearAuthentication,
    logout,
  }), [clearAuthentication, loading, logout, setAuthenticatedUser, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
