"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/modal";
import { useTranslation } from "@/lib/i18n";

type Student = { id: string; name: string; className: string };
type Upload = { filename: string; data: string };
const blank = { id: "", name: "", className: "" };
const endpoint = "/api/teacher/students";

export default function StudentsPage({ admin }: { admin: boolean }) {
  const t = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [draft, setDraft] = useState<Student | null>(null);
  const [remove, setRemove] = useState<Student | null>(null);
  const [search, setSearch] = useState("");
  const [className, setClassName] = useState("");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [count, setCount] = useState(0);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error();
    setStudents((await response.json()).students);
  }

  useEffect(() => { void load().catch(() => setNotice("Không tải được danh sách học sinh.")); }, []);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!draft && !remove) return;
    setBusy(true);
    try {
      const id = remove?.id ?? draft?.id;
      const response = await fetch(id ? endpoint + "/" + id : endpoint, {
        method: remove ? "DELETE" : id ? "PUT" : "POST",
        headers: draft && !remove ? { "content-type": "application/json" } : undefined,
        body: draft && !remove ? JSON.stringify({ name: draft.name, className: draft.className }) : undefined,
      });
      if (response.status === 409) { setNotice("Họ tên bị trùng trong lớp."); return; }
      if (!response.ok) throw new Error();
      setDraft(null);
      setRemove(null);
      setNotice("Đã cập nhật danh sách học sinh.");
      await load();
    } catch { setNotice("Không cập nhật được danh sách học sinh."); }
    finally { setBusy(false); }
  }

  async function importFile(file: Upload, confirm: boolean) {
    setBusy(true);
    setCount(0);
    setErrors([]);
    try {
      const response = await fetch(endpoint + "/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...file, confirm }) });
      const result = await response.json();
      if (!response.ok && !result.errors) throw new Error();
      setCount(result.count ?? 0);
      setErrors(result.errors ?? []);
      if (response.ok && confirm) {
        setUpload(null);
        setNotice("Đã nhập danh sách học sinh.");
        await load();
      }
    } catch { setErrors([{ row: 0, message: "Không nhập được danh sách học sinh." }]); }
    finally { setBusy(false); }
  }

  async function selectFile(file?: File) {
    setUpload(null);
    setCount(0);
    setErrors([]);
    if (!file) return;
    if (file.size > 2_000_000 || !file.name.toLowerCase().endsWith(".xlsx")) {
      setErrors([{ row: 0, message: "Chỉ nhận file .xlsx hợp lệ tối đa 2 MB." }]);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const data = { filename: file.name, data: btoa(binary) };
    setUpload(data);
    await importFile(data, false);
  }

  const classes = [...new Set(students.map((item) => item.className))];
  const visible = students.filter((item) => (!className || item.className === className) && item.name.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));

  return <><DashboardNav admin={admin} /><main id="page-content" tabIndex={-1} className="mx-auto min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8">
    <PageHeader title={t("Học sinh")} />
    {notice && <p role="status" className="my-4">{t(notice)}</p>}
    <section className="my-5 space-y-4 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => { setNotice(""); setDraft(blank); }}>{t("Thêm học sinh")}</Button>
        <Button asChild variant="outline"><a href={endpoint + "/template.xlsx"}>{t("Tải Excel mẫu")}</a></Button>
        <label className="flex flex-wrap items-center gap-3">{t("Nhập Excel")}<input disabled={busy} type="file" accept=".xlsx" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void selectFile(file).catch(() => setErrors([{ row: 0, message: "Không đọc được file .xlsx." }])); }} /></label>
      </div>
      {!!errors.length && <ul role="alert" className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error.row}>{error.row ? t("Dòng") + " " + error.row + " · " : ""}{t(error.message)}</li>)}</ul>}
      {upload && count > 0 && <div className="flex flex-wrap items-center gap-3"><p role="status">{t("Số dòng hợp lệ")} {count}</p>{!errors.length && <Button disabled={busy} onClick={() => void importFile(upload, true)}>{t("Xác nhận nhập")}</Button>}</div>}
    </section>
    <div className="flex flex-wrap gap-4">
      <label>{t("Tìm theo họ tên")}<input className="ml-2 rounded border border-line bg-surface p-2" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>{t("Lớp")}<select className="ml-2 rounded border border-line bg-surface p-2" value={className} onChange={(event) => setClassName(event.target.value)}><option value="">{t("Tất cả lớp")}</option>{classes.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface px-4">
      {visible.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{item.name} · {item.className}</span><div className="flex gap-2"><Button variant="outline" onClick={() => { setNotice(""); setDraft(item); }}>{t("Sửa")}</Button><Button variant="outline" onClick={() => { setNotice(""); setRemove(item); }}>{t("Xóa")}</Button></div></li>)}
      {!visible.length && <li className="py-4">{t("Chưa có học sinh.")}</li>}
    </ul>
    {draft && <Modal title={t(draft.id ? "Sửa học sinh" : "Thêm học sinh")} onClose={() => !busy && setDraft(null)}><form onSubmit={save} className="space-y-4">
      <label className="block">{t("Họ và tên")}<input required maxLength={160} className="mt-1 block w-full rounded border border-line bg-surface p-2" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="block">{t("Lớp")}<input required maxLength={80} className="mt-1 block w-full rounded border border-line bg-surface p-2" value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })} /></label>
      {notice && <p role="alert">{t(notice)}</p>}<Button disabled={busy}>{t("Lưu")}</Button>
    </form></Modal>}
    {remove && <Modal title={t("Xóa khỏi danh sách lớp")} onClose={() => !busy && setRemove(null)}><p>{remove.name} · {remove.className}</p>{notice && <p role="alert">{t(notice)}</p>}<Button className="mt-4" disabled={busy} onClick={() => void save()}>{t("Xác nhận xóa")}</Button></Modal>}
  </main></>;
}
