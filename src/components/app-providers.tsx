"use client";

import { AuthProvider } from "./auth-provider";
import { ToastProvider } from "./toast-provider";
import { UserNavbar } from "./user-navbar";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider><AuthProvider><UserNavbar />{children}</AuthProvider></ToastProvider>;
}
