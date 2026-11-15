"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyLanguage, useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
      });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error === "pending_approval" ? t("Tài khoản đang chờ admin duyệt.") : t("Tên đăng nhập hoặc mật khẩu chưa đúng.")); }
      const { user } = await response.json();
      localStorage.setItem("quiz-theme", user.theme);
      applyLanguage(user.language);
      document.documentElement.dataset.theme = user.theme;
      document.documentElement.lang = user.language;
      router.replace(user.role === "admin" ? "/admin" : "/teacher");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Không thể đăng nhập lúc này."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ds-gradient-soft flex min-h-screen items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold text-brand">{t("QUIZ LỚP HỌC")}</p>
        <h1 className="mt-3 text-3xl font-bold">{t("Đăng nhập")}</h1>
        <p className="mt-2 text-content-muted">{t("Dành cho Admin và giáo viên.")}</p>
        <label className="mt-7 block text-sm font-medium">{t("Tên đăng nhập")}
          <Input name="username" autoComplete="username" required className="mt-2" />
        </label>
        <label className="mt-4 block text-sm font-medium">{t("Mật khẩu")}
          <Input name="password" type="password" autoComplete="current-password" required className="mt-2" />
        </label>
        {error && <Alert tone="error" className="mt-4">{error}</Alert>}
        <Button disabled={busy} className="mt-6 w-full">{busy ? t("Đang đăng nhập…") : t("Đăng nhập")}</Button>
        <p className="mt-6 text-center text-sm text-content-muted">{t("Chưa có tài khoản?")} <Link href="/register" className="font-semibold text-brand underline underline-offset-4">{t("Đăng ký giáo viên")}</Link></p>
      </form>
    </main>
  );
}
