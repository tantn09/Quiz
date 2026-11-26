import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { ErrorToastProvider } from "@/components/ui/toast";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap", variable: "--font-be-vietnam-pro" });

export const metadata: Metadata = {
  title: "Bài kiểm tra lớp học",
  description: "Tạo bài kiểm tra, giao bài và xem kết quả học tập.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: 'try{var theme=localStorage.getItem("quiz-theme");document.documentElement.dataset.theme=theme==="dark"||theme==="light"?theme:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}' }} /></head><body className={beVietnamPro.variable}><ThemeBootstrap /><ErrorToastProvider>{children}</ErrorToastProvider></body></html>;
}
