"use client";

import { useErrorToast } from "@/components/ui/toast";
import { Table } from "@/components/ui/table";
import { Input } from "@/components/ui/field";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardContent, DashboardLoading } from "@/components/dashboard-shell";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { TeacherCatalogFields } from "@/components/teacher-catalog-fields";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

type Teacher = { id: string; username: string; displayName: string; email: string | null; subject: string | null; workplace: string | null; status: "active" | "locked" | "pending"; createdAt: string };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("status") === "pending") setStatus("pending");
  }, []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const t = useTranslation();
  const showError = useErrorToast();

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const loadRequest = useRef<AbortController | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Teacher | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    setLoadState("loading");
    try {
      const response = await fetch(`/api/admin/teachers?${query}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (controller.signal.aborted) return;
      setTeachers(data.teachers);
      setLoadState("ready");
    } catch {
      if (!controller.signal.aborted) setLoadState("error");
    } finally {
      if (!controller.signal.aborted) setInitialLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
    return () => loadRequest.current?.abort();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    const form = new FormData(formElement);
    let response: Response;
    try {
      response = await fetch("/api/admin/teachers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace"), password: form.get("password") }) });
    } catch { showError(t("Không tạo được tài khoản. Hãy kiểm tra mật khẩu có ít nhất 10 ký tự.")); setBusy(false); return; }
    setBusy(false);
    if (response.status === 400 && (await response.clone().json().catch(() => ({}))).error === "invalid_catalog_selection") { showError(t("Bộ môn hoặc nơi công tác đã thay đổi. Hãy mở lại biểu mẫu để chọn lại.")); return; }
    if (response.status === 409) { const body = await response.json(); showError(body.error === "email_exists" ? t("Email đã được sử dụng.") : t("Tên đăng nhập đã tồn tại.")); return; }
    if (!response.ok) { showError(t("Không tạo được tài khoản. Hãy kiểm tra mật khẩu có ít nhất 10 ký tự.")); return; }
    formElement.reset();
    setFormOpen(false);
    setMessage(t("Đã tạo tài khoản giáo viên."));
    await load();
  }

  async function saveTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/admin/teachers/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: form.get("displayName"), email: form.get("email"), subject: form.get("subject"), workplace: form.get("workplace") }) });
      if (response.status === 400 && (await response.clone().json().catch(() => ({}))).error === "invalid_catalog_selection") { showError(t("Bộ môn hoặc nơi công tác đã thay đổi. Hãy mở lại biểu mẫu để chọn lại.")); return; }
      if (!response.ok) { showError(response.status === 409 ? t("Email đã được sử dụng.") : t("Không lưu được thông tin tài khoản.")); return; }
      setEditing(null); setMessage(t("Đã cập nhật thông tin tài khoản.")); await load();
    } catch { showError(t("Không lưu được thông tin tài khoản.")); }
    finally { setBusy(false); }
  }

  async function setLocked(teacher: Teacher) {
    const next = teacher.status === "active" ? "locked" : "active";
    const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    if (!response.ok) { showError(t("Không cập nhật được trạng thái tài khoản.")); return; }
    await load();
  }

  async function rejectTeacher(teacher: Teacher) {
    const response = await fetch(`/api/admin/teachers/${teacher.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "locked" }) });
    if (!response.ok) { showError(t("Không cập nhật được trạng thái tài khoản.")); return; }
    await load();
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordTarget || busy) return;
    const password = new FormData(event.currentTarget).get("password");
    setBusy(true);
    setPasswordError("");
    try {
      const response = await fetch(`/api/admin/teachers/${passwordTarget.id}/reset-password`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error();
      setMessage(t("Đã đặt lại mật khẩu."));
      setPasswordTarget(null);
    } catch {
      setPasswordError(t("Không thể đặt lại mật khẩu. Hãy thử lại."));
    } finally {
      setBusy(false);
    }
  }

  if (initialLoading) return <DashboardLoading />;

  return <DashboardContent>
    <PageHeader title={t("Quản lý giáo viên")} description={t("Tạo tài khoản, tìm kiếm và quản lý quyền truy cập.")} action={<Button type="button" onClick={() => { setFormOpen(true); }}>{t("Thêm giáo viên")}</Button>} />
    {message && <Alert className="mt-4">{message}</Alert>}
    {passwordTarget && <Modal title={t("Đặt mật khẩu") + " · " + passwordTarget.displayName} closeLabel={t("Đóng")} onClose={() => { if (!busy) setPasswordTarget(null); }}>
      <form onSubmit={resetPassword} className="space-y-4">
        <label className="block text-sm font-medium">{t("Mật khẩu mới")}
          <Input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={200} required disabled={busy} className="mt-2" aria-describedby={passwordError ? "reset-password-error" : "reset-password-hint"} />
        </label>
        <p id="reset-password-hint" className="text-sm text-content-muted">{t("ít nhất 10 ký tự")}</p>
        {passwordError && <p id="reset-password-error" role="alert">{passwordError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setPasswordTarget(null)}>{t("Hủy")}</Button>
          <Button type="submit" disabled={busy}>{t(busy ? "Đang lưu…" : "Đặt mật khẩu")}</Button>
        </div>
      </form>
    </Modal>}
    {formOpen && <Modal title={t("Thêm giáo viên")} closeLabel={t("Đóng")} onClose={() => { if (!busy) { setFormOpen(false); } }}><form onSubmit={create} className="grid gap-4">

        <label className="text-sm font-medium">{t("Họ tên giáo viên")}<Input name="displayName" required className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Tên đăng nhập")}<Input name="username" required minLength={3} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <label className="text-sm font-medium">{t("Email")}<Input name="email" type="email" maxLength={254} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <TeacherCatalogFields manageCatalogs />
        <label className="text-sm font-medium">{t("Mật khẩu tạm thời")}<Input name="password" required minLength={10} type="password" className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
        <button disabled={busy} className="rounded-xl ds-gradient px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? t("Đang tạo…") : t("Tạo tài khoản")}</button>
      </form></Modal>}
    {editing && <Modal title={t("Sửa thông tin giáo viên")} closeLabel={t("Đóng")} onClose={() => { if (!busy) { setEditing(null); } }}><form onSubmit={saveTeacher} className="grid gap-4">

      <label className="text-sm font-medium">{t("Họ tên")}<Input name="displayName" defaultValue={editing.displayName} required maxLength={160} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <label className="text-sm font-medium">{t("Email")}<Input name="email" type="email" defaultValue={editing.email ?? ""} maxLength={254} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>
      <TeacherCatalogFields manageCatalogs subject={editing.subject} workplace={editing.workplace} />
      <button disabled={busy} className="rounded-xl ds-gradient px-4 py-3 font-semibold text-white disabled:opacity-60">{t("Lưu thông tin")}</button>
    </form></Modal>}
    <section className="mt-7 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm theo tên hoặc tài khoản")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "pending", label: t("Chờ duyệt") }, { value: "active", label: t("Đang hoạt động") }, { value: "locked", label: t("Đã khóa") }]} className="sm:w-56" /></div>
      {loadState === "loading" && <p role="status" className="mt-5">{t("Đang tải chi tiết…")}</p>}
      {loadState === "error" && <Alert role="alert" className="mt-5">{t("Không tải được danh sách giáo viên.")} <Button type="button" variant="outline" onClick={() => void load()}>{t("Thử lại")}</Button></Alert>}
      {loadState === "ready" && <div className="mt-5"><Table className="w-full min-w-[820px] text-left text-sm"><thead><tr><th scope="col">{t("Giáo viên")}</th><th scope="col">{t("Tài khoản")}</th><th scope="col">{t("Email")}</th><th scope="col">{t("Bộ môn")}</th><th scope="col">{t("Trạng thái")}</th><th scope="col">{t("Thao tác")}</th></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id} className="border-b border-line"><td className="py-4 font-medium">{teacher.displayName}<span className="block text-xs text-content-muted">{teacher.workplace}</span></td><td className="py-4">{teacher.username}</td><td className="py-4">{teacher.email}</td><td className="py-4">{teacher.subject}</td><td className="py-4">{teacher.status === "pending" ? t("Chờ duyệt") : teacher.status === "active" ? t("Đang hoạt động") : t("Đã khóa")}</td><td className="py-4"><div className="flex gap-2"><button onClick={() => { setEditing(teacher); }} className="rounded-lg border border-line px-3 py-2">{t("Sửa")}</button><button onClick={() => void setLocked(teacher)} className="rounded-lg border border-line px-3 py-2">{teacher.status === "pending" ? t("Duyệt") : teacher.status === "active" ? t("Khóa") : t("Mở khóa")}</button>{teacher.status === "pending" && <button onClick={() => void rejectTeacher(teacher)} className="rounded-lg border border-line px-3 py-2">{t("Từ chối")}</button>}<button onClick={() => { setPasswordError(""); setPasswordTarget(teacher); }} className="rounded-lg border border-line px-3 py-2">{t("Đặt mật khẩu")}</button></div></td></tr>)}{teachers.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-content-muted">{t("Chưa có giáo viên phù hợp.")}</td></tr>}</tbody></Table></div>}
    </section>
  </DashboardContent>;
}
