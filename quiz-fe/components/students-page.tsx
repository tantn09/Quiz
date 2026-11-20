"use client";

import { useErrorToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/field";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StudentForm, StudentImport, type Student } from "@/features/students/student-forms";
import { DashboardContent, DashboardLoading } from "@/components/dashboard-shell";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/modal";
import { useTranslation } from "@/lib/i18n";

const blank = { id: "", name: "", className: "" };
const endpoint = "/api/teacher/students";
type Teacher = { id: string; displayName: string; username: string };

export default function StudentsPage({ admin }: { admin: boolean }) {
  const t = useTranslation();
  const showError = useErrorToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [teachersLoading, setTeachersLoading] = useState(admin);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [draft, setDraft] = useState<Student | null>(null);
  const [remove, setRemove] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(admin ? "ready" : "loading");

  const teacher = teachers.find((item) => item.id === teacherId);
  const suffix = admin && teacherId ? "?teacherId=" + encodeURIComponent(teacherId) : "";
  const canManage = !admin || Boolean(teacher);
  const teacherName = teacher?.displayName;

  async function load(signal?: AbortSignal) {
    try {
      const response = await fetch(endpoint + suffix, { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!signal?.aborted) { setStudents(data.students); setLoadState("ready"); }
    } catch {
      if (signal?.aborted) return;
      setLoadState("error");
      showError(t("Không tải được danh sách học sinh."));
    }
  }

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    fetch("/api/admin/teachers", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!controller.signal.aborted) setTeachers(data.teachers);
    }).catch(() => {
      if (!controller.signal.aborted) showError(t("Không tải được danh sách giáo viên."));
    }).finally(() => { if (!controller.signal.aborted) setTeachersLoading(false); });
    return () => controller.abort();
  }, [admin, showError, t]);

  useEffect(() => {
    if (admin && !teacherId) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [admin, teacherId]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!canManage || busy || (!draft && !remove)) return;
    setBusy(true);
    try {
      const id = remove?.id ?? draft?.id;
      const response = await fetch(endpoint + (id ? "/" + id : "") + suffix, {
        method: remove ? "DELETE" : id ? "PUT" : "POST",
        headers: draft && !remove ? { "content-type": "application/json" } : undefined,
        body: draft && !remove ? JSON.stringify({ name: draft.name, className: draft.className }) : undefined,
      });
      if (response.status === 409) { showError(t("Họ tên bị trùng trong lớp.")); return; }
      if (!response.ok) throw new Error();
      setNotice(t("Đã cập nhật danh sách học sinh."));
      await load();
      setDraft(null);
      setRemove(null);
      if (remove) requestAnimationFrame(() => searchRef.current?.focus());
    } catch { showError(t("Không cập nhật được danh sách học sinh.")); }
    finally { setBusy(false); }
  }

  const classes = [...new Set(students.map((item) => item.className))];
  const activeClass = classes.includes(className) ? className : "";
  const visible = students.filter((item) => (!activeClass || item.className === activeClass) && item.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));

  function openStudent(student: Student) {
    setDraft(student);
  }

  if (teachersLoading || loadState === "loading") return <DashboardLoading />;

  return <DashboardContent>
    <PageHeader title={t("Quản lý học sinh")} description={t("Tìm kiếm, quản lý danh sách lớp và nhập học sinh từ Excel.")} action={
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || !canManage} onClick={() => openStudent({ ...blank, className: activeClass })}>{t("Thêm học sinh")}</Button>
        <Button type="button" variant="outline" disabled={busy || !canManage} onClick={() => setImportOpen(true)}>{t("Nhập Excel")}</Button>
      </div>
    } />
    {notice && <Alert tone="success" className="mt-4">{notice}</Alert>}
    <section className="mt-7 min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        {admin && <Select value={teacherId} onValueChange={(id) => {
          setTeacherId(id); setClassName(""); setStudents([]); setNotice("");
          setLoadState(id ? "loading" : "ready");
        }} disabled={busy} ariaLabel={t("Giáo viên")} options={[{ value: "", label: t("Chọn giáo viên") }, ...teachers.map((item) => ({ value: item.id, label: item.displayName + " · " + item.username }))]} className="sm:w-56" />}
        {canManage && <>
        <Input ref={searchRef} type="search" aria-label={t("Tìm theo họ tên")} placeholder={t("Tìm theo họ tên")} className="min-w-0 flex-1 rounded-xl px-4 py-3" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={activeClass} onValueChange={setClassName} ariaLabel={t("Lớp")} options={[{ value: "", label: t("Tất cả lớp") }, ...classes.map((item) => ({ value: item, label: item }))]} className="sm:w-56" />
        </>}
      </div>
      {!canManage && <p className="mt-5 text-sm text-content-muted">{t(teachers.length ? "Chọn giáo viên để quản lý danh sách theo lớp." : "Chưa có giáo viên để chọn.")}</p>}
      {canManage && loadState === "ready" && <div className="mt-5">
        <Table>
          <thead><tr>
            <th scope="col">{t("Họ và tên")}</th>
            <th scope="col">{t("Lớp")}</th>
            <th scope="col" className="w-px">{t("Thao tác")}</th>
          </tr></thead>
          <tbody>
            {visible.map((item) => <tr key={item.id} className="border-b border-line last:border-b-0">
              <th scope="row" className="break-words py-4 text-left font-medium [overflow-wrap:anywhere]">{item.name}</th>
              <td className="py-4 [overflow-wrap:anywhere]">{item.className}</td>
              <td className="py-4"><div className="flex flex-col items-start gap-2 sm:flex-row">
                <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={t("Sửa") + " " + item.name} onClick={() => openStudent(item)}>{t("Sửa")}</Button>
                <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={t("Xóa") + " " + item.name} onClick={() => { setRemove(item); }}>{t("Xóa")}</Button>
              </div></td>
            </tr>)}
            {!visible.length && <tr><td colSpan={3} className="py-10 text-center text-content-muted" role="status">
              {t(students.length ? "Không tìm thấy học sinh phù hợp." : "Chưa có học sinh.")}
            </td></tr>}
          </tbody>
        </Table>
      </div>}
    </section>
    {draft && <StudentForm teacherName={teacherName} draft={draft} setDraft={setDraft} save={save} close={() => setDraft(null)} busy={busy} />}
    {remove && <Modal title={t("Xóa khỏi danh sách lớp")} closeLabel={t("Đóng")} onClose={() => !busy && setRemove(null)}>
      <p className="font-medium">{remove.name}</p><p className="mt-1 text-sm text-content-muted">{t("Lớp")} {remove.className}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setRemove(null)}>{t("Hủy")}</Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => void save()}>{t("Xóa học sinh")}</Button>
      </div>
    </Modal>}
    {importOpen && <StudentImport endpoint={endpoint} suffix={suffix} teacherName={teacherName} busy={busy} setBusy={setBusy} close={() => setImportOpen(false)} onImported={async (count) => {
      setNotice(t("Đã nhập {count} học sinh.").replace("{count}", String(count)));
      await load();
      setImportOpen(false);
    }} />}
  </DashboardContent>;
}
