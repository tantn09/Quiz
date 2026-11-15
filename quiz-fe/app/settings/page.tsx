"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { applyLanguage, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Profile = { username: string; displayName: string; email: string | null; subject: string | null; workplace: string | null; language: "vi" | "en"; theme: "light" | "dark" };

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("profile");
      return response.json();
    }).then(({ user }) => {
      setProfile(user);
      applyLanguage(user.language);
      localStorage.setItem("quiz-theme", user.theme);
      document.documentElement.lang = user.language;
      document.documentElement.dataset.theme = user.theme;
    }).catch(() => setError(t("Không tải được thông tin tài khoản.")));
  }, [t]);

  async function updatePreferences(next: { language?: "vi" | "en"; theme?: "light" | "dark" }) {
    setError(""); setMessage("");
    const response = await fetch("/api/auth/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) { setError(t("Không lưu được cài đặt.")); return; }
    setProfile((current) => current ? { ...current, ...next } : current);
    if (next.language) { applyLanguage(next.language); document.documentElement.lang = next.language; }
    if (next.theme) { localStorage.setItem("quiz-theme", next.theme); document.documentElement.dataset.theme = next.theme; }
    setMessage(t("Đã lưu cài đặt."));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace") }) });
      if (response.status === 409) { setError(t("Email đã được sử dụng.")); return; }
      if (!response.ok) { setError(t("Không lưu được thông tin tài khoản.")); return; }
      const { user } = await response.json();
      setProfile((current) => current ? { ...current, ...user } : current);
      setMessage(t("Đã cập nhật thông tin tài khoản."));
    } catch { setError(t("Không lưu được thông tin tài khoản.")); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError(t("Mật khẩu xác nhận không khớp.")); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      if (response.ok) { router.replace("/login"); return; }
      const body = await response.json();
      setError(body.error === "invalid_current_password" ? t("Mật khẩu hiện tại không đúng.") : t("Không đổi được mật khẩu. Mật khẩu mới cần ít nhất 10 ký tự."));
    } catch { setError(t("Không đổi được mật khẩu. Mật khẩu mới cần ít nhất 10 ký tự.")); }
    finally { setBusy(false); formElement.reset(); }
  }

  return <><DashboardNav /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-5xl">
    <PageHeader title={t("Cài đặt")} description={t("Quản lý tài khoản, mật khẩu, ngôn ngữ và giao diện của bạn.")} />
    {message && <Alert className="mt-4">{message}</Alert>}
    {error && <Alert tone="error" className="mt-4">{error}</Alert>}
    {profile && <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><h2 className="text-lg font-bold">{t("Thông tin tài khoản")}</h2><p className="mt-1 text-sm text-content-muted">{t("Tên đăng nhập")}: {profile.username}</p><div className="mt-5 grid gap-4">
        <label className="text-sm font-medium">{t("Họ tên")}<Input name="displayName" defaultValue={profile.displayName} maxLength={160} required className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Email")}<Input name="email" type="email" defaultValue={profile.email ?? ""} maxLength={254} autoComplete="email" className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Bộ môn")}<Input name="subject" defaultValue={profile.subject ?? ""} maxLength={120} className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Nơi công tác")}<Input name="workplace" defaultValue={profile.workplace ?? ""} maxLength={200} className="mt-2" /></label>
        <Button disabled={busy} className="mt-1">{t("Lưu thông tin")}</Button>
      </div></form>
      <form onSubmit={changePassword} className="rounded-2xl border border-line bg-surface p-5 sm:p-6"><h2 className="text-lg font-bold">{t("Đổi mật khẩu")}</h2><p className="mt-1 text-sm text-content-muted">{t("Sau khi đổi mật khẩu, bạn cần đăng nhập lại.")}</p><div className="mt-5 grid gap-4">
        <label className="text-sm font-medium">{t("Mật khẩu hiện tại")}<Input name="currentPassword" type="password" autoComplete="current-password" required className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Mật khẩu mới")}<Input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Xác nhận mật khẩu mới")}<Input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required className="mt-2" /></label>
        <Button disabled={busy} className="mt-1">{t("Đổi mật khẩu")}</Button>
      </div></form>
    </div>}
    {profile && <section className="mt-5 grid gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-bold">{t("Ngôn ngữ")}</h2><div className="mt-4 flex gap-2"><button aria-pressed={profile.language === "vi"} onClick={() => void updatePreferences({ language: "vi" })} className={`rounded-xl border px-4 py-3 ${profile.language === "vi" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Tiếng Việt")}</button><button aria-pressed={profile.language === "en"} onClick={() => void updatePreferences({ language: "en" })} className={`rounded-xl border px-4 py-3 ${profile.language === "en" ? "border-blue-600 text-brand" : "border-line"}`}>English</button></div></div><div className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-bold">{t("Giao diện")}</h2><div className="mt-4 flex gap-2"><button aria-pressed={profile.theme === "light"} onClick={() => void updatePreferences({ theme: "light" })} className={`rounded-xl border px-4 py-3 ${profile.theme === "light" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Sáng")}</button><button aria-pressed={profile.theme === "dark"} onClick={() => void updatePreferences({ theme: "dark" })} className={`rounded-xl border px-4 py-3 ${profile.theme === "dark" ? "border-blue-600 text-brand" : "border-line"}`}>{t("Tối")}</button></div></div></section>}
  </div></main></>;
}
