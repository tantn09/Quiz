"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { Modal } from "@/components/modal";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

type QuestionDraft = { type: "choice" | "essay"; prompt: string; options: string; correctOption: string; points: number };
type PromptImage = { id: string; alt: string };
type ImportIssue = { sheet: string; row: number; column: string; message: string };
type ImportDraft = { title: string; description: string; promptText: string; durationMinutes: number; linkExpiresAt: string | null; questions: { type: "choice" | "essay"; prompt: string; points: number; options: string[]; correctOption: number | null }[] };
type QuizRow = { id: string; title: string; description: string; status: string; durationMinutes: number; linkToken: string; linkExpiresAt: string | null };
const emptyQuestion = (): QuestionDraft => ({ type: "choice", prompt: "", options: "", correctOption: "0", points: 1 });

export default function TeacherPage() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptImages, setPromptImages] = useState<PromptImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(30);
  const [expiresAt, setExpiresAt] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportIssue[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useTranslation();

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    const response = await fetch(`/api/teacher/quizzes?${query}`, { cache: "no-store" });
    if (response.ok) setQuizzes((await response.json()).quizzes);
  }, [search, status]);

  useEffect(() => { void load(); }, [load]);

  function addQuestion() { setQuestions((current) => [...current, emptyQuestion()]); }
  function updateQuestion(index: number, changes: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...changes } : question));
  }

  async function importExcel(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 2_000_000) { setImportErrors([{ sheet: "File", row: 0, column: "file", message: t("Chỉ nhận file .xlsx tối đa 2 MB.") }]); setFormOpen(true); return; }
    setImportBusy(true); setImportErrors([]);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const response = await fetch("/api/teacher/quizzes/import-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, data }) });
      const payload = await response.json() as { draft?: ImportDraft; errors?: ImportIssue[] };
      if (!response.ok || !payload.draft) { setImportErrors(payload.errors?.length ? payload.errors : [{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); setFormOpen(true); return; }
      const draft = payload.draft;
      setTitle(draft.title); setDescription(draft.description); setPromptText(draft.promptText); setPromptImages([]); setDuration(draft.durationMinutes);
      setExpiresAt(draft.linkExpiresAt ? new Date(new Date(draft.linkExpiresAt).getTime() - new Date(draft.linkExpiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      setQuestions(draft.questions.map((question) => ({ type: question.type, prompt: question.prompt, points: question.points, options: question.options.join("\n"), correctOption: String(question.correctOption ?? 0) })));
      setImportErrors([]); setFormError(""); setEditing(null); setFormOpen(true);
    } catch { setImportErrors([{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); setFormOpen(true); }
    finally { setImportBusy(false); }
  }

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return;
    if (promptImages.length + files.length > 10) { setFormError(t("Tối đa 10 ảnh cho đề bài.")); return; }
    setUploading(true); setFormError("");
    try {
      for (const file of Array.from(files)) {
        if (![/^image\/(png|jpeg|webp)$/.test(file.type), file.size <= 5_000_000].every(Boolean)) throw new Error(t("Ảnh phải là PNG, JPEG hoặc WebP và không quá 5 MB."));
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
        const response = await fetch("/api/teacher/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) });
        if (!response.ok) throw new Error(t("Không tải được ảnh đề bài."));
        const asset = await response.json() as { id: string };
        setPromptImages((items) => [...items, { id: asset.id, alt: file.name.replace(/\.[^.]+$/, "") }]);
      }
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : t("Không tải được ảnh đề bài.")); }
    finally { setUploading(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setFormError("");
    const payload = {
      title, description, promptText, promptImages, durationMinutes: duration,
      linkExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      questions: questions.map((question) => ({
        type: question.type, prompt: question.prompt,
        options: question.type === "choice" ? question.options.split("\n").map((item) => item.trim()).filter(Boolean) : [],
        correctOption: question.type === "choice" ? Number(question.correctOption) : null,
        points: question.points,
      })),
    };
    let response: Response;
    try {
      response = await fetch(editing ? `/api/teacher/quizzes/${editing}` : "/api/teacher/quizzes", {
        method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
    } catch { setFormError(t("Chưa lưu được quiz. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); setBusy(false); return; }
    setBusy(false);
    if (!response.ok) { setFormError(t("Chưa lưu được quiz. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); return; }
    const result = await response.json().catch(() => ({}));
    setNotice(!editing && result.link ? `${t("Đã tạo quiz. Link:")} ${window.location.origin}${result.link}` : t("Đã lưu quiz."));
    clearForm();
    setFormOpen(false);
    await load();
  }

  function clearForm() { setEditing(null); setTitle(""); setDescription(""); setPromptText(""); setPromptImages([]); setDuration(30); setExpiresAt(""); setQuestions([emptyQuestion()]); }
  function closeForm() { if (busy || importBusy) return; setFormOpen(false); setFormError(""); setImportErrors([]); clearForm(); }
  function newQuiz() { clearForm(); setFormError(""); setImportErrors([]); setFormOpen(true); }

  async function edit(quiz: QuizRow) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`);
    if (!response.ok) { setNotice(t("Không tải được quiz để sửa.")); return; }
    const result = await response.json();
    setEditing(quiz.id); setTitle(result.quiz.title); setDescription(result.quiz.description); setPromptText(result.quiz.promptText ?? ""); setPromptImages(result.quiz.promptImages ?? []); setDuration(result.quiz.durationMinutes);
    setExpiresAt(result.quiz.linkExpiresAt ? new Date(result.quiz.linkExpiresAt).toISOString().slice(0, 16) : "");
    setQuestions(result.questions.map((question: { type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number }) => ({ type: question.type, prompt: question.prompt, options: question.options.join("\n"), correctOption: String(question.correctOption ?? 0), points: question.points })));
    setFormError(""); setFormOpen(true);
  }

  async function stop(quiz: QuizRow) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/stop`, { method: "POST" });
    setNotice(response.ok ? `${t("Đã ngừng quiz:")} ${quiz.title}` : t("Không thể ngừng quiz."));
    await load();
  }

  async function extendLink(quiz: QuizRow) {
    const value = window.prompt(t("Nhập hạn link mới theo giờ địa phương (YYYY-MM-DD HH:mm):"));
    if (!value) return;
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) { setNotice(t("Định dạng ngày giờ chưa hợp lệ.")); return; }
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/extend-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkExpiresAt: date.toISOString() }) });
    setNotice(response.ok ? t("Đã gia hạn link.") : t("Không gia hạn được link."));
    await load();
  }

  async function extendAttempts(quiz: QuizRow) {
    const value = window.prompt(t("Cộng thêm bao nhiêu phút cho các lượt chưa nộp?"), "10");
    if (!value) return;
    const additionalMinutes = Number(value);
    if (!Number.isInteger(additionalMinutes) || additionalMinutes < 1) { setNotice(t("Số phút cần là số nguyên dương.")); return; }
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/extend-attempts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ additionalMinutes }) });
    setNotice(response.ok ? t("Đã gia hạn thời gian cho các lượt chưa nộp.") : t("Không gia hạn được thời gian."));
  }

  async function copyLink(quiz: QuizRow) {
    await navigator.clipboard.writeText(`${window.location.origin}/q/${quiz.linkToken}`);
    setNotice(t("Đã sao chép link quiz."));
  }

  return <><DashboardNav /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    <PageHeader eyebrow={t("GIÁO VIÊN")} title={t("Bài quiz của tôi")} description={t("Tạo bài, gửi link cho học sinh và theo dõi tiến độ.")} action={<div className="flex flex-wrap gap-3"><Button type="button" onClick={newQuiz}>{t("Tạo quiz mới")}</Button><Button type="button" variant="outline" disabled={importBusy} onClick={() => importInputRef.current?.click()}>{t("Nhập Excel")}</Button><Button asChild variant="outline"><Link href="/teacher/results">{t("Xem kết quả")}</Link></Button></div>} />
    <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void importExcel(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" tabIndex={-1} aria-hidden="true" />
    {notice && <Alert className="mt-5 break-words">{notice}</Alert>}
    {formOpen && <Modal title={editing ? t("Sửa quiz") : t("Tạo quiz mới")} closeLabel={t("Đóng")} onClose={closeForm} wide><form onSubmit={save} className="space-y-5">
      {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}</p>}
      {!editing && <section className="rounded-xl border border-line bg-surface-subtle p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{t("Nhập quiz từ Excel")}</h3><p className="text-sm text-content-muted">{t("Nạp dữ liệu để xem và chỉnh sửa trước khi tạo quiz.")}</p></div><a href="/api/teacher/quizzes/import-template.xlsx" download className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">{t("Tải file mẫu")}</a></div><label className="mt-4 block text-sm font-medium">{t("Chọn file .xlsx")}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importBusy} onChange={(event) => { void importExcel(event.target.files?.[0]); event.target.value = ""; }} className="mt-2 block w-full text-sm" /></label>{importBusy && <p role="status" className="mt-2 text-sm">{t("Đang đọc file…")}</p>}{importErrors.length > 0 && <div role="alert" className="mt-3 rounded-lg ds-error p-3 text-sm"><p className="font-semibold">{t("File Excel có lỗi:")}</p><ul className="mt-2 list-disc space-y-1 pl-5">{importErrors.map((issue, index) => <li key={index}>{issue.sheet}{issue.row ? ` · ${t("dòng")} ${issue.row}` : ""} · {issue.column}: {t(issue.message)}</li>)}</ul></div>}</section>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("Tên quiz")}<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="text-sm font-medium">{t("Thời lượng (phút)")}<input required type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="text-sm font-medium sm:col-span-2">{t("Mô tả")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="text-sm font-medium sm:col-span-2">{t("Hạn dùng link (để trống nếu không hết hạn)")}<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 block rounded-xl border border-line px-4 py-3" /></label></div>
      <section className="rounded-2xl border border-line bg-surface-subtle p-4"><h3 className="font-semibold">{t("Đề bài (tùy chọn)")}</h3><p className="mt-1 text-sm text-content-muted">{t("Học sinh xem đề bài cạnh phần câu hỏi.")}</p><label className="mt-4 block text-sm font-medium">{t("Nội dung đề bài")}<textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} maxLength={30000} rows={5} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="mt-4 block text-sm font-medium">{t("Ảnh đề bài (tối đa 10 ảnh, 5 MB/ảnh)")}<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={(event) => { void uploadImages(event.target.files); event.target.value = ""; }} className="mt-2 block w-full text-sm" /></label>{uploading && <p role="status" className="mt-2 text-sm">{t("Đang tải ảnh…")}</p>}<div className="mt-3 grid gap-3">{promptImages.map((image, index) => <div key={image.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"><img src={`/api/public/assets/${image.id}`} alt={image.alt} className="h-20 w-20 rounded-lg object-contain" /><label className="min-w-40 flex-1 text-sm">{t("Mô tả ảnh")}<input required value={image.alt} onChange={(event) => setPromptImages((items) => items.map((item, i) => i === index ? { ...item, alt: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => setPromptImages((items) => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded-lg border border-line px-2 py-2">↑</button><button type="button" disabled={index === promptImages.length - 1} onClick={() => setPromptImages((items) => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="rounded-lg border border-line px-2 py-2">↓</button><button type="button" onClick={() => setPromptImages((items) => items.filter((_, i) => i !== index))} className="rounded-lg border border-line px-2 py-2">{t("Xóa")}</button></div></div>)}</div></section>
      <div className="mt-7 space-y-4">{questions.map((question, index) => <section key={index} className="rounded-2xl border border-line p-4 sm:p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">{t("Câu")} {index + 1}</h3>{questions.length > 1 && <button type="button" onClick={() => setQuestions((items) => items.filter((_, i) => i !== index))} className="text-sm text-red-700">{t("Xóa câu")}</button>}</div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Select value={question.type} onValueChange={(value) => updateQuestion(index, { type: value as QuestionDraft["type"] })} ariaLabel={t("Loại câu hỏi")} options={[{ value: "choice", label: t("Trắc nghiệm") }, { value: "essay", label: t("Tự luận") }]} /><input type="number" min={0} max={1000} value={question.points} onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })} aria-label={t("Điểm")} className="rounded-xl border border-line px-3 py-3" /><div /> <textarea required value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder={t("Nội dung câu hỏi")} rows={3} className="rounded-xl border border-line px-3 py-3 sm:col-span-3" />{question.type === "choice" && <><textarea required value={question.options} onChange={(event) => updateQuestion(index, { options: event.target.value })} placeholder={t("Mỗi lựa chọn trên một dòng (ít nhất 2 dòng)")} rows={4} className="rounded-xl border border-line px-3 py-3 sm:col-span-2" /><label className="text-sm">{t("Số thứ tự đáp án đúng")}<input required type="number" min={0} value={question.correctOption} onChange={(event) => updateQuestion(index, { correctOption: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label></>}</div></section>)}</div>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={addQuestion} className="rounded-xl border border-line px-4 py-3 font-semibold">{t("+ Thêm câu hỏi")}</button><button disabled={busy || uploading || importBusy} className="rounded-xl ds-gradient px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? t("Đang lưu…") : editing ? t("Lưu thay đổi") : t("Tạo quiz")}</button></div>
    </form></Modal>}
    <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm quiz")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "active", label: t("Đang mở") }, { value: "inactive", label: t("Đã ngừng") }]} className="sm:w-56" /></div>
      <div className="mt-5 grid gap-3">{quizzes.map((quiz) => <article key={quiz.id} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"><div><h3 className="font-bold">{quiz.title}</h3><p className="mt-1 text-sm text-content-muted">{quiz.durationMinutes} {t("phút")} · {quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}{quiz.linkExpiresAt ? ` · ${t("Hết link")} ${new Date(quiz.linkExpiresAt).toLocaleString()}` : ""}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => void copyLink(quiz)} className="rounded-lg border border-line px-3 py-2 text-sm">{t("Sao chép link")}</button><button onClick={() => void edit(quiz)} className="rounded-lg border border-line px-3 py-2 text-sm">{t("Sửa")}</button>{quiz.status === "active" && <><button onClick={() => void extendLink(quiz)} className="rounded-lg border border-line px-3 py-2 text-sm">{t("Gia hạn link")}</button><button onClick={() => void extendAttempts(quiz)} className="rounded-lg border border-line px-3 py-2 text-sm">{t("+ Thời gian làm")}</button><button onClick={() => void stop(quiz)} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">{t("Ngừng")}</button></>}</div></article>)}{quizzes.length === 0 && <EmptyState title={t("Chưa có quiz.")} />}</div>
    </section>
  </div></main></>;
}
