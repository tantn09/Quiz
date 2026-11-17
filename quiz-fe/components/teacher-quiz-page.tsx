"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { Modal } from "@/components/modal";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, EllipsisVertical, GripVertical, Trash2 } from "lucide-react";

type QuestionDraft = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number; points: number };
type PromptImage = { id: string; alt: string };
type ImportIssue = { sheet: string; row: number; column: string; message: string };
type ImportDraft = { title: string; description: string; promptText: string; durationMinutes: number; linkExpiresAt: string | null; questions: { type: "choice" | "essay"; prompt: string; points: number; options: string[]; correctOption: number | null }[] };
type QuizRow = { id: string; title: string; description: string; status: string; durationMinutes: number; linkToken: string; linkExpiresAt: string | null; subject: string | null; gradeLevel: string | null };
type CatalogItem = { id: string; name: string };
type QuizDetail = { quiz: QuizRow & { promptText?: string; promptImages?: PromptImage[] }; questions: { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number }[] };
type QuizActionsProps = { quiz: QuizRow; t: (value: string) => string; copyLink: (quiz: QuizRow) => Promise<void>; edit: (quiz: QuizRow) => Promise<void>; openLinkExpiry: (quiz: QuizRow) => void; extendAttempts: (quiz: QuizRow) => Promise<void>; stop: (quiz: QuizRow) => Promise<void>; deleteQuiz: (quiz: QuizRow) => Promise<void> };
const emptyQuestion = (): QuestionDraft => ({ id: crypto.randomUUID(), type: "choice", prompt: "", options: ["", ""], correctOption: -1, points: 1 });
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const formatTimeFirst = (value: string) => { const date = new Date(value); return `${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${date.toLocaleDateString("vi-VN")}`; };
function TimeFirstDateTime({ label, value, onChange, required = false, t }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; t: (value: string) => string }) {
  const [date = "", time = ""] = value.split("T");
  const combine = (nextDate: string, nextTime: string) => onChange(nextDate || nextTime ? `${nextDate}T${nextTime}` : "");
  return <fieldset className="min-w-0"><legend className="text-sm font-medium">{label}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-sm">{t("Giờ")}<input type="time" required={required || Boolean(date)} value={time} onChange={(event) => combine(date, event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label><label className="text-sm">{t("Ngày")}<input type="date" required={required || Boolean(time)} value={date} onChange={(event) => combine(event.target.value, time)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label></div></fieldset>;
}
function QuizSurface({ fullPage, title, onClose, children }: { fullPage: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!fullPage) return <Modal title={title} closeLabel="Đóng" onClose={onClose} wide>{children}</Modal>;
  return <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">{children}</section>;
}

