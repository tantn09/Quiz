import type { Metadata } from "next";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quiz lớp học",
  description: "Tạo bài quiz, giao bài và xem kết quả học tập.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><ThemeBootstrap />{children}</body></html>;
}
