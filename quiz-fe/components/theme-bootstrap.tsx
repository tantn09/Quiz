"use client";

import { useEffect } from "react";

export function ThemeBootstrap() {
  useEffect(() => {
    const applyPreferences = () => {
      const theme = localStorage.getItem("quiz-theme");
      const language = localStorage.getItem("quiz-language");
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      if (language === "vi" || language === "en") {
        document.documentElement.lang = language;
        document.title = language === "en" ? "Classroom Quiz" : "Quiz lớp học";
        document.querySelector('meta[name="description"]')?.setAttribute("content", language === "en" ? "Create quizzes, share links, and review student results." : "Tạo bài quiz, giao bài và xem kết quả học tập.");
      }
    };
    applyPreferences();
    window.addEventListener("quiz-language-change", applyPreferences);
    return () => window.removeEventListener("quiz-language-change", applyPreferences);
  }, []);
  return null;
}
