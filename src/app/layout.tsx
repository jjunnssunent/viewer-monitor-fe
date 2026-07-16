import type { Metadata } from "next";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamPulse",
  description: "실시간 멀티 플랫폼 방송 모니터링 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
