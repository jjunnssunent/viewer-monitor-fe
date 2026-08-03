"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigationByRole } from "@/lib/navigation";
import { useAuth } from "./auth-provider";
import { useToast } from "./toast-provider";

export function UserNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  if (!user || user.role !== "user" || pathname === "/login" || pathname.startsWith("/admin")) return null;
  async function handleLogout() { if (loggingOut) return; setLoggingOut(true); try { await logout(); } finally { setLoggingOut(false); } }
  const viewerExpired = !user.usageExpiresAt || new Date(user.usageExpiresAt).getTime() <= currentTime;
  return <div className="global-user-nav-wrap"><nav className="monitor-navbar" aria-label="사용자 메뉴"><Link className="monitor-brand" href="/monitor"><span>SP</span><strong>StreamPulse</strong></Link><div className="monitor-nav-links">{navigationByRole.user.map((item) => { const disabled = item.href === "/monitor" && viewerExpired; return <Link aria-disabled={disabled} className={`${pathname === item.href ? "active" : ""} ${disabled ? "disabled" : ""}`.trim()} href={item.href} key={item.href} onClick={(event) => { if (!disabled) return; event.preventDefault(); showToast("이용기간이 만료되어 시청자 프로그램을 사용할 수 없습니다.", "error"); }}>{item.label}{disabled && <small>기간 만료</small>}</Link>; })}<button type="button" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "로그아웃 중..." : "로그아웃"}</button></div></nav></div>;
}
