import type { UserRole } from "./types";

export type NavigationItem = { label: string; href: string };

export const navigationByRole = {
  admin: [
    { label: "사용자 관리", href: "/admin/users" },
    { label: "관리자 관리", href: "/admin/administrators" },
    { label: "플랫폼 계정 관리", href: "/admin/platform-accounts" },
    { label: "시청자 프로그램", href: "/admin/monitor" },
  ],
  user: [
    { label: "시청자 프로그램", href: "/monitor" },
    { label: "마이페이지", href: "/mypage" },
    { label: "내 플랫폼 계정", href: "/mypage/platform-accounts" },
  ],
} satisfies Record<UserRole, NavigationItem[]>;
