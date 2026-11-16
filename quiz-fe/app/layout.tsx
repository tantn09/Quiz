import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap", variable: "--font-be-vietnam-pro" });

export const metadata: Metadata = {
  title: "Quiz lớp học",
  description: "Tạo bài quiz, giao bài và xem kết quả học tập.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: 'try{var theme=localStorage.getItem("quiz-theme");if(theme==="dark"||theme==="light")document.documentElement.dataset.theme=theme}catch(e){}' }} /></head><body className={beVietnamPro.variable}><ThemeBootstrap />{children}</body></html>;
}
