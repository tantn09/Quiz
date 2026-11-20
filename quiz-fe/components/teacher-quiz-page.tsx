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
import { PromptEditor, emptyPrompt, promptImages, type PromptDocument } from "@/components/prompt-editor";
import { PromptView } from "@/components/prompt-view";
import { QuizVariants } from "@/components/quiz-variants";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronUp, Clock3, Copy, EllipsisVertical, GripVertical, Trash2 } from "lucide-react";

type QuestionDraft = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number; points: number };

type ImportIssue = { sheet: string; row: number; column: string; message: string };
type ImportDraft = { title: string; description: string; promptDocument: PromptDocument; durationMinutes: number; linkExpiresAt: string | null; questions: { type: "choice" | "essay"; prompt: string; points: number; options: string[]; correctOption: number | null }[] };
type QuizRow = { id: string; title: string; description: string; status: string; durationMinutes: number; linkToken: string; linkExpiresAt: string | null; subject: string | null; gradeLevel: string | null; assignedClass: string | null };
type CatalogItem = { id: string; name: string };
type SavedDraft = { savedAt: number; title: string; description: string; promptDocument: PromptDocument; duration: number; expiresAt: string; subject: string; gradeLevel: string; questions: QuestionDraft[] };
const DRAFT_TTL = 30 * 24 * 60 * 60 * 1000;
type DetailQuestion = { id: string; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type QuizDetail = { quiz: QuizRow & { promptDocument?: PromptDocument }; questions: DetailQuestion[]; variants: { id: string; code: number; active: boolean; questions: DetailQuestion[] }[] };
type QuizActionsProps = { quiz: QuizRow; t: (value: string) => string; copyLink: (quiz: QuizRow) => Promise<void>; edit: (quiz: QuizRow) => Promise<void>; openLinkExpiry: (quiz: QuizRow) => void; extendAttempts: (quiz: QuizRow) => void; stop: (quiz: QuizRow) => Promise<void>; deleteQuiz: (quiz: QuizRow) => Promise<void>; cloneQuiz: (quiz: QuizRow) => void };
const emptyQuestion = (): QuestionDraft => ({ id: crypto.randomUUID(), type: "choice", prompt: "", options: ["", ""], correctOption: -1, points: 1 });
const localDateTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const formatTimeFirst = (value: string) => { const date = new Date(value); return `${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${date.toLocaleDateString("vi-VN")}`; };
function TimeFirstDateTime({ label, value, onChange, required = false, t }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; t: (value: string) => string }) {
  const [date = "", time = ""] = value.split("T");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() => new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!calendarOpen) return; const close = (event: PointerEvent) => { if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [calendarOpen]);
  useEffect(() => { if (!timeOpen) return; const close = (event: PointerEvent) => { if (!timeRef.current?.contains(event.target as Node)) setTimeOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, [timeOpen]);
  const selected = date ? new Date(`${date}T12:00:00`) : null;
  const view = month;
  const firstDay = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const chooseDate = (day: number) => { const next = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; onChange(`${next}T${time || "08:00"}`); setCalendarOpen(false); };
  return <fieldset className="min-w-0"><legend className="text-sm font-medium text-content">{label}{required ? " *" : ""}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><div ref={timeRef} className="relative min-w-0"><label htmlFor="quiz-time-input" className="mb-1.5 block text-sm font-medium text-content-muted">{t("Giờ")}</label><span className="relative block"><Clock3 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand" aria-hidden="true" /><input id="quiz-time-input" type="text" inputMode="numeric" placeholder="HH:MM" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required={required || Boolean(date)} value={time} onFocus={() => setTimeOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") setTimeOpen(false); }} onChange={(event) => onChange(`${date || localDateTime(new Date()).slice(0, 10)}T${event.target.value}`)} aria-label={t("Giờ")} aria-expanded={timeOpen} className="quiz-datetime-input min-h-11 w-full rounded-xl border border-line py-2 pl-10 pr-3 text-sm" /></span>{timeOpen && <div className="quiz-select-content absolute left-0 top-full z-[110] mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-xl">{Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`).filter((item) => !time || item.includes(time) || time.length >= 5).map((item) => <button key={item} type="button" onClick={() => { onChange(`${date || localDateTime(new Date()).slice(0, 10)}T${item}`); setTimeOpen(false); }} aria-pressed={time === item} className="flex min-h-10 w-full items-center rounded-xl border border-transparent px-3 text-left text-sm hover:border-line hover:bg-surface-accent aria-pressed:border-brand aria-pressed:bg-surface-accent aria-pressed:font-semibold aria-pressed:text-brand">{item}</button>)}</div>}</div><div ref={calendarRef} className="relative min-w-0"><span className="mb-1.5 block text-sm font-medium text-content-muted">{t("Ngày")}</span><button type="button" aria-label={t("Ngày")} aria-expanded={calendarOpen} onClick={() => { if (!calendarOpen) setMonth(selected ?? new Date()); setCalendarOpen(!calendarOpen); }} className="quiz-select-trigger flex min-h-11 w-full items-center gap-3 rounded-xl border border-line px-4 py-2 text-left text-sm hover:border-brand focus-visible:ring-2 focus-visible:ring-focus"><CalendarDays size={18} className="text-brand" aria-hidden="true" />{selected ? selected.toLocaleDateString("vi-VN") : t("Chọn ngày")}</button>{calendarOpen && <div className="quiz-select-content absolute right-0 top-full z-[110] mt-2 w-full rounded-2xl border border-line bg-surface p-2 shadow-xl"><div className="mb-2 flex items-center justify-between"><button type="button" aria-label="Tháng trước" onClick={() => setMonth(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded-lg px-2 py-1 hover:bg-surface-accent">‹</button><strong className="text-xs">{view.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong><button type="button" aria-label="Tháng sau" onClick={() => setMonth(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded-lg px-2 py-1 hover:bg-surface-accent">›</button></div><div className="grid grid-cols-7 gap-0.5 text-center text-xs text-content-muted">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((name) => <span key={name} className="py-1">{name}</span>)}</div><div className="grid grid-cols-7 gap-0.5">{Array.from({ length: firstDay }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: days }, (_, i) => <button key={i} type="button" onClick={() => chooseDate(i + 1)} aria-label={`${i + 1}/${view.getMonth() + 1}/${view.getFullYear()}`} aria-pressed={selected?.getDate() === i + 1 && selected.getMonth() === view.getMonth() && selected.getFullYear() === view.getFullYear()} className="flex aspect-square w-full items-center justify-center rounded-lg text-xs hover:bg-surface-accent aria-pressed:bg-brand aria-pressed:text-white">{i + 1}</button>)}</div></div>}</div></div></fieldset>;
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
      <label className="text-sm font-semibold">{t("Điểm")}<input type="number" min={0} max={1000} step={0.25} required value={question.points} onChange={(event) => update({ points: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-line px-3 py-3" /></label>
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

function QuizActions({ quiz, t, copyLink, edit, openLinkExpiry, extendAttempts, stop, deleteQuiz, cloneQuiz }: QuizActionsProps) {
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
    <button type="button" aria-label={`${t("Tùy chọn bài kiểm tra")}: ${quiz.title}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><EllipsisVertical size={20} aria-hidden="true" /></button>
    {open && <div role="menu" aria-label={`${t("Tùy chọn bài kiểm tra")}: ${quiz.title}`} onKeyDown={(event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (current + 1) % items.length : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }} className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void copyLink(quiz))}>{t("Sao chép link")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => cloneQuiz(quiz))}>Clone cho lớp khác</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void edit(quiz))}>{t("Sửa")}</button>
      <button type="button" role="menuitem" className={itemClass} onClick={() => action(() => openLinkExpiry(quiz))}>{quiz.status === "inactive" ? t("Mở lại và gia hạn") : t("Gia hạn link")}</button>
      {quiz.status === "active" && <><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void extendAttempts(quiz))}>{t("+ Thời gian làm")}</button><button type="button" role="menuitem" className={itemClass} onClick={() => action(() => void stop(quiz))}>{t("Ngừng")}</button></>}
      <div className="my-1 border-t border-line" /><button type="button" role="menuitem" className={`${itemClass} text-red-700`} onClick={() => action(() => void deleteQuiz(quiz))}>{t("Xóa bài kiểm tra")}</button>
    </div>}
  </div>;
}

