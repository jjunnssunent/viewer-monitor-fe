"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navigationByRole } from "@/lib/navigation";
import { useAuth } from "./auth-provider";

export function UserNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user || user.role !== "user" || pathname === "/login" || pathname.startsWith("/admin")) return null;
  async function handleLogout() { if (loggingOut) return; setLoggingOut(true); try { await logout(); } finally { setLoggingOut(false); } }
  return <div className="global-user-nav-wrap"><nav className="monitor-navbar" aria-label="사용자 메뉴"><Link className="monitor-brand" href="/monitor"><span>SP</span><strong>StreamPulse</strong></Link><div className="monitor-nav-links">{navigationByRole.user.map((item) => <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}<button type="button" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "로그아웃 중..." : "로그아웃"}</button></div></nav></div>;
}
