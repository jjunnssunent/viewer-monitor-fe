"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { useToast } from "./toast-provider";

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const accessToastShown = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (!loading && adminOnly && user?.role !== "admin") {
      if (!accessToastShown.current) {
        accessToastShown.current = true;
        showToast("관리자만 접근할 수 있습니다.", "error");
      }
      router.replace("/monitor");
    }
  }, [adminOnly, loading, router, showToast, user]);

  if (loading || !user) return <main className="loading-screen">로그인 상태를 확인하고 있습니다.</main>;
  if (adminOnly && user.role !== "admin") return <main className="loading-screen">시청자 프로그램으로 이동하고 있습니다.</main>;
  return children;
}