export default function TeacherPage({ mode = "list", admin }: { admin: boolean; mode?: "list" | "create" | "view" | "edit" }) {
  const quizPath = admin ? "/admin/quiz" : "/teacher/quiz";
  const resultsPath = admin ? "/admin/results" : "/teacher/results";
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [collapsedQuestionIds, setCollapsedQuestionIds] = useState<Set<string>>(() => new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [promptDocument, setPromptDocument] = useState<PromptDocument>(emptyPrompt);
  const [promptOpen, setPromptOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(30);
  const [expiresAt, setExpiresAt] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [assignedClass, setAssignedClass] = useState("");
  const [cloneSource, setCloneSource] = useState<QuizRow | null>(null);
  const [cloneClass, setCloneClass] = useState("");
  const [cloneBusy, setCloneBusy] = useState(false);
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
  const [timeQuiz, setTimeQuiz] = useState<QuizRow | null>(null);
  const [additionalMinutes, setAdditionalMinutes] = useState("10");
  const [timeError, setTimeError] = useState("");
  const [timeBusy, setTimeBusy] = useState(false);
  const [detailQuiz, setDetailQuiz] = useState<QuizRow | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "content" | "variants">("overview");
  const [contentVariantId, setContentVariantId] = useState("");
  const [detailError, setDetailError] = useState("");
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [draftCandidate, setDraftCandidate] = useState<SavedDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const draftKey = draftOwner && (mode === "create" || mode === "edit" && params.id) ? `quiz-draft:${draftOwner}:${mode === "create" ? "new" : params.id}` : null;
  useEffect(() => { if (mode !== "create" && mode !== "edit") return; void fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => { if (response.ok) setDraftOwner((await response.json()).user.id); }); }, [mode]);
  useEffect(() => {
    if (!draftKey || !formOpen) return;
    setDraftReady(false);
    try {
      if (mode === "create" && sessionStorage.getItem("quiz-import-override")) { sessionStorage.removeItem("quiz-import-override"); localStorage.removeItem(draftKey); setDraftReady(true); return; }
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as SavedDraft;
        if (draft.savedAt > Date.now() - DRAFT_TTL && Array.isArray(draft.questions) && draft.promptDocument?.type === "doc") setDraftCandidate(draft);
        else localStorage.removeItem(draftKey);
      }
    } catch { localStorage.removeItem(draftKey); }
    setDraftReady(true);
  }, [draftKey, formOpen]);
  useEffect(() => {
    if (!draftKey || !formOpen || !draftReady || draftCandidate) return;
    const draft: SavedDraft = { savedAt: Date.now(), title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions };
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStatus("Đã lưu bản nháp");
        if (promptImages(promptDocument).length) void fetch("/api/teacher/assets/reserve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: promptImages(promptDocument) }) }).then((response) => { if (!response.ok) setDraftStatus("Đã lưu bản nháp, nhưng chưa giữ được ảnh tạm."); }).catch(() => setDraftStatus("Đã lưu bản nháp, nhưng chưa giữ được ảnh tạm."));
      } catch { setDraftStatus("Không lưu được bản nháp trên trình duyệt."); }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, formOpen, draftReady, draftCandidate, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions]);
  useEffect(() => {
    if (!draftKey || !formOpen || !draftReady || draftCandidate) return;
    const flush = () => { try { localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions } satisfies SavedDraft)); } catch { /* The visible status reports quota errors during autosave. */ } };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [draftKey, formOpen, draftReady, draftCandidate, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions]);
  function restoreDraft() {
    if (!draftCandidate) return;
    setTitle(draftCandidate.title); setDescription(draftCandidate.description); setPromptDocument(draftCandidate.promptDocument); setDuration(draftCandidate.duration); setExpiresAt(draftCandidate.expiresAt); setSubject(draftCandidate.subject); setGradeLevel(draftCandidate.gradeLevel); setQuestions(draftCandidate.questions);
    setDraftCandidate(null); setDraftStatus("Đã khôi phục bản nháp");
  }
  function discardDraft() { if (draftKey) localStorage.removeItem(draftKey); setDraftCandidate(null); setDraftStatus(""); }
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
        sessionStorage.setItem("quiz-import-override", "1");
        try {
          const draft = JSON.parse(stored) as ImportDraft;
          setTitle(draft.title); setDescription(draft.description); setPromptDocument(draft.promptDocument ?? emptyPrompt); setPromptOpen(Boolean(draft.promptDocument?.content?.length)); setDuration(draft.durationMinutes);
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
    }).catch(() => { if (mode === "view") setDetailError(t("Không tải được chi tiết bài kiểm tra. Vui lòng thử lại.")); else setFormError(t("Không tải được bài kiểm tra để sửa.")); });
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
      if (mode === "list") { sessionStorage.setItem("quiz-import-draft", JSON.stringify(draft)); router.push(quizPath + "/new"); return; }
      setSubject(""); setGradeLevel("");
      setTitle(draft.title); setDescription(draft.description); setPromptDocument(draft.promptDocument ?? emptyPrompt); setPromptOpen(Boolean(draft.promptDocument?.content?.length)); setDuration(draft.durationMinutes);
      setExpiresAt(draft.linkExpiresAt ? new Date(new Date(draft.linkExpiresAt).getTime() - new Date(draft.linkExpiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      setQuestions(draft.questions.map((question) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, points: question.points, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1 })));
      setCollapsedQuestionIds(new Set());
      setImportErrors([]); setFormError(""); setEditing(null); setFormOpen(true);
    } catch { setImportErrors([{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); }
    finally { setImportBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !assignedClass.trim()) {
      setFormError(t("Vui lòng nhập lớp được giao."));
      setFormErrorTarget("quiz-classes");
      return;
    }
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
      title, description, promptDocument, durationMinutes: duration,
      subjectId: subjects.find((item) => item.name === subject)?.id ?? null,
      gradeLevelId: gradeLevels.find((item) => item.name === gradeLevel)?.id ?? null,
      subject, gradeLevel, assignedClass: assignedClass.trim() || null,
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
    } catch { setFormError(t("Chưa lưu được bài kiểm tra. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); setBusy(false); return; }
    setBusy(false);
    if (!response.ok) { setFormError(t("Chưa lưu được bài kiểm tra. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); return; }
    const result = await response.json().catch(() => ({}));
    if (draftKey) localStorage.removeItem(draftKey);
    if (mode !== "list") { router.push(`${quizPath}/${editing ?? result.quiz?.id}`); return; }
    setNotice(!editing && result.link ? `${t("Đã tạo bài kiểm tra. Link:")} ${window.location.origin}${result.link}` : t("Đã lưu bài kiểm tra."));
    clearForm();
    setFormOpen(false);
    await load();
  }

  function clearForm() { setEditing(null); setTitle(""); setDescription(""); setPromptDocument(emptyPrompt); setPromptOpen(false); setDuration(30); setExpiresAt(""); setSubject(""); setGradeLevel(""); setAssignedClass(""); setQuestions([emptyQuestion()]); setCollapsedQuestionIds(new Set()); setQuestionError(null); }
  function closeForm() { if (busy || importBusy) return; if (draftKey && draftReady && !draftCandidate) { try { localStorage.setItem(draftKey, JSON.stringify({ savedAt: Date.now(), title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions } satisfies SavedDraft)); } catch { setDraftStatus("Không lưu được bản nháp trên trình duyệt."); } } if (mode !== "list") { router.push(editing ? `${quizPath}/${editing}` : quizPath); return; } setFormOpen(false); setFormError(""); setImportErrors([]); clearForm(); }
  function newQuiz() { router.push(quizPath + "/new"); }

  async function edit(quiz: QuizRow) {
    if (mode === "list" || mode === "view") { router.push(`${quizPath}/${quiz.id}/edit`); return; }
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`);
    if (!response.ok) { setNotice(t("Không tải được bài kiểm tra để sửa.")); return; }
    const result = await response.json();
    setEditing(quiz.id); setTitle(result.quiz.title); setDescription(result.quiz.description); setPromptDocument(result.quiz.promptDocument ?? emptyPrompt); setPromptOpen(Boolean(result.quiz.promptDocument?.content?.length)); setDuration(result.quiz.durationMinutes); setSubject(result.quiz.subject ?? ""); setGradeLevel(result.quiz.gradeLevel ?? ""); setAssignedClass(result.quiz.assignedClass ?? "");
    setExpiresAt(result.quiz.linkExpiresAt ? localDateTime(new Date(result.quiz.linkExpiresAt)) : "");
    setQuestions(result.questions.map((question: { type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number }) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1, points: question.points })));
    setCollapsedQuestionIds(new Set());
    setFormError(""); setFormOpen(true);
  }

  async function openDetail(quiz: QuizRow) {
    if (mode === "list") { router.push(`${quizPath}/${quiz.id}`); return; }
    setDetailTab("overview");
    setContentVariantId("");
    setDetailQuiz(quiz); setDetail(null); setDetailError("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setDetail(await response.json() as QuizDetail);
    } catch { setDetailError(t("Không tải được chi tiết bài kiểm tra. Vui lòng thử lại.")); }
  }

  async function showContent() {
    setDetailTab("content");
    if (!detail) return;
    const response = await fetch(`/api/teacher/quizzes/${detail.quiz.id}`, { cache: "no-store" });
    if (response.ok) setDetail(await response.json() as QuizDetail);
  }

  async function stop(quiz: QuizRow) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/stop`, { method: "POST" });
    setNotice(response.ok ? `${t("Đã ngừng bài kiểm tra:")} ${quiz.title}` : t("Không thể ngừng bài kiểm tra."));
    if (response.ok) setDetail((current) => current?.quiz.id === quiz.id ? { ...current, quiz: { ...current.quiz, status: "inactive" } } : current);
    await load();
  }

  async function deleteQuiz(quiz: QuizRow) {
    if (!window.confirm(`${t("Xóa bài kiểm tra này khỏi danh sách?")} ${quiz.title}`)) return;
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { method: "DELETE" });
    setNotice(response.ok ? t("Đã xóa bài kiểm tra khỏi danh sách. Kết quả đã nộp vẫn được giữ lại.") : t("Không xóa được bài kiểm tra."));
    if (response.ok) { await load(); if (mode === "view") router.push(quizPath); else setDetailQuiz(null); }
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
      setNotice(linkQuiz.status === "inactive" ? t("Đã mở lại và gia hạn bài kiểm tra.") : t("Đã gia hạn link."));
      setLinkQuiz(null);
      setDetail((current) => current?.quiz.id === linkQuiz.id ? { ...current, quiz: { ...current.quiz, status: "active", linkExpiresAt: date.toISOString() } } : current);
      await load();
    } catch { setLinkError(t("Không gia hạn được link. Vui lòng thử lại.")); }
    finally { setLinkBusy(false); }
  }

  function extendAttempts(quiz: QuizRow) {
    setTimeQuiz(quiz);
    setAdditionalMinutes("10");
    setTimeError("");
  }

  async function saveExtendedTime(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!timeQuiz || timeBusy) return;
    const minutes = Number(additionalMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) { setTimeError(t("Nhập số phút nguyên từ 1 đến 1440.")); return; }
    setTimeBusy(true);
    setTimeError("");
    try {
      const response = await fetch(`/api/teacher/quizzes/${timeQuiz.id}/extend-attempts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ additionalMinutes: minutes }) });
      if (!response.ok) throw new Error();
      setNotice(t("Đã gia hạn thời gian cho các lượt chưa nộp."));
      setTimeQuiz(null);
    } catch { setTimeError(t("Không gia hạn được thời gian.")); }
    finally { setTimeBusy(false); }
  }

  async function cloneQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cloneSource || !cloneClass.trim()) return;
    setCloneBusy(true);
    try { const response = await fetch(`/api/teacher/quizzes/${cloneSource.id}/clone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignedClass: cloneClass.trim() }) });
      if (!response.ok) throw new Error();
      setCloneSource(null); setCloneClass(""); setNotice("Đã clone bài kiểm tra. Bản mới đang đóng; mở thủ công khi sẵn sàng."); await load();
    } catch { setNotice("Không thể clone bài kiểm tra."); } finally { setCloneBusy(false); }
  }

  async function copyLink(quiz: QuizRow) {
    await navigator.clipboard.writeText(`${window.location.origin}/q/${quiz.linkToken}`);
    setNotice(t("Đã sao chép link bài kiểm tra."));
  }

  const contentVariant = detail?.variants?.find((variant) => variant.id === contentVariantId) ?? detail?.variants?.[0];
  const contentQuestions = contentVariant?.questions ?? detail?.questions ?? [];
  return <><DashboardNav admin={admin} /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    {mode === "list" && <PageHeader eyebrow={t(admin ? "QUẢN TRỊ" : "GIÁO VIÊN")} title={t(admin ? "Bài kiểm tra" : "Bài kiểm tra của tôi")} description={t("Tạo bài, gửi link cho học sinh và theo dõi tiến độ.")} action={<div className="flex flex-wrap gap-3"><Button type="button" onClick={newQuiz}>{t("Tạo bài kiểm tra mới")}</Button><Button type="button" variant="outline" disabled={importBusy} onClick={() => importInputRef.current?.click()}>{importBusy ? t("Đang đọc file…") : t("Nhập Excel")}</Button><Button asChild variant="outline"><a href="/api/teacher/quizzes/import-template.xlsx" download>{t("Tải file mẫu")}</a></Button><Button asChild variant="outline"><Link href={resultsPath}>{t("Xem kết quả")}</Link></Button></div>} />}
    {mode !== "list" && <PageHeader eyebrow={t(admin ? "QUẢN TRỊ" : "GIÁO VIÊN")} title={mode === "create" ? t("Tạo bài kiểm tra mới") : mode === "edit" ? t("Sửa bài kiểm tra") : t("Chi tiết bài kiểm tra")} description={mode === "create" ? t("Điền thông tin, thêm câu hỏi rồi tạo bài kiểm tra.") : undefined} action={<Button asChild variant="outline"><Link href={quizPath}>{t("Về danh sách bài kiểm tra")}</Link></Button>} />}
    <input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void importExcel(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" tabIndex={-1} aria-hidden="true" />
    {mode === "list" && importErrors.length > 0 && <div role="alert" className="mt-5 rounded-xl ds-error p-4 text-sm"><p className="font-semibold">{t("File Excel có lỗi:")}</p><ul className="mt-2 list-disc pl-5">{importErrors.map((issue, index) => <li key={index}>{issue.sheet}{issue.row ? ` · ${t("dòng")} ${issue.row}` : ""} · {issue.column}: {t(issue.message)}</li>)}</ul></div>}
    {notice && <Alert className="mt-5 break-words">{notice}</Alert>}
    {mode === "edit" && !formOpen && <div className="mt-6 rounded-2xl border border-line bg-surface p-6">{formError ? <p role="alert" className="ds-error rounded-xl p-4">{formError}</p> : <p role="status" className="text-content-muted">{t("Đang tải chi tiết…")}</p>}</div>}
    {(detailQuiz || mode === "view") && <QuizSurface fullPage={mode !== "list"} title={t("Chi tiết bài kiểm tra")} onClose={() => setDetailQuiz(null)}>
      {!detail && !detailError && <p role="status" className="py-8 text-center text-content-muted">{t("Đang tải chi tiết…")}</p>}
      {detailError && <div role="alert" className="rounded-xl ds-error p-4 text-sm">{detailError}<Button type="button" variant="outline" className="mt-3" onClick={() => { if (params.id) window.location.reload(); else if (detailQuiz) void openDetail(detailQuiz); }}>{t("Thử lại")}</Button></div>}
      {detail && <div className="space-y-6">
        <header className="rounded-2xl border border-line bg-surface-subtle p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-bold">{detail.quiz.title}</h2><p className="mt-2 text-sm text-content-muted">{detail.quiz.assignedClass ? `Lớp ${detail.quiz.assignedClass} · ` : ""}{detail.quiz.subject ? `${detail.quiz.subject} · ` : ""}{detail.quiz.durationMinutes} phút</p><p className="mt-2 text-sm font-semibold">{detail.quiz.status === "active" ? detail.quiz.linkExpiresAt && new Date(detail.quiz.linkExpiresAt) <= new Date() ? "Link đã hết hạn" : "Đang mở" : "Đã đóng"} · {detail.quiz.linkExpiresAt ? `Hạn link ${formatTimeFirst(detail.quiz.linkExpiresAt)}` : "Link không có hạn"}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{detail.quiz.status === "active" && (!detail.quiz.linkExpiresAt || new Date(detail.quiz.linkExpiresAt) > new Date()) ? <Button type="button" onClick={() => void copyLink(detail.quiz)}>Sao chép link</Button> : <Button type="button" onClick={() => openLinkExpiry(detail.quiz)}>{detail.quiz.status === "inactive" ? "Mở lại bài kiểm tra" : "Gia hạn link"}</Button>}<Button asChild variant="outline"><Link href={`${resultsPath}?quizId=${detail.quiz.id}${detail.quiz.assignedClass ? `&className=${encodeURIComponent(detail.quiz.assignedClass)}` : ""}`}>Xem kết quả</Link></Button><Button type="button" variant="outline" onClick={() => { setDetailQuiz(null); void edit(detail.quiz); }}>Sửa bài kiểm tra</Button><QuizActions quiz={detail.quiz} t={t} copyLink={copyLink} edit={edit} openLinkExpiry={openLinkExpiry} extendAttempts={extendAttempts} stop={stop} deleteQuiz={deleteQuiz} cloneQuiz={(quiz) => { setCloneSource(quiz); setCloneClass(""); }} /></div></div></header>
        <div role="tablist" aria-label="Nội dung chi tiết bài kiểm tra" className="flex gap-2 overflow-x-auto border-b border-line pb-3"><button type="button" role="tab" aria-selected={detailTab === "overview"} onClick={() => setDetailTab("overview")} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "overview" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Tổng quan</button><button type="button" role="tab" aria-selected={detailTab === "content"} onClick={() => void showContent()} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "content" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Nội dung</button><button type="button" role="tab" aria-selected={detailTab === "variants"} onClick={() => setDetailTab("variants")} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "variants" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Mã đề</button></div>
        {detailTab === "overview" && <div role="tabpanel" className="space-y-6">
        <div><h3 className="text-xl font-bold">{detail.quiz.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-content-muted">{detail.quiz.description || t("Chưa có mô tả.")}</p></div>
        {detail.quiz.subject && <p className="text-sm"><strong>{t("Môn học")}:</strong> {detail.quiz.subject}</p>}
        {detail.quiz.assignedClass && <p className="text-sm"><strong>Lớp được giao:</strong> {detail.quiz.assignedClass}</p>}
        {detail.quiz.gradeLevel && <p className="text-sm"><strong>{t("Khối lớp")}:</strong> {detail.quiz.gradeLevel}</p>}
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Trạng thái")}</p><p className="mt-1 font-semibold">{detail.quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Thời lượng")}</p><p className="mt-1 font-semibold">{detail.quiz.durationMinutes} {t("phút")}</p></div><div className="rounded-xl bg-surface-subtle p-4"><p className="text-sm text-content-muted">{t("Hạn dùng link")}</p><p className="mt-1 font-semibold">{detail.quiz.linkExpiresAt ? formatTimeFirst(detail.quiz.linkExpiresAt) : t("Không có hạn")}</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-line p-4"><p className="text-sm text-content-muted">Nội dung</p><p className="mt-1 font-semibold">{detail.questions.length} câu hỏi · {detail.questions.reduce((total, question) => total + question.points, 0)} điểm mã chính</p></div><div className="rounded-xl border border-line p-4"><p className="text-sm text-content-muted">Lớp được giao</p><p className="mt-1 font-semibold">{detail.quiz.assignedClass ?? "Chưa gắn lớp"}</p></div></div>
        </div>}
        {detailTab === "content" && <div role="tabpanel" className="space-y-6">
        <div className="flex flex-wrap items-center gap-3"><label htmlFor="content-variant" className="text-sm font-semibold">Xem mã đề</label><select id="content-variant" value={contentVariant?.id ?? ""} onChange={(event) => setContentVariantId(event.target.value)} className="min-h-11 rounded-xl border border-line bg-surface px-3">{detail.variants?.map((variant) => <option key={variant.id} value={variant.id}>Mã {variant.code}{variant.active ? "" : " · Tắt"}</option>)}</select><span className="text-sm text-content-muted">{contentQuestions.length} câu · {contentQuestions.reduce((sum, question) => sum + question.points, 0)} điểm</span></div>
        {Boolean(detail.quiz.promptDocument?.content?.length) && <section><h4 className="font-semibold">{t("Đề bài")}</h4><PromptView document={detail.quiz.promptDocument!} /></section>}
        <section><h4 className="font-semibold">{t("Câu hỏi")} ({detail.questions.length})</h4><div className="mt-3 space-y-3">{contentQuestions.map((question, index) => <div key={question.id} className="rounded-xl border border-line p-4"><p className="text-sm font-semibold text-content-muted">{t("Câu")} {index + 1} · {question.type === "choice" ? t("Trắc nghiệm") : t("Tự luận")} · {question.points} {t("điểm")}</p><p className="mt-2 whitespace-pre-wrap font-medium">{question.prompt}</p>{question.type === "choice" && <ol className="mt-3 space-y-1 pl-5 text-sm">{question.options.map((option, optionIndex) => <li key={optionIndex} className={`list-decimal ${optionIndex === question.correctOption ? "font-semibold text-emerald-700" : ""}`}>{option}{optionIndex === question.correctOption ? ` · ${t("Đáp án đúng")}` : ""}</li>)}</ol>}</div>)}</div></section>
        </div>}
        {detailTab === "variants" && <div role="tabpanel"><QuizVariants quizId={detail.quiz.id} /></div>}
      </div>}
    </QuizSurface>}
    {timeQuiz && <Modal title={t("Cộng thời gian làm")} closeLabel={t("Đóng")} onClose={() => { if (!timeBusy) setTimeQuiz(null); }}>
      <form onSubmit={(event) => { void saveExtendedTime(event); }} className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-subtle p-4"><p className="font-semibold">{timeQuiz.title}</p><p className="mt-2 text-sm text-content-muted">{t("Cộng thêm cho mọi lượt chưa nộp. Lượt đã nộp và thời lượng của lượt mới không đổi.")}</p></div>
        <label className="block text-sm font-semibold">{t("Số phút cộng thêm")}<input type="number" min="1" max="1440" step="1" required value={additionalMinutes} onChange={(event) => { setAdditionalMinutes(event.target.value); setTimeError(""); }} className="ds-field mt-2" /></label>
        {timeError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{timeError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><Button type="button" variant="outline" disabled={timeBusy} onClick={() => setTimeQuiz(null)}>{t("Hủy")}</Button><Button type="submit" disabled={timeBusy}>{timeBusy ? t("Đang lưu…") : t("Cộng thời gian")}</Button></div>
      </form>
    </Modal>}
    {linkQuiz && <Modal title={linkQuiz.status === "inactive" ? t("Mở lại bài kiểm tra") : t("Gia hạn link bài kiểm tra")} closeLabel={t("Đóng")} onClose={() => { if (!linkBusy) setLinkQuiz(null); }}>
      <form onSubmit={extendLink} className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-subtle p-4">
          <p className="font-semibold">{linkQuiz.title}</p>
          <p className="mt-1 text-sm text-content-muted">{linkQuiz.status === "inactive" ? t("Bài kiểm tra sẽ mở lại để học sinh truy cập bằng link cũ.") : t("Học sinh tiếp tục dùng link hiện tại đến hạn mới.")}</p>
          <p className="mt-2 text-sm text-content-muted">{t("Hạn hiện tại:")} {linkQuiz.linkExpiresAt ? formatTimeFirst(linkQuiz.linkExpiresAt) : t("Không có hạn")}</p>
        </div>
        <div>
          <TimeFirstDateTime label={t("Hạn truy cập mới")} value={newLinkExpiry} onChange={(value) => { setNewLinkExpiry(value); setLinkError(""); }} required t={t} />
          <p id="new-link-expiry-help" className="mt-2 text-sm text-content-muted">{t("Ngày giờ theo múi giờ trên thiết bị của bạn.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">{[1, 7, 30].map((days) => <button key={days} type="button" onClick={() => { setNewLinkExpiry(localDateTime(new Date(Date.now() + days * 24 * 60 * 60 * 1000))); setLinkError(""); }} className="min-h-11 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-subtle">{t("Sau")} {days} {t("ngày")}</button>)}</div>
        </div>
        {linkError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{linkError}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4"><Button type="button" variant="outline" disabled={linkBusy} onClick={() => setLinkQuiz(null)}>{t("Hủy")}</Button><Button type="submit" disabled={linkBusy}>{linkBusy ? t("Đang lưu…") : linkQuiz.status === "inactive" ? t("Mở lại bài kiểm tra") : t("Lưu hạn mới")}</Button></div>
      </form>
    </Modal>}
    {cloneSource && <Modal title="Nhân bản bài kiểm tra cho lớp khác" onClose={() => setCloneSource(null)}><form onSubmit={cloneQuiz} className="space-y-4"><p>{cloneSource.title}</p><label className="block text-sm font-medium">Lớp đích<input required maxLength={80} value={cloneClass} onChange={(event) => setCloneClass(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><p className="text-sm text-content-muted">Bản sao có link riêng và đang đóng. Mở bài kiểm tra sau khi kiểm tra nội dung.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCloneSource(null)}>Hủy</Button><Button type="submit" disabled={cloneBusy}>Nhân bản bài kiểm tra</Button></div></form></Modal>}
    {draftCandidate && <Modal title="Bản nháp bài kiểm tra" onClose={discardDraft}><p>Bạn có bản nháp lưu lúc {new Date(draftCandidate.savedAt).toLocaleString("vi-VN")}. Khôi phục để tiếp tục làm?</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={discardDraft}>Bỏ bản nháp</Button><Button type="button" onClick={restoreDraft}>Khôi phục</Button></div></Modal>}
    {formOpen && <QuizSurface fullPage={mode !== "list"} title={editing ? t("Sửa bài kiểm tra") : t("Tạo bài kiểm tra mới")} onClose={closeForm}><form onSubmit={save} className={mode === "create" ? "mx-auto max-w-3xl" : "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6"}>{mode !== "create" && <nav aria-label={t("Mục lục tạo bài kiểm tra")} className="mb-6 rounded-xl border border-line bg-surface-subtle p-3 lg:sticky lg:top-6 lg:mb-0"><p className="px-2 pb-2 text-sm font-bold">{t("Nội dung bài kiểm tra")}</p><select aria-label={t("Mục lục tạo bài kiểm tra")} defaultValue="" onChange={(event) => document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth" })} className="w-full rounded-xl border border-line px-3 py-2 lg:hidden"><option value="" disabled>{t("Chọn mục")}</option><option value="quiz-info">{t("Thông tin bài kiểm tra")}</option><option value="quiz-classes">{t("Môn học và lớp")} ()</option><option value="quiz-questions">{t("Câu hỏi")} ({questions.length})</option><option value="quiz-prompt">{t("Đề bài")}</option></select><div className="hidden gap-1 lg:grid"><a href="#quiz-info" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Thông tin bài kiểm tra")}</a><a href="#quiz-classes" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Môn học và lớp")} ()</a><a href="#quiz-questions" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Câu hỏi")} ({questions.length})</a><a href="#quiz-prompt" className="rounded-lg px-2 py-2 text-sm hover:bg-surface">{t("Đề bài")}</a></div></nav>}<div className="min-w-0 space-y-6">
      {draftStatus && <p role="status" className="text-sm text-content-muted">{draftStatus}</p>}
      {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}{formErrorTarget && <a href={`#${formErrorTarget}`} className="ml-2 font-semibold underline">{t("Đến phần cần sửa")}</a>}</p>}

      <h3 id="quiz-info" className="scroll-mt-6 flex items-center gap-3 border-b border-line pb-3 text-lg font-bold">{mode === "create" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full ds-gradient text-sm text-white">1</span>}{t("Thông tin bài kiểm tra")}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">{t("Tên bài kiểm tra")}<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><label className="text-sm font-medium">{t("Thời lượng (phút)")}<input required type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>{editing && <label className="text-sm font-medium sm:col-span-2">{t("Mô tả")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>}{<div className="sm:col-span-2"><TimeFirstDateTime label={t("Hạn dùng link (để trống nếu không hết hạn)")} value={expiresAt} onChange={setExpiresAt} t={t} /></div>}</div>
      <section id="quiz-classes" className="scroll-mt-6">{!editing && <label className="mb-4 block text-sm font-medium">Lớp được giao *<input required maxLength={80} value={assignedClass} onChange={(event) => setAssignedClass(event.target.value)} placeholder="Ví dụ: 9/7" className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label>}{editing && assignedClass && <p className="mb-4 text-sm">Lớp được giao: <strong>{assignedClass}</strong></p>}<div className="grid gap-4 sm:grid-cols-2">{([["Môn học", subject, setSubject, subjects], ["Khối lớp", gradeLevel, setGradeLevel, gradeLevels]] as const).map(([label, value, setter, items]) => <div key={label} className="text-sm font-medium"><span className="mb-2 block">{t(label)}</span><Select value={value} onValueChange={setter} ariaLabel={t(label)} options={[{ value: "", label: `${t("Chọn")} ${t(label)}` }, ...(value && !items.some((item) => item.name === value) ? [{ value, label: `${value} (${t("Đã xóa")})` }] : []), ...items.map((item) => ({ value: item.name, label: item.name }))]} /></div>)}</div></section>
      <div id="quiz-questions" className="scroll-mt-6 border-t border-line pt-6"><h3 className="flex items-center gap-3 text-lg font-bold">{mode === "create" && <span className="flex size-8 shrink-0 items-center justify-center rounded-full ds-gradient text-sm text-white">2</span>}{t("Câu hỏi")}</h3><p className="mt-1 text-sm text-content-muted">{t("Chọn loại câu hỏi, nhập nội dung và đáp án bên dưới.")}</p></div>
      <DragDropProvider onDragEnd={(event) => { if (event.canceled || !isSortable(event.operation.source)) return; const { initialIndex, index } = event.operation.source; if (initialIndex === index) return; setQuestions((current) => { const next = [...current]; const [moved] = next.splice(initialIndex, 1); next.splice(index, 0, moved); return next; }); setQuestionError(null); setFormError(""); setFormErrorTarget(""); }}><div className="space-y-4">{questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} count={questions.length} collapsed={collapsedQuestionIds.has(question.id)} toggle={() => toggleQuestion(question.id)} duplicate={() => duplicateQuestion(index)} error={questionError === index ? questionErrorMessage : undefined} t={t} update={(changes) => updateQuestion(index, changes)} remove={() => { setQuestions((items) => items.filter((_, i) => i !== index)); setQuestionError(null); }} />)}</div></DragDropProvider>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("choice")}>{t("+ Câu trắc nghiệm")}</Button><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("essay")}>{t("+ Câu tự luận")}</Button></div>
      <details id="quiz-prompt" className="scroll-mt-6 rounded-2xl border border-line bg-surface-subtle p-4" open={promptOpen} onToggle={(event) => setPromptOpen(event.currentTarget.open)}><summary className="cursor-pointer font-semibold">{t("Đề bài (tùy chọn)")}</summary><div className="mt-4"><PromptEditor value={promptDocument} onChange={setPromptDocument} /></div></details>
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4 sm:-mx-7 sm:px-7"><p className="text-sm text-content-muted">{questions.length} {t("câu hỏi")}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={busy || importBusy}>{t("Hủy")}</Button><Button type="submit" disabled={busy || uploading || importBusy}>{busy ? t("Đang lưu…") : editing ? t("Lưu thay đổi") : t("Tạo bài kiểm tra")}</Button></div></div>
    </div></form></QuizSurface>}
    {mode === "list" && <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm bài kiểm tra")} className="min-w-0 flex-1 rounded-xl border border-line px-4 py-3" /><Select value={status} onValueChange={setStatus} ariaLabel={t("Tất cả trạng thái")} options={[{ value: "", label: t("Tất cả trạng thái") }, { value: "active", label: t("Đang mở") }, { value: "inactive", label: t("Đã ngừng") }]} className="sm:w-56" /></div>
      <div className="mt-5 grid gap-3">{quizzes.map((quiz) => <article key={quiz.id} className="flex flex-col justify-between gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center"><button type="button" onClick={() => void openDetail(quiz)} className="min-w-0 flex-1 rounded-lg text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${t("Xem chi tiết bài kiểm tra")}: ${quiz.title}`}><h3 className="font-bold">{quiz.title}</h3><p className="mt-1 text-sm text-content-muted">{quiz.durationMinutes} {t("phút")} · {quiz.status === "active" ? t("Đang mở") : t("Đã ngừng")}{quiz.linkExpiresAt ? ` · ${t("Hết link")} ${formatTimeFirst(quiz.linkExpiresAt)}` : ""}</p><span className="mt-2 block text-xs font-medium text-brand">{t("Xem chi tiết")}</span></button><QuizActions quiz={quiz} t={t} copyLink={copyLink} edit={edit} openLinkExpiry={openLinkExpiry} extendAttempts={extendAttempts} stop={stop} deleteQuiz={deleteQuiz} cloneQuiz={(quiz) => { setCloneSource(quiz); setCloneClass(""); }} /></article>)}{quizzes.length === 0 && <EmptyState title={t("Chưa có bài kiểm tra.")} />}</div>
    </section>}
  </div></main></>;
}
