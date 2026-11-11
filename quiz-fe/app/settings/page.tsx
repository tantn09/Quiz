"use client";

import { useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { applyLanguage, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";

export default function SettingsPage() {
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [message, setMessage] = useState("");
  const t = useTranslation();

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then(({ user }) => {
      setLanguage(user.language);
      setTheme(user.theme);
      applyLanguage(user.language);
      localStorage.setItem("quiz-theme", user.theme);
      document.documentElement.lang = user.language;
      document.documentElement.dataset.theme = user.theme;
    });
  }, []);

  async function update(next: { language?: "vi" | "en"; theme?: "light" | "dark" }) {
    const response = await fetch("/api/auth/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) { setMessage(t("Không lưu được cài đặt.")); return; }
    if (next.language) { setLanguage(next.language); applyLanguage(next.language); }
    if (next.theme) { setTheme(next.theme); localStorage.setItem("quiz-theme", next.theme); document.documentElement.dataset.theme = next.theme; }
    setMessage(next.language === "en" ? "Settings saved." : next.language === "vi" ? "Đã lưu cài đặt." : t("Đã lưu cài đặt."));
  }

  return <><DashboardNav /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-5xl"><PageHeader title={t("Cài đặt")} description={t("Tùy chỉnh ngôn ngữ và giao diện cho tài khoản của bạn.")} />{message && <Alert className="mt-4">{message}</Alert>}<section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-bold">{t("Ngôn ngữ")}</h2><div className="mt-4 flex gap-2"><button aria-pressed={language === "vi"} onClick={() => void update({ language: "vi" })} className={`rounded-xl border px-4 py-3 ${language === "vi" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Tiếng Việt")}</button><button aria-pressed={language === "en"} onClick={() => void update({ language: "en" })} className={`rounded-xl border px-4 py-3 ${language === "en" ? "border-blue-600 text-brand" : "border-line"}`}>English</button></div></div><div className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-bold">{t("Giao diện")}</h2><div className="mt-4 flex gap-2"><button aria-pressed={theme === "light"} onClick={() => void update({ theme: "light" })} className={`rounded-xl border px-4 py-3 ${theme === "light" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Sáng")}</button><button aria-pressed={theme === "dark"} onClick={() => void update({ theme: "dark" })} className={`rounded-xl border px-4 py-3 ${theme === "dark" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Tối")}</button></div></div></section></div></main></>;
}
