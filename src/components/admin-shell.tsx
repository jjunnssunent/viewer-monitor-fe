"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { ProtectedRoute } from "./protected-route";
import { navigationByRole } from "@/lib/navigation";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); } finally { setLoggingOut(false); }
  }
  return (
    <ProtectedRoute adminOnly>
      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="brand"><span className="brand-mark">SP</span><span><strong>StreamPulse</strong><small>ADMIN CONSOLE</small></span></div>
          <nav className="admin-nav">
            {(user ? navigationByRole[user.role] : []).map((item) => <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}
          </nav>
          <div className="sidebar-user">
            <span className="muted">현재 관리자</span>
            <strong>{user?.username}</strong>
            <button className="secondary full" type="button" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "로그아웃 중..." : "로그아웃"}</button>
          </div>
        </aside>
        <main className="admin-content">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
