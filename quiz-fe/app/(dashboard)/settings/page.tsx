"use client";

import { useErrorToast } from "@/components/ui/toast";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardContent, DashboardLoading } from "@/components/dashboard-shell";
import { applyLanguage, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { TeacherCatalogFields } from "@/components/teacher-catalog-fields";
import { Modal } from "@/components/modal";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Profile = { role: "admin" | "teacher"; username: string; displayName: string; email: string | null; subject: string | null; workplace: string | null; language: "vi" | "en"; theme: "light" | "dark" };

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslation();
  const showError = useErrorToast();
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [dialog, setDialog] = useState<"profile" | "password" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const translate = useRef(t);
  useEffect(() => { translate.current = t; }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/me", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const { user } = await response.json() as { user: Profile };
      if (controller.signal.aborted) return;
      setProfile(user);
      applyLanguage(user.language);
      localStorage.setItem("quiz-theme", user.theme);
      document.documentElement.dataset.theme = user.theme;
    }).catch(() => {
      if (!controller.signal.aborted) showError(translate.current("Không tải được thông tin tài khoản."));
    }).finally(() => {
      if (!controller.signal.aborted) setInitialLoading(false);
    });
    return () => controller.abort();
  }, [showError]);

  async function updatePreferences(next: { language?: Profile["language"]; theme?: Profile["theme"] }) {
    if (!profile || preferencesBusy || (next.language ?? profile.language) === profile.language && (next.theme ?? profile.theme) === profile.theme) return;
    setPreferencesSaved(false);
    setPreferencesBusy(true);
    try {
      const response = await fetch("/api/auth/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error();
      setProfile((current) => current ? { ...current, ...next } : current);
      if (next.language) applyLanguage(next.language);
      if (next.theme) {
        localStorage.setItem("quiz-theme", next.theme);
        document.documentElement.dataset.theme = next.theme;
      }
      setPreferencesSaved(true);
    } catch { showError(t("Không lưu được cài đặt.")); }
    finally { setPreferencesBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    setProfileSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace") }) });
      if (response.status === 400 && (await response.json().catch(() => ({}))).error === "invalid_catalog_selection") { showError(t("Bộ môn hoặc nơi công tác đã thay đổi. Hãy tải lại trang để chọn lại.")); return; }
      if (response.status === 409) { showError(t("Email đã được sử dụng.")); return; }
      if (!response.ok) { showError(t("Không lưu được thông tin tài khoản.")); return; }
      const { user } = await response.json();
      setProfile((current) => current ? { ...current, ...user } : current);
      setProfileSaved(true);
      setDialog(null);
    } catch { showError(t("Không lưu được thông tin tài khoản.")); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    if (form.get("newPassword") !== form.get("confirmPassword")) { setError(t("Mật khẩu xác nhận không khớp.")); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }) });
      if (response.ok) { router.replace("/login"); return; }
      const body = await response.json();
      showError(body.error === "invalid_current_password" ? t("Mật khẩu hiện tại không đúng.") : t("Không đổi được mật khẩu. Mật khẩu mới cần ít nhất 10 ký tự."));
    } catch { showError(t("Không đổi được mật khẩu. Mật khẩu mới cần ít nhất 10 ký tự.")); }
    finally { setBusy(false); }
  }

  function closeDialog() {
    if (busy) return;
    setError("");
    setDialog(null);
  }

  if (initialLoading) return <DashboardLoading />;

  return <DashboardContent compact>
    <PageHeader title={t("Cài đặt")} />
    {profile && <div className="mt-6 grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{t("Thông tin tài khoản")}</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog("profile")}>{t("Sửa hồ sơ")}</Button>
        </div>
        <dl className="mt-3 divide-y divide-line">
          {([
            ["Tên đăng nhập", profile.username],
            ["Họ tên", profile.displayName],
            ["Email", profile.email],
            ["Bộ môn", profile.subject],
            ["Nơi công tác", profile.workplace],
          ] as const).map(([label, value]) => <div key={label} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-content-muted">{t(label)}</dt>
            <dd className="font-medium [overflow-wrap:anywhere]">{value || "—"}</dd>
          </div>)}
        </dl>
        <div className="mt-1 border-t border-line pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setDialog("password")}>{t("Đổi mật khẩu")}</Button>
        </div>
        {profileSaved && <p role="status" className="mt-3 text-sm text-success">{t("Đã cập nhật thông tin tài khoản.")}</p>}
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">{t("Tùy chọn")}</h2>
        <div className="mt-3 divide-y divide-line">
          <div className="grid items-center gap-2 py-2.5 sm:grid-cols-[1fr_minmax(8rem,1fr)]">
            <p className="text-sm font-medium">{t("Ngôn ngữ")}</p>
            <Select value={profile.language} ariaLabel={t("Ngôn ngữ")} disabled={preferencesBusy}
              options={[{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }]}
              onValueChange={(value) => { if (value === "vi" || value === "en") void updatePreferences({ language: value }); }} />
          </div>
          <div className="grid items-center gap-2 py-2.5 sm:grid-cols-[1fr_minmax(8rem,1fr)]">
            <p className="text-sm font-medium">{t("Giao diện")}</p>
            <Select value={profile.theme} ariaLabel={t("Giao diện")} disabled={preferencesBusy}
              options={[{ value: "light", label: t("Sáng") }, { value: "dark", label: t("Tối") }]}
              onValueChange={(value) => { if (value === "light" || value === "dark") void updatePreferences({ theme: value }); }} />
          </div>
        </div>
        <p role="status" className={"text-sm " + (preferencesSaved ? "text-success" : "text-content-muted")}>
          {preferencesBusy ? t("Đang lưu…") : preferencesSaved ? t("Đã lưu cài đặt.") : ""}
        </p>
      </section>
    </div>}
    {profile && dialog === "profile" && <Modal title={t("Sửa hồ sơ")} closeLabel={t("Đóng")} onClose={closeDialog}>
      <form onSubmit={saveProfile} className="grid gap-4">
        <label className="text-sm font-medium">{t("Họ tên")}<Input name="displayName" autoComplete="name" defaultValue={profile.displayName} maxLength={160} required className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Email")}<Input name="email" type="email" defaultValue={profile.email ?? ""} maxLength={254} autoComplete="email" className="mt-2" /></label>
        <TeacherCatalogFields subject={profile.subject} workplace={profile.workplace} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={closeDialog}>{t("Hủy")}</Button>
          <Button type="submit" disabled={busy}>{t(busy ? "Đang lưu…" : "Lưu thông tin")}</Button>
        </div>
      </form>
    </Modal>}
    {dialog === "password" && <Modal title={t("Đổi mật khẩu")} closeLabel={t("Đóng")} onClose={closeDialog}>
      <p className="mb-4 text-sm text-content-muted">{t("Sau khi đổi mật khẩu, bạn cần đăng nhập lại.")}</p>
      <form onSubmit={changePassword} className="grid gap-4">
        <label className="text-sm font-medium">{t("Mật khẩu hiện tại")}<Input name="currentPassword" type="password" autoComplete="current-password" required className="mt-2" /></label>
        <label className="text-sm font-medium">{t("Mật khẩu mới")}<Input name="newPassword" type="password" autoComplete="new-password" minLength={10} required className="mt-2" onChange={() => setError("")} /></label>
        <label className="text-sm font-medium">{t("Xác nhận mật khẩu mới")}
          <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required className="mt-2"
            aria-invalid={Boolean(error)} aria-describedby={error ? "settings-password-error" : undefined} onChange={() => setError("")} />
          {error && <span id="settings-password-error" role="alert" className="mt-2 block text-error">{error}</span>}
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={closeDialog}>{t("Hủy")}</Button>
          <Button type="submit" disabled={busy}>{t(busy ? "Đang lưu…" : "Đổi mật khẩu")}</Button>
        </div>
      </form>
    </Modal>}
  </DashboardContent>;
}
