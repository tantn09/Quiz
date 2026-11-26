"use client";

import { useEffect } from "react";

export function ThemeBootstrap() {
  useEffect(() => {
    const applyPreferences = () => {
      let theme: string | null, language: string | null;
      try {
        theme = localStorage.getItem("quiz-theme");
        language = localStorage.getItem("quiz-language");
      } catch { return; }
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      if (language === "vi" || language === "en") {
        document.documentElement.lang = language;
        if (window.location.pathname !== "/") return;
        document.title = language === "en" ? "Classroom Quiz" : "Bài kiểm tra lớp học";
        document.querySelector('meta[name="description"]')?.setAttribute("content", language === "en" ? "Create quizzes, share links, and review student results." : "Tạo bài kiểm tra, giao bài và xem kết quả học tập.");
      }
    };
    applyPreferences();
    window.addEventListener("quiz-language-change", applyPreferences);
    return () => window.removeEventListener("quiz-language-change", applyPreferences);
  }, []);
  return null;
}