function QuestionEditor({ question, index, count, collapsed, toggle, error, t, update, remove, duplicate }: { question: QuestionDraft; index: number; count: number; collapsed: boolean; toggle: () => void; error?: string; t: (value: string) => string; update: (changes: Partial<QuestionDraft>) => void; remove: () => void; duplicate: () => void }) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: question.id, index });
  const updateOption = (optionIndex: number, value: string) => update({ options: question.options.map((option, i) => i === optionIndex ? value : option) });
  const removeOption = (optionIndex: number) => update({ options: question.options.filter((_, i) => i !== optionIndex), correctOption: question.correctOption === optionIndex ? -1 : question.correctOption > optionIndex ? question.correctOption - 1 : question.correctOption });
  return <section ref={ref} id={`question-${index}`} className={`rounded-2xl border border-line bg-surface p-4 sm:p-5 ${isDragging ? "opacity-60 ring-2 ring-brand" : ""} ${isDropTarget ? "ring-2 ring-focus" : ""}`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-bold">{t("Câu")} {index + 1}</h3>{collapsed && <p className="truncate text-sm text-content-muted">{question.prompt || (question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận"))}</p>}</div><div className="flex flex-wrap gap-1"><button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={`${collapsed ? t("Mở rộng") : t("Thu gọn")} ${t("Câu")} ${index + 1}`} className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{collapsed ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}</button><button ref={handleRef} type="button" aria-label={`${t("Kéo để đổi thứ tự")} ${t("Câu")} ${index + 1}`} aria-roledescription={t("Tay nắm sắp xếp câu hỏi")} title={t("Kéo để đổi thứ tự")} className="flex min-h-11 min-w-11 touch-none cursor-grab items-center justify-center rounded-lg border border-line text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"><GripVertical size={18} aria-hidden="true" /></button><button type="button" onClick={duplicate} aria-label={`${t("Nhân bản")} ${t("Câu")} ${index + 1}`} title={t("Nhân bản")} className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand"><Copy size={18} aria-hidden="true" /></button>{count > 1 && <button type="button" onClick={remove} aria-label={`${t("Xóa câu")} ${index + 1}`} title={t("Xóa câu")} className="min-h-11 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 size={18} aria-hidden="true" /></button>}</div></div>
    {!collapsed && <div id={`question-body-${question.id}`}>
    <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <label className="text-sm font-semibold">{t("Loại câu hỏi")}<Select value={question.type} onValueChange={(value) => update({ type: value as QuestionDraft["type"] })} ariaLabel={t("Loại câu hỏi")} options={[{ value: "choice", label: t("Trắc nghiệm") }, { value: "essay", label: t("Tự luận") }]} className="mt-2" /></label>
      <label className="text-sm font-semibold">{t("Điểm")}<input type="number" min={0} max={1000} required value={question.points} onChange={(event) => update({ points: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label>
    </div>
    <label className="mt-4 block text-sm font-semibold">{t("Nội dung câu hỏi")}<textarea required value={question.prompt} onChange={(event) => update({ prompt: event.target.value })} rows={3} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label>
    {question.type === "choice" && <fieldset className="mt-5 rounded-xl border border-line bg-surface-subtle p-4"><legend className="px-1 text-sm font-semibold">{t("Các lựa chọn")}</legend><p className="mb-3 text-sm text-content-muted">{t("Nhập từng đáp án và chọn một đáp án đúng.")}</p>
      <div className="space-y-3">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><label className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-sm" title={t("Đáp án đúng")}><input type="radio" name={`correct-option-${question.id}`} checked={question.correctOption === optionIndex} onChange={() => update({ correctOption: optionIndex })} className="h-4 w-4 accent-emerald-700" aria-label={`${t("Chọn đáp án đúng")}: ${optionIndex + 1}`} /><span className="font-semibold">{String.fromCharCode(65 + optionIndex)}</span></label><input maxLength={500} value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} aria-label={`${t("Lựa chọn")} ${String.fromCharCode(65 + optionIndex)}`} className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3" /><button type="button" disabled={question.options.length <= 2} onClick={() => removeOption(optionIndex)} aria-label={`${t("Xóa đáp án")} ${String.fromCharCode(65 + optionIndex)}`} className="min-h-11 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{t("Xóa")}</button></div>)}</div>
      <button type="button" disabled={question.options.length >= 8} onClick={() => update({ options: [...question.options, ""] })} className="mt-4 min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle disabled:opacity-50">{t("+ Thêm đáp án")}</button>
    </fieldset>}
    {error && <p role="alert" className="mt-3 rounded-xl ds-error p-3 text-sm">{error}</p>}
    </div>}
  </section>;
}

function QuizActions({ quiz, t, copyLink, edit, openLinkExpiry, extendAttempts, stop, deleteQuiz }: QuizActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  const action = (callback: () => void) => { setOpen(false); callback(); };
  const itemClass = "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
  return <div ref={menuRef} className="relative shrink-0 self-start">
    <button type="button" aria-label={`${t("Tùy chọn quiz")}: ${quiz.title}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><EllipsisVertical size={20} aria-hidden="true" /></button>
    {open && <div role="menu" aria-label={`${t("Tùy chọn quiz")}: ${quiz.title}`} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }} className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void copyLink(quiz))}>{t("Sao chép link")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void edit(quiz))}>{t("Sửa")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => openLinkExpiry(quiz))}>{quiz.status === "inactive" ? t("Mở lại và gia hạn") : t("Gia hạn link")}</button>
      {quiz.status === "active" && <><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void extendAttempts(quiz))}>{t("+ Thời gian làm")}</button><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void stop(quiz))}>{t("Ngừng")}</button></>}
      <div className="my-1 border-t border-line" /><button type="button" role="menuitem" className={`${itemClass} text-red-700`} onClick={() => action(() => void deleteQuiz(quiz))}>{t("Xóa quiz")}</button>
    </div>}
  </div>;
}

export default function TeacherPage({ mode = "list" }: { mode?: "list" | "create" | "view" | "edit" }) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [collapsedQuestionIds, setCollapsedQuestionIds] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptText, setPromptText] = useState("");
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptImages, setPromptImages] = useState<PromptImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(30);
  const [expiresAt, setExpiresAt] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subjects, setSubjects] = useState<CatalogItem[]>([]);
  const [gradeLevels, setGradeLevels] = useState<CatalogItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [formErrorTarget, setFormErrorTarget] = useState("");
  const [questionError, setQuestionError] = useState<number | null>(null);
  const [questionErrorMessage, setQuestionErrorMessage] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErrors, setImportErrors] = useState<ImportIssue[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkQuiz, setLinkQuiz] = useState<QuizRow | null>(null);
  const [newLinkExpiry, setNewLinkExpiry] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [detailQuiz, setDetailQuiz] = useState<QuizRow | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const t = useTranslation();
  useEffect(() => { void fetch("/api/teacher/catalogs", { cache: "no-store" }).then(async (response) => { if (response.ok) { const data = await response.json(); setSubjects(data.subjects); setGradeLevels(data.gradeLevels); } }); }, []);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    const response = await fetch(`/api/teacher/quizzes?${query}`, { cache: "no-store" });
    if (response.ok) setQuizzes((await response.json()).quizzes);
  }, [search, status]);

  useEffect(() => { if (mode === "list") void load(); }, [load, mode]);
  useEffect(() => {
    if (mode === "create") {
      const stored = sessionStorage.getItem("quiz-import-draft");
      if (stored) {
        sessionStorage.removeItem("quiz-import-draft");
        try {
          const draft = JSON.parse(stored) as ImportDraft;
          setTitle(draft.title); setDescription(draft.description); setPromptText(draft.promptText); setPromptOpen(Boolean(draft.promptText)); setPromptImages([]); setDuration(draft.durationMinutes);
          setExpiresAt(draft.linkExpiresAt ? localDateTime(new Date(draft.linkExpiresAt)) : "");
          setQuestions(draft.questions.map((question) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, points: question.points, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1 })));
          setCollapsedQuestionIds(new Set());
        } catch { setFormError(t("Không đọc được file Excel.")); }
      }
      setFormOpen(true); return;
    }
    if (!params.id) return;
    const response = fetch(`/api/teacher/quizzes/${params.id}`, { cache: "no-store" });
    void response.then(async (result) => {
      if (!result.ok) throw new Error();
      const payload = await result.json() as QuizDetail;
      if (mode === "view") { setDetailQuiz(payload.quiz); setDetail(payload); }
      if (mode === "edit") void edit(payload.quiz);
    }).catch(() => { if (mode === "view") setDetailError(t("Không tải được chi tiết quiz. Vui lòng thử lại.")); else setFormError(t("Không tải được quiz để sửa.")); });
  // Load the route's quiz once; edit() populates the shared form state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, params.id]);

  function addQuestion(type: QuestionDraft["type"]) { if (questions.length >= 200) return; setQuestions([...questions, { ...emptyQuestion(), type }]); setCollapsedQuestionIds(new Set(questions.map((question) => question.id))); requestAnimationFrame(() => document.getElementById(`question-${questions.length}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  function duplicateQuestion(index: number) { if (questions.length >= 200) return; const copy = { ...questions[index], id: crypto.randomUUID(), options: [...questions[index].options] }; const next = [...questions]; next.splice(index + 1, 0, copy); setQuestions(next); setCollapsedQuestionIds(new Set(questions.map((question) => question.id))); setQuestionError(null); requestAnimationFrame(() => document.getElementById(`question-${index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" })); }
  function toggleQuestion(id: string) { setCollapsedQuestionIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function updateQuestion(index: number, changes: Partial<QuestionDraft>) {
    if (questionError === index) setQuestionError(null);
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...changes } : question));
  }

  async function importExcel(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 2_000_000) { setImportErrors([{ sheet: "File", row: 0, column: "file", message: t("Chỉ nhận file .xlsx tối đa 2 MB.") }]); return; }
    setImportBusy(true); setImportErrors([]);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const response = await fetch("/api/teacher/quizzes/import-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, data }) });
      const payload = await response.json() as { draft?: ImportDraft; errors?: ImportIssue[] };
      if (!response.ok || !payload.draft) { setImportErrors(payload.errors?.length ? payload.errors : [{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); return; }
      const draft = payload.draft;
      if (mode === "list") { sessionStorage.setItem("quiz-import-draft", JSON.stringify(draft)); router.push("/teacher/quizzes/new"); return; }
      setSubject(""); setGradeLevel("");
      setTitle(draft.title); setDescription(draft.description); setPromptText(draft.promptText); setPromptOpen(Boolean(draft.promptText)); setPromptImages([]); setDuration(draft.durationMinutes);
      setExpiresAt(draft.linkExpiresAt ? new Date(new Date(draft.linkExpiresAt).getTime() - new Date(draft.linkExpiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      setQuestions(draft.questions.map((question) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, points: question.points, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1 })));
      setCollapsedQuestionIds(new Set());
      setImportErrors([]); setFormError(""); setEditing(null); setFormOpen(true);
    } catch { setImportErrors([{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); }
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
    if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) { setFormError(t("Định dạng ngày giờ chưa hợp lệ.")); setFormErrorTarget("quiz-info"); document.getElementById("quiz-info")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (mode === "create" && expiresAt && new Date(expiresAt) <= new Date()) { setFormError(t("Hạn link phải ở tương lai.")); setFormErrorTarget("quiz-info"); document.getElementById("quiz-info")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (!subject || !gradeLevel) { setFormError(t("Chọn môn học và khối lớp.")); setFormErrorTarget("quiz-classes"); document.getElementById("quiz-classes")?.scrollIntoView({ behavior: "smooth" }); return; }
    const invalidPrompt = questions.findIndex((question) => !question.prompt.trim() || !Number.isInteger(question.points) || question.points < 0 || question.points > 1000);
    if (invalidPrompt !== -1) { const message = t("Nhập nội dung câu hỏi và điểm từ 0 đến 1000."); setQuestionError(invalidPrompt); setQuestionErrorMessage(message); setCollapsedQuestionIds((current) => { const next = new Set(current); next.delete(questions[invalidPrompt].id); return next; }); setFormError(`${t("Câu")} ${invalidPrompt + 1}: ${message}`); setFormErrorTarget(`question-${invalidPrompt}`); document.getElementById(`question-${invalidPrompt}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const invalidQuestion = questions.findIndex((question) => question.type === "choice" && (question.options.length < 2 || question.options.length > 8 || question.options.some((option) => !option.trim()) || question.correctOption < 0 || question.correctOption >= question.options.length));
    if (invalidQuestion !== -1) { const message = t("Nhập đầy đủ từ 2 đến 8 đáp án và chọn đáp án đúng."); setQuestionError(invalidQuestion); setQuestionErrorMessage(message); setCollapsedQuestionIds((current) => { const next = new Set(current); next.delete(questions[invalidQuestion].id); return next; }); setFormError(`${t("Câu")} ${invalidQuestion + 1}: ${message}`); setFormErrorTarget(`question-${invalidQuestion}`); document.getElementById(`question-${invalidQuestion}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setQuestionError(null);
    setBusy(true); setFormError(""); setFormErrorTarget("");
    const payload = {
      title, description, promptText, promptImages, durationMinutes: duration,
      subjectId: subjects.find((item) => item.name === subject)?.id ?? null,
      gradeLevelId: gradeLevels.find((item) => item.name === gradeLevel)?.id ?? null,
      subject, gradeLevel,
      linkExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      questions: questions.map((question) => ({
        type: question.type, prompt: question.prompt,
        options: question.type === "choice" ? question.options.map((item) => item.trim()) : [],
        correctOption: question.type === "choice" ? question.correctOption : null,
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
    if (mode !== "list") { router.push(`/teacher/quizzes/${editing ?? result.quiz?.id}`); return; }
    setNotice(!editing && result.link ? `${t("Đã tạo quiz. Link:")} ${window.location.origin}${result.link}` : t("Đã lưu quiz."));
    clearForm();
    setFormOpen(false);
    await load();
  }

  function clearForm() { setEditing(null); setTitle(""); setDescription(""); setPromptText(""); setPromptOpen(false); setPromptImages([]); setDuration(30); setExpiresAt(""); setSubject(""); setGradeLevel(""); setQuestions([emptyQuestion()]); setCollapsedQuestionIds(new Set()); setQuestionError(null); }
  function closeForm() { if (busy || importBusy) return; if (mode !== "list") { router.push(editing ? `/teacher/quizzes/${editing}` : "/teacher"); return; } setFormOpen(false); setFormError(""); setImportErrors([]); clearForm(); }
  function newQuiz() { router.push("/teacher/quizzes/new"); }

  async function edit(quiz: QuizRow) {
    if (mode === "list" || mode === "view") { router.push(`/teacher/quizzes/${quiz.id}/edit`); return; }
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`);
    if (!response.ok) { setNotice(t("Không tải được quiz để sửa.")); return; }
    const result = await response.json();
    setEditing(quiz.id); setTitle(result.quiz.title); setDescription(result.quiz.description); setPromptText(result.quiz.promptText ?? ""); setPromptOpen(Boolean(result.quiz.promptText || result.quiz.promptImages?.length)); setPromptImages(result.quiz.promptImages ?? []); setDuration(result.quiz.durationMinutes); setSubject(result.quiz.subject ?? ""); setGradeLevel(result.quiz.gradeLevel ?? "");
    setExpiresAt(result.quiz.linkExpiresAt ? localDateTime(new Date(result.quiz.linkExpiresAt)) : "");
    setQuestions(result.questions.map((question: { type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number }) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1, points: question.points })));
    setCollapsedQuestionIds(new Set());
    setFormError(""); setFormOpen(true);
  }

  async function openDetail(quiz: QuizRow) {
    if (mode === "list") { router.push(`/teacher/quizzes/${quiz.id}`); return; }
    setDetailQuiz(quiz); setDetail(null); setDetailError("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setDetail(await response.json() as QuizDetail);
    } catch { setDetailError(t("Không tải được chi tiết quiz. Vui lòng thử lại.")); }
  }

  async function stop(quiz: QuizRow) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/stop`, { method: "POST" });
    setNotice(response.ok ? `${t("Đã ngừng quiz:")} ${quiz.title}` : t("Không thể ngừng quiz."));
    await load();
  }

  async function deleteQuiz(quiz: QuizRow) {
    if (!window.confirm(`${t("Xóa quiz này khỏi danh sách?")} ${quiz.title}`)) return;
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { method: "DELETE" });
    setNotice(response.ok ? t("Đã xóa quiz khỏi danh sách. Kết quả đã nộp vẫn được giữ lại.") : t("Không xóa được quiz."));
    if (response.ok) await load();
  }

  function openLinkExpiry(quiz: QuizRow) {
    setLinkQuiz(quiz);
    setNewLinkExpiry(localDateTime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    setLinkError("");
  }

  async function extendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!linkQuiz) return;
    const date = new Date(newLinkExpiry);
    if (!newLinkExpiry || Number.isNaN(date.getTime()) || date <= new Date()) { setLinkError(t("Hạn link mới phải ở tương lai.")); return; }
    setLinkBusy(true);
    setLinkError("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${linkQuiz.id}/${linkQuiz.status === "inactive" ? "reopen" : "extend-link"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkExpiresAt: date.toISOString() }) });
      if (!response.ok) throw new Error();
      setNotice(linkQuiz.status === "inactive" ? t("Đã mở lại và gia hạn quiz.") : t("Đã gia hạn link."));
      setLinkQuiz(null);
      await load();
    } catch { setLinkError(t("Không gia hạn được link. Vui lòng thử lại.")); }
    finally { setLinkBusy(false); }
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
    {mode === "list" && <PageHeader eyebrow={t("GIÁO VIÊN")} title={t("Bài quiz của tôi")} description={t("Tạo bài, gửi link cho học sinh và theo dõi tiến độ.")} action={<div className="flex flex-wrap gap-3"><Button type="button" onClick={newQuiz}>{t("Tạo quiz mới")}</Button><Button type="button" variant="outline" disabled={importBusy} onClick={() => importInputRef.current?.click()}>{importBusy ? t("Đang đọc file…") : t("Nhập Excel")}</Button><Button asChild variant="outline"><a href="/api/teacher/quizzes/import-template.xlsx" download>{t("Tải file mẫu")}</a></Button><Button asChild variant="outline"><Link href="/teacher/results">{t("Xem kết quả")}</Link></Button></div>} />}
    {mode !== "list" && <PageHeader eyebrow={t("GIÁO VIÊN")} title={mode === "create" ? t("Tạo quiz mới") : mode === "edit" ? t("Sửa quiz") : t("Chi tiết quiz")} description={mode === "create" ? t("Điền thông tin, thêm câu hỏi rồi tạo quiz.") : undefined} action={<Button asChild variant="outline"><Link href="/teacher">{t("Về danh sách quiz")}</Link></Button>} />}
    <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void importExcel(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" tabIndex={-1} aria-hidden="true" />
    {mode === "list" && importErrors.length > 0 && <div role="alert" className="mt-5 rounded-xl ds-error p-4 text-sm"><p className="font-semibold">{t("File Excel có lỗi:")}</p><ul className="mt-2 list-disc pl-5">{importErrors.map((issue, index) => <li key={index}>{issue.sheet}{issue.row ? ` · ${t("dòng")} ${issue.row}` : ""} · {issue.column}: {t(issue.message)}</li>)}</ul></div>}
    {notice && <Alert className="mt-5 break-words">{notice}</Alert>}
    {mode === "edit" && !formOpen && <div className="mt-6 rounded-2xl border border-line bg-surface p-6">{formError ? <p role="alert" className="ds-error rounded-xl p-4">{formError}</p> : <p role="status" className="text-content-muted">{t("Đang tải chi tiết…")}</p>}</div>}
    {(detailQuiz || mode === "view") && <QuizSurface fullPage={mode !== "list"} title={t("Chi tiết quiz")} onClose={() => setDetailQuiz(null)}>
      {!detail && !detailError && <p role="status" className="py-8 text-center text-content-muted">{t("Đang tải chi tiết…")}</p>}
      {detailError && <div role="alert" className="rounded-xl ds-error p-4 text-sm">{detailError}<Button type="button" variant="outline" className="mt-3" onClick={() => { if (params.id) window.location.reload(); else if (detailQuiz) void openDetail(detailQuiz); }}>{t("Thử lại")}</Button></div>}
      {detail && <div className="space-y-6">
        <div><h3 className="text-xl font-bold">{detail.quiz.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-content-muted">{detail.quiz.description || t("Chưa có mô tả.")}</p></div>
        {detail.quiz.subject && <p className="text-sm"><strong>{t("Môn học")}:</strong> {detail.quiz.subject}</p>}
        {detail.quiz.gradeLevel && <p className="text-sm"><strong>{t("Khối lớp")}:</strong> {detail.quiz.gradeLevel}</p>}
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Trạng thái")}</p><p className="mt-1 font-semibold">{detail.quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Thời lượng")}</p><p className="mt-1 font-semibold">{detail.quiz.durationMinutes} {t("phút")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Hạn dùng link")}</p><p className="mt-1 font-semibold">{detail.quiz.linkExpiresAt ? formatTimeFirst(detail.quiz.linkExpiresAt) : t("Không có hạn")}</p></div></div>
        {(detail.quiz.promptText || detail.quiz.promptImages?.length) && <section><h4 className="font-semibold">{t("Đề bài")}</h4>{detail.quiz.promptText && <p className="mt-2 whitespace-pre-wrap text-sm">{detail.quiz.promptText}</p>}{detail.quiz.promptImages && <div className="mt-3 grid gap-3 sm:grid-cols-2">{detail.quiz.promptImages.map((image) => <img key={image.id} src={`/api/public/assets/${image.id}`} alt={image.alt} className="max-h-64 w-full rounded-xl border border-line object-contain" />)}</div>}</section>}
        <section><h4 className="font-semibold">{t("Câu hỏi")} ({detail.questions.length})</h4><div className="mt-3 space-y-3">{detail.questions.map((question, index) => <div key={question.id} className="rounded-xl border border-line p-4"><p className="text-sm font-semibold text-content-muted">{t("Câu")} {index + 1} · {question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận")} · {question.points} {t("điểm")}</p><p className="mt-2 whitespace-pre-wrap font-medium">{question.prompt}</p>{question.type === "choice" && <ol className="mt-3 space-y-1 pl-5 text-sm">{question.options.map((option, optionIndex) => <li key={optionIndex} className={`list-decimal ${optionIndex === question.correctOption ? "font-semibold text-emerald-700" : ""}`}>{option}{optionIndex === question.correctOption ? ` · ${t("Đáp án đúng")}` : ""}</li>)}</ol>}</div>)}</div></section>
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><Button type="button" variant="outline" onClick={() => void copyLink(detail.quiz)}>{t("Sao chép link")}</Button><Button type="button" onClick={() => { setDetailQuiz(null); void edit(detail.quiz); }}>{t("Sửa quiz")}</Button></div>
      </div>}
    </QuizSurface>}
    {linkQuiz && <Modal title={linkQuiz.status === "inactive" ? t("Mở lại quiz") : t("Gia hạn link quiz")} closeLabel={t("Đóng")} onClose={() => { if (!linkBusy) setLinkQuiz(null); }}>
      <form onSubmit={extendLink} className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-subtle p-4">
          <p className="font-semibold">{linkQuiz.title}</p>
          <p className="mt-1 text-sm text-content-muted">{linkQuiz.status === "inactive" ? t("Quiz sẽ mở lại để học sinh truy cập bằng link cũ.") : t("Học sinh tiếp tục dùng link hiện tại đến hạn mới.")}</p>
          <p className="mt-2 text-sm text-content-muted">{t("Hạn hiện tại:")} {linkQuiz.linkExpiresAt ? formatTimeFirst(linkQuiz.linkExpiresAt) : t("Không có hạn")}</p>
        </div>
        <div>
          <TimeFirstDateTime label={t("Hạn truy cập mới")} value={newLinkExpiry} onChange={(value) => { setNewLinkExpiry(value); setLinkError(""); }} required t={t} />
          <p id="new-link-expiry-help" className="mt-2 text-sm text-content-muted">{t("Ngày giờ theo múi giờ trên thiết bị của bạn.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">{[1, 7, 30].map((days) => <button key={days} type="button" onClick={() => { setNewLinkExpiry(localDateTime(new Date(Date.now() + days * 24 * 60 * 60 * 1000))); setLinkError(""); }} className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-subtle">{t("Sau")} {days} {t("ngày")}</button>)}</div>
        </div>
        {linkError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{linkError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><Button type="button" variant="outline" disabled={linkBusy} onClick={() => setLinkQuiz(null)}>{t("Hủy")}</Button><Button type="submit" disabled={linkBusy}>{linkBusy ? t("Đang lưu…") : linkQuiz.status === "inactive" ? t("Mở lại quiz") : t("Lưu hạn mới")}</Button></div>
      </form>
    </Modal>}
    {formOpen && <QuizSurface fullPage={mode !== "list"} title={editing ? t("Sửa quiz") : t("Tạo quiz mới")} onClose={closeForm}><form onSubmit={save} className={mode === "create" ? "mx-auto max-w-3xl" : "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6"}>{mode !== "create" && <nav aria-label={t("Mục lục tạo quiz")} className="mb-6 rounded-xl border border-line bg-surface-subtle p-3 lg:sticky lg:top-6 lg:mb-0"><p className="px-2 pb-2 text-sm font-bold">{t("Nội dung bài quiz")}</p><select aria-label={t("Mục lục tạo quiz")} defaultValue="" onChange={(event) => document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth" })} className="w-full rounded-xl border border-line px-3 py-2 lg:hidden"><option value="" disabled>{t("Chọn mục")}</option><option value="quiz-info">{t("Thông tin quiz")}</option><option value="quiz-classes">{t("Môn học và lớp")} ()</option><option value="quiz-questions">{t("Câu hỏi")} ({questions.length})</option><option value="quiz-prompt">{t("Đề bài")}</option></select><div className="hidden gap-1 lg:grid"><a href="#quiz-info" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Thông tin quiz")}</a><a href="#quiz-classes" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Môn học và lớp")} ()</a><a href="#quiz-questions" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Câu hỏi")} ({questions.length})</a><a href="#quiz-prompt" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Đề bài")}</a></div></nav>}<div className="min-w-0 space-y-6">
      {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}{formErrorTarget && <a href={`#${formErrorTarget}`} className="ml-2 font-semibold underline">{t("Đến phần cần sửa")}</a>}</p>}

      <h3 id="quiz-info" className="scroll-mt-6 flex items-center gap-3 border-b border-line pb-3 text-lg font-bold">{mode === "create" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full ds-gradient text-sm text-white">1</span>}{t("Thông tin quiz")}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("Tên quiz")}<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="text-sm font-medium">{t("Thời lượng (phút)")}<input required type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>{editing && <label className="text-sm font-medium sm:col-span-2">{t("Mô tả")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>}{<div className="sm:col-span-2"><TimeFirstDateTime label={t("Hạn dùng link (để trống nếu không hết hạn)")} value={expiresAt} onChange={setExpiresAt} t={t} /></div>}</div>
      <section id="quiz-classes" className="scroll-mt-6 rounded-2xl border border-line bg-surface p-4"><h3 className="font-semibold">{t("Môn học và khối lớp")}</h3><div className="mt-3 grid gap-4 sm:grid-cols-2">{([["Môn học", subject, setSubject, subjects], ["Khối lớp", gradeLevel, setGradeLevel, gradeLevels]] as const).map(([label, value, setter, items]) => <label key={label} className="text-sm font-medium">{t(label)}<select required value={value} onChange={(event) => setter(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3"><option value="">{t("Chọn")} {t(label)}</option>{value && !items.some((item) => item.name === value) && <option value={value}>{value} ({t("Đã xóa")})</option>}{items.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>)}</div></section>
      <div id="quiz-questions" className="scroll-mt-6 border-t border-line pt-6"><h3 className="flex items-center gap-3 text-lg font-bold">{mode === "create" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full ds-gradient text-sm text-white">2</span>}{t("Câu hỏi")}</h3><p className="mt-1 text-sm text-content-muted">{t("Chọn loại câu hỏi, nhập nội dung và đáp án bên dưới.")}</p></div>
      <DragDropProvider onDragEnd={(event) => { if (event.canceled || !isSortable(event.operation.source)) return; const { initialIndex, index } = event.operation.source; if (initialIndex === index) return; setQuestions((current) => { const next = [...current]; const [moved] = next.splice(initialIndex, 1); next.splice(index, 0, moved); return next; }); setQuestionError(null); setFormError(""); setFormErrorTarget(""); }}><div className="space-y-4">{questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} count={questions.length} collapsed={collapsedQuestionIds.has(question.id)} toggle={() => toggleQuestion(question.id)} duplicate={() => duplicateQuestion(index)} error={questionError === index ? questionErrorMessage : undefined} t={t} update={(changes) => updateQuestion(index, changes)} remove={() => { setQuestions((items) => items.filter((_, i) => i !== index)); setQuestionError(null); }} />)}</div></DragDropProvider>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("choice")}>{t("+ Câu trắc nghiệm")}</Button><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("essay")}>{t("+ Câu tự luận")}</Button></div>
      <details id="quiz-prompt" className="scroll-mt-6 rounded-2xl border border-line bg-surface-subtle p-4" open={promptOpen} onToggle={(event) => setPromptOpen(event.currentTarget.open)}><summary className="cursor-pointer font-semibold">{t("Đề bài (tùy chọn)")}</summary><div><p className="mt-1 text-sm text-content-muted">{t("Học sinh xem đề bài cạnh phần câu hỏi.")}</p><label className="mt-4 block text-sm font-medium">{t("Nội dung đề bài")}<textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} maxLength={30000} rows={5} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="mt-4 block text-sm font-medium">{t("Ảnh đề bài (tối đa 10 ảnh, 5 MB/ảnh)")}<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={(event) => { void uploadImages(event.target.files); event.target.value = ""; }} className="mt-2 block w-full text-sm" /></label>{uploading && <p role="status" className="mt-2 text-sm">{t("Đang tải ảnh…")}</p>}<div className="mt-3 grid gap-3">{promptImages.map((image, index) => <div key={image.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"><img src={`/api/public/assets/${image.id}`} alt={image.alt} className="h-20 w-20 rounded-lg object-contain" /><label className="min-w-40 flex-1 text-sm">{t("Mô tả ảnh")}<input required value={image.alt} onChange={(event) => setPromptImages((items) => items.map((item, i) => i === index ? { ...item, alt: event.target.value } : item))} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label><div className="flex gap-2"><button type="button" disabled={index === 0} onClick={() => setPromptImages((items) => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded-lg border border-line px-2 py-2">↑</button><button type="button" disabled={index === promptImages.length - 1} onClick={() => setPromptImages((items) => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="rounded-lg border border-line px-2 py-2">↓</button><button type="button" onClick={() => setPromptImages((items) => items.filter((_, i) => i !== index))} className="rounded-lg border border-line px-2 py-2">{t("Xóa")}</button></div></div>)}</div></div></details>
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4 sm:-mx-7 sm:px-7"><p className="text-sm text-content-muted">{questions.length} {t("câu hỏi")}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={busy || importBusy}>{t("Hủy")}</Button><Button type="submit" disabled={busy || uploading || importBusy}>{busy ? t("Đang lưu…") : editing ? t("Lưu thay đổi") : t("Tạo quiz")}</Button></div></div>
    </div></form></QuizSurface>}
    {mode === "list" && <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm quiz")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "active", label: t("Đang mở") }, { value: "inactive", label: t("Đã ngừng") }]} className="sm:w-56" /></div>
      <div className="mt-5 grid gap-3">{quizzes.map((quiz) => <article key={quiz.id} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"><button type="button" onClick={() => void openDetail(quiz)} className="min-w-0 flex-1 rounded-lg text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${t("Xem chi tiết quiz")}: ${quiz.title}`}><h3 className="font-bold">{quiz.title}</h3><p className="mt-1 text-sm text-content-muted">{quiz.durationMinutes} {t("phút")} · {quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}{quiz.linkExpiresAt ? ` · ${t("Hết link")} ${formatTimeFirst(quiz.linkExpiresAt)}` : ""}</p><span className="mt-2 block text-xs font-medium text-brand">{t("Xem chi tiết")}</span></button><QuizActions quiz={quiz} t={t} copyLink={copyLink} edit={edit} openLinkExpiry={openLinkExpiry} extendAttempts={extendAttempts} stop={stop} deleteQuiz={deleteQuiz} /></article>)}{quizzes.length === 0 && <EmptyState title={t("Chưa có quiz.")} />}</div>
    </section>}
  </div></main></>;
}
