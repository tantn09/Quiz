"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

type Teacher = { id: string; username: string; displayName: string; email: string | null; subject: string | null; workplace: string | null; status: "active" | "locked" | "pending"; createdAt: string };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [formError, setFormError] = useState("");
  const t = useTranslation();

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    const response = await fetch(`/api/admin/teachers?${query}`, { cache: "no-store" });
    if (!response.ok) { setMessage(t("Không tải được danh sách giáo viên.")); return; }
    setTeachers((await response.json()).teachers);
  }, [search, status, t]);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setFormError("");
    const form = new FormData(formElement);
    let response: Response;
    try {
      response = await fetch("/api/admin/teachers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace"), password: form.get("password") }) });
    } catch { setFormError(t("Không tạo được tài khoản. Hãy kiểm tra mật khẩu có ít nhất 10 ký tự.")); setBusy(false); return; }
    setBusy(false);
    if (response.status === 409) { const body = await response.json(); setFormError(body.error === "email_exists" ? t("Email đã được sử dụng.") : t("Tên đăng nhập đã tồn tại.")); return; }
    if (!response.ok) { setFormError(t("Không tạo được tài khoản. Hãy kiểm tra mật khẩu có ít nhất 10 ký tự.")); return; }
    formElement.reset();
    setFormOpen(false);
    setMessage(t("Đã tạo tài khoản giáo viên."));
    await load();
  }

  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setFormError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/teachers/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace") }) });
      if (!response.ok) { setFormError(response.status === 409 ? t("Email đã được sử dụng.") : t("Không lưu được thông tin tài khoản.")); return; }
      setEditing(null); setMessage(t("Đã cập nhật thông tin tài khoản.")); await load();
    } catch { setFormError(t("Không lưu được thông tin tài khoản.")); }
    finally { setBusy(false); }
  }

  async function setLocked(teacher: Teacher) {
    const next = teacher.status === "active" ? "locked" : "active";
    const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    if (!response.ok) { setMessage(t("Không cập nhật được trạng thái tài khoản.")); return; }
    await load();
  }

  async function rejectTeacher(teacher: Teacher) {
    const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "locked" }) });
    if (!response.ok) { setMessage(t("Không cập nhật được trạng thái tài khoản.")); return; }
    await load();
  }

  async function resetPassword(teacher: Teacher) {
    const password = window.prompt(`${t("Mật khẩu mới cho")} ${teacher.displayName} (${t("ít nhất 10 ký tự")}):`);
    if (!password) return;
    const response = await fetch(`/api/admin/teachers/${teacher.id}/reset-password`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    setMessage(response.ok ? t("Đã đặt lại mật khẩu.") : t("Không đặt lại được mật khẩu. Mật khẩu cần ít nhất 10 ký tự."));
  }

  return <><DashboardNav admin /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    <PageHeader title={t("Quản lý giáo viên")} description={t("Tạo tài khoản, tìm kiếm và quản lý quyền truy cập.")} action={<Button type="button" onClick={() => { setFormError(""); setFormOpen(true); }}>{t("Thêm giáo viên")}</Button>} />
    {message && <Alert className="mt-4">{message}</Alert>}
    {formOpen && <Modal title={t("Thêm giáo viên")} closeLabel={t("Đóng")} onClose={() => { if (!busy) { setFormOpen(false); setFormError(""); } }}><form onSubmit={create} className="grid gap-4">
        {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}</p>}
        <label className="text-sm font-medium">{t("Họ tên giáo viên")}<input name="displayName" required className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Tên đăng nhập")}<input name="username" required minLength={3} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Email")}<input name="email" type="email" maxLength={254} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Bộ môn")}<input name="subject" maxLength={120} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Nơi công tác")}<input name="workplace" maxLength={200} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Mật khẩu tạm thời")}<input name="password" required minLength={10} type="password" className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <button disabled={busy} className="rounded-xl ds-gradient px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? t("Đang tạo…") : t("Tạo tài khoản")}</button>
      </form></Modal>}
    {editing && <Modal title={t("Sửa thông tin giáo viên")} closeLabel={t("Đóng")} onClose={() => { if (!busy) { setEditing(null); setFormError(""); } }}><form onSubmit={saveTeacher} className="grid gap-4">
      {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}</p>}
      <label className="text-sm font-medium">{t("Họ tên")}<input name="displayName" defaultValue={editing.displayName} required maxLength={160} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <label className="text-sm font-medium">{t("Email")}<input name="email" type="email" defaultValue={editing.email ?? ""} maxLength={254} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <label className="text-sm font-medium">{t("Bộ môn")}<input name="subject" defaultValue={editing.subject ?? ""} maxLength={120} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <label className="text-sm font-medium">{t("Nơi công tác")}<input name="workplace" defaultValue={editing.workplace ?? ""} maxLength={200} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <button disabled={busy} className="rounded-xl ds-gradient px-4 py-3 font-semibold text-white disabled:opacity-60">{t("Lưu thông tin")}</button>
    </form></Modal>}
    <section className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm theo tên hoặc tài khoản")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "pending", label: t("Chờ duyệt") }, { value: "active", label: t("Đang hoạt động") }, { value: "locked", label: t("Đã khóa") }]} className="sm:w-56" /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-line text-content-muted"><tr><th className="py-3 pr-4">{t("Giáo viên")}</th><th className="py-3 pr-4">{t("Tài khoản")}</th><th className="py-3 pr-4">{t("Email")}</th><th className="py-3 pr-4">{t("Bộ môn")}</th><th className="py-3 pr-4">{t("Trạng thái")}</th><th className="py-3">{t("Thao tác")}</th></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id} className="border-b border-line"><td className="py-4 pr-4 font-medium">{teacher.displayName}<span className="block text-xs text-content-muted">{teacher.workplace}</span></td><td className="py-4 pr-4">{teacher.username}</td><td className="py-4 pr-4">{teacher.email}</td><td className="py-4 pr-4">{teacher.subject}</td><td className="py-4 pr-4">{teacher.status === "pending" ? t("Chờ duyệt") : teacher.status === "active" ? t("Đang hoạt động") : t("Đã khóa")}</td><td className="py-4"><div className="flex gap-2"><button onClick={() => { setFormError(""); setEditing(teacher); }} className="rounded-lg border border-line px-3 py-2">{t("Sửa")}</button><button onClick={() => void setLocked(teacher)} className="rounded-lg border border-line px-3 py-2">{teacher.status === "pending" ? t("Duyệt") : teacher.status === "active" ? t("Khóa") : t("Mở khóa")}</button>{teacher.status === "pending" && <button onClick={() => void rejectTeacher(teacher)} className="rounded-lg border border-line px-3 py-2">{t("Từ chối")}</button>}<button onClick={() => void resetPassword(teacher)} className="rounded-lg border border-line px-3 py-2">{t("Đặt mật khẩu")}</button></div></td></tr>)}{teachers.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-content-muted">{t("Chưa có giáo viên phù hợp.")}</td></tr>}</tbody></table></div>
    </section>
  </div></main></>;
}
