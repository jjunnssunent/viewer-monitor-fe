import type { UserRole } from "./types";

export type NavigationItem = { label: string; href: string };

export const navigationByRole = {
  admin: [
    { label: "사용자 관리", href: "/admin/users" },
    { label: "관리자 관리", href: "/admin/administrators" },
    { label: "플랫폼 계정 관리", href: "/admin/platform-accounts" },
    { label: "방송 모니터", href: "/admin/monitor" },
  ],
  user: [
    { label: "방송 모니터", href: "/monitor" },
    { label: "마이페이지", href: "/mypage" },
  ],
} satisfies Record<UserRole, NavigationItem[]>;
