"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { TeacherCatalogFields } from "@/components/teacher-catalog-fields";
import { Alert } from "@/components/ui/alert";

export default function RegisterPage() {
  const t = useTranslation();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    if (form.get("password") !== form.get("confirmPassword")) { setError(t("Mật khẩu xác nhận không khớp.")); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), username: form.get("username"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace"), password: form.get("password") }) });
      if (response.ok) { setDone(true); return; }
      const body = await response.json();
      if (body.error === "invalid_catalog_selection") { setError(t("Bộ môn hoặc nơi công tác đã thay đổi. Hãy tải lại trang để chọn lại.")); return; }
      setError(response.status === 409 ? body.error === "email_exists" ? t("Email đã được sử dụng.") : t("Tên đăng nhập đã tồn tại.") : response.status === 429 ? t("Bạn thử lại sau ít phút.") : t("Không tạo được tài khoản. Hãy kiểm tra thông tin đã nhập."));
    } catch { setError(t("Không tạo được tài khoản. Hãy thử lại sau.")); }
    finally { setBusy(false); }
  }

  return <main className="ds-gradient-soft flex min-h-screen items-center justify-center px-5 py-10"><div className="w-full max-w-xl rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-brand">{t("BÀI KIỂM TRA LỚP HỌC")}</p>
    {done ? <><h1 className="mt-3 text-3xl font-bold">{t("Đăng ký thành công")}</h1><Alert className="mt-5">{t("Tài khoản của bạn đang chờ admin duyệt. Bạn có thể đăng nhập sau khi được kích hoạt.")}</Alert><Link href="/login" className="mt-6 inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">{t("Về trang đăng nhập")}</Link></> : <>
      <h1 className="mt-3 text-3xl font-bold">{t("Đăng ký giáo viên")}</h1><p className="mt-2 text-content-muted">{t("Tạo tài khoản để quản lý bài kiểm tra. Admin sẽ duyệt trước khi bạn đăng nhập.")}</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">{t("Họ tên")}<Input name="displayName" required maxLength={160} autoComplete="name" className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Tên đăng nhập")}<Input name="username" required minLength={3} maxLength={80} autoComplete="username" className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Email")}<Input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2" /></label>
        <TeacherCatalogFields registration />
        <label className="text-sm font-medium">{t("Mật khẩu")}<Input name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Xác nhận mật khẩu mới")}<Input name="confirmPassword" type="password" required minLength={10} maxLength={200} autoComplete="new-password" className="mt-2" /></label>
        {error && <Alert tone="error" className="sm:col-span-2">{error}</Alert>}
        <Button disabled={busy} className="mt-2 w-full sm:col-span-2">{busy ? t("Đang tạo…") : t("Tạo tài khoản")}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-content-muted">{t("Đã có tài khoản?")} <Link href="/login" className="font-semibold text-brand underline underline-offset-4">{t("Đăng nhập")}</Link></p>
    </>}
  </div></main>;
}
