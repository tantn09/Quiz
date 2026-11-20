"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useErrorToast } from "@/components/ui/toast";
import { Input, Textarea } from "@/components/ui/field";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/page-layouts";
import { Modal } from "@/components/modal";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { QuizDetailPanels, formatTimeFirst, type QuizDetail } from "@/features/quizzes/quiz-detail-panels";
import { useQuizDraft, type SavedDraft } from "@/features/quizzes/use-quiz-draft";
import { localDateTime, QuestionEditor, QuizActions, QuizSurface, TimeFirstDateTime, type QuestionDraft, type QuizRow } from "@/features/quizzes/quiz-controls";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { previewQuizImport, type ImportDraft, type ImportIssue } from "@/features/quizzes/quiz-import";
import { useQuizLink } from "@/features/quizzes/use-quiz-link";
import { QuizEditorForm } from "@/features/quizzes/quiz-editor-form";
import { QuizList } from "@/features/quizzes/quiz-list";
import { Select } from "@/components/ui/select";
import { PromptEditor, emptyPrompt, type PromptDocument } from "@/components/prompt-editor";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";


type CatalogItem = { id: string; name: string };
const emptyQuestion = (): QuestionDraft => ({ id: crypto.randomUUID(), type: "choice", prompt: "", options: ["", ""], correctOption: -1, points: 1 });
export default function TeacherPage({ mode = "list", admin }: { admin: boolean; mode?: "list" | "create" | "view" | "edit" }) {
  const quizPath = admin ? "/admin/quiz" : "/teacher/quiz";
  const resultsPath = admin ? "/admin/results" : "/teacher/results";
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const [listLoading, setListLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
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
  const [timeQuiz, setTimeQuiz] = useState<QuizRow | null>(null);
  const [additionalMinutes, setAdditionalMinutes] = useState("10");
  const [timeError, setTimeError] = useState("");
  const [timeBusy, setTimeBusy] = useState(false);
  const [detailQuiz, setDetailQuiz] = useState<QuizRow | null>(null);
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "content" | "variants">("overview");
  const [contentVariantId, setContentVariantId] = useState("");
  const [detailError, setDetailError] = useState(false);
  const { draftKey, draftCandidate, draftReady, draftStatus, setDraftCandidate, setDraftStatus, discardDraft } = useQuizDraft({
    mode, quizId: params.id, formOpen, title, description, promptDocument, duration, expiresAt, subject, gradeLevel, questions,
  });
  function restoreDraft() {
    if (!draftCandidate) return;
    setTitle(draftCandidate.title); setDescription(draftCandidate.description); setPromptDocument(draftCandidate.promptDocument); setDuration(draftCandidate.duration); setExpiresAt(draftCandidate.expiresAt); setSubject(draftCandidate.subject); setGradeLevel(draftCandidate.gradeLevel); setQuestions(draftCandidate.questions);
    setDraftCandidate(null); setDraftStatus("Đã khôi phục bản nháp");
  }
  const t = useTranslation();
  const showError = useErrorToast();
  useEffect(() => { void fetch("/api/teacher/catalogs", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json(); setSubjects(data.subjects); setGradeLevels(data.gradeLevels); }).catch(() => showError(t("Không tải được danh mục."))).finally(() => setCatalogLoading(false)); }, [showError, t]);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    const response = await fetch(`/api/teacher/quizzes?${query}`, { cache: "no-store" });
    if (!response.ok) { showError(t("Không tải được danh sách bài kiểm tra.")); return; }
    setQuizzes((await response.json()).quizzes);
  }, [search, status, showError, t]);

  useEffect(() => { if (mode === "list") void load().catch(() => showError(t("Không tải được danh sách bài kiểm tra."))).finally(() => setListLoading(false)); }, [load, mode, showError, t]);
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
        } catch { showError(t("Không đọc được file Excel.")); }
      }
      setFormOpen(true); return;
    }
    if (!params.id) return;
    const response = fetch(`/api/teacher/quizzes/${params.id}`, { cache: "no-store" });
    void response.then(async (result) => {
      if (!result.ok) throw new Error();
      const payload = await result.json() as QuizDetail;
      if (mode === "view") { setDetailQuiz(payload.quiz); setDetail(payload); }
      if (mode === "edit") void edit(payload.quiz, payload);
    }).catch(() => { setDetailError(true); showError(t(mode === "view" ? "Không tải được chi tiết bài kiểm tra. Vui lòng thử lại." : "Không tải được bài kiểm tra để sửa.")); });
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
      const { response, payload } = await previewQuizImport(file);
      if (!response.ok || !payload.draft) { showError(t("Không đọc được file Excel.")); setImportErrors(payload.errors?.length ? payload.errors : [{ sheet: "File", row: 0, column: "file", message: t("Không đọc được file Excel.") }]); return; }
      const draft = payload.draft;
      if (mode === "list") { sessionStorage.setItem("quiz-import-draft", JSON.stringify(draft)); router.push(quizPath + "/new"); return; }
      setSubject(""); setGradeLevel("");
      setTitle(draft.title); setDescription(draft.description); setPromptDocument(draft.promptDocument ?? emptyPrompt); setPromptOpen(Boolean(draft.promptDocument?.content?.length)); setDuration(draft.durationMinutes);
      setExpiresAt(draft.linkExpiresAt ? new Date(new Date(draft.linkExpiresAt).getTime() - new Date(draft.linkExpiresAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
      setQuestions(draft.questions.map((question) => ({ id: crypto.randomUUID(), type: question.type, prompt: question.prompt, points: question.points, options: question.options.length ? question.options : ["", ""], correctOption: question.correctOption ?? -1 })));
      setCollapsedQuestionIds(new Set());
      setImportErrors([]); setFormError(""); setEditing(null); setFormOpen(true);
    } catch { showError(t("Không đọc được file Excel.")); }
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
    } catch { showError(t("Chưa lưu được bài kiểm tra. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); setBusy(false); return; }
    setBusy(false);
    if (!response.ok) { showError(t("Chưa lưu được bài kiểm tra. Kiểm tra câu trắc nghiệm có ít nhất hai lựa chọn và đáp án đúng hợp lệ.")); return; }
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

  async function edit(quiz: QuizRow, result?: QuizDetail) {
    if (mode === "list" || mode === "view") { router.push(`${quizPath}/${quiz.id}/edit`); return; }
    if (!result) { setDetailError(true); showError(t("Không tải được bài kiểm tra để sửa.")); return; }
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
    setDetailQuiz(quiz); setDetail(null); setDetailError(false);
    try {
      const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setDetail(await response.json() as QuizDetail);
    } catch { showError(t("Không tải được chi tiết bài kiểm tra. Vui lòng thử lại.")); setDetailError(true); }
  }

  async function showContent() {
    setDetailTab("content");
    if (!detail) return;
    const response = await fetch(`/api/teacher/quizzes/${detail.quiz.id}`, { cache: "no-store" });
    if (!response.ok) { showError(t("Không tải được chi tiết bài kiểm tra. Vui lòng thử lại.")); return; }
    setDetail(await response.json() as QuizDetail);
  }

  async function stop(quiz: QuizRow) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/stop`, { method: "POST" });
    if (response.ok) setNotice(`${t("Đã ngừng bài kiểm tra:")} ${quiz.title}`);
    else showError(t("Không thể ngừng bài kiểm tra."));
    if (response.ok) setDetail((current) => current?.quiz.id === quiz.id ? { ...current, quiz: { ...current.quiz, status: "inactive" } } : current);
    await load();
  }

  async function deleteQuiz(quiz: QuizRow) {
    if (!window.confirm(`${t("Xóa bài kiểm tra này khỏi danh sách?")} ${quiz.title}`)) return;
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}`, { method: "DELETE" });
    if (response.ok) setNotice(t("Đã xóa bài kiểm tra khỏi danh sách. Kết quả đã nộp vẫn được giữ lại."));
    else showError(t("Không xóa được bài kiểm tra."));
    if (response.ok) { await load(); if (mode === "view") router.push(quizPath); else setDetailQuiz(null); }
  }

  const { linkQuiz, setLinkQuiz, newLinkExpiry, setNewLinkExpiry, linkError, setLinkError, linkBusy, openLinkExpiry, extendLink, copyLink } = useQuizLink({ load, setDetail, setNotice });

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
    } catch { showError(t("Không gia hạn được thời gian.")); }
    finally { setTimeBusy(false); }
  }

  async function cloneQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cloneSource || !cloneClass.trim()) return;
    setCloneBusy(true);
    try { const response = await fetch(`/api/teacher/quizzes/${cloneSource.id}/clone`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignedClass: cloneClass.trim() }) });
      if (!response.ok) throw new Error();
      setCloneSource(null); setCloneClass(""); setNotice("Đã clone bài kiểm tra. Bản mới đang đóng; mở thủ công khi sẵn sàng."); await load();
    } catch { showError(t("Không thể clone bài kiểm tra.")); } finally { setCloneBusy(false); }
  }


  const contentVariant = detail?.variants?.find((variant) => variant.id === contentVariantId) ?? detail?.variants?.[0];
  const contentQuestions = contentVariant?.questions ?? detail?.questions ?? [];

  if ((mode === "list" && listLoading) || ((mode === "create" || mode === "edit") && catalogLoading)
    || (!detailError && (mode === "edit" && !formOpen || mode === "view" && !detail))) return <LoadingScreen />;

  return <DashboardLayout admin={admin} compact={mode === "create"}>
    {mode === "list" && <PageHeader eyebrow={t(admin ? "QUẢN TRỊ" : "GIÁO VIÊN")} title={t(admin ? "Bài kiểm tra" : "Bài kiểm tra của tôi")} description={t("Tạo bài, gửi link cho học sinh và theo dõi tiến độ.")} action={<div className="flex flex-wrap gap-3"><Button type="button" onClick={newQuiz}>{t("Tạo bài kiểm tra mới")}</Button><Button type="button" variant="outline" disabled={importBusy} onClick={() => importInputRef.current?.click()}>{importBusy ? t("Đang đọc file…") : t("Nhập Excel")}</Button><Button asChild variant="outline"><a href="/api/teacher/quizzes/import-template.xlsx" download>{t("Tải file mẫu")}</a></Button><Button asChild variant="outline"><Link href={resultsPath}>{t("Xem kết quả")}</Link></Button></div>} />}
    {mode !== "list" && <div className={mode === "create" ? "px-[calc(1.25rem+1px)] sm:px-[calc(2rem+1px)]" : undefined}><PageHeader eyebrow={t(admin ? "QUẢN TRỊ" : "GIÁO VIÊN")} title={mode === "create" ? t("Tạo bài kiểm tra mới") : mode === "edit" ? t("Sửa bài kiểm tra") : t("Chi tiết bài kiểm tra")} description={mode === "create" ? t("Điền thông tin, thêm câu hỏi rồi tạo bài kiểm tra.") : undefined} action={<Button asChild variant="outline"><Link href={quizPath}>{t("Về danh sách bài kiểm tra")}</Link></Button>} /></div>}
    <Input ref={importInputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { void importExcel(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" tabIndex={-1} aria-hidden="true" />
    {mode === "list" && importErrors.length > 0 && <div role="alert" className="mt-5 rounded-xl ds-error p-4 text-sm"><p className="font-semibold">{t("File Excel có lỗi:")}</p><ul className="mt-2 list-disc pl-5">{importErrors.map((issue, index) => <li key={index}>{issue.sheet}{issue.row ? ` · ${t("dòng")} ${issue.row}` : ""} · {issue.column}: {t(issue.message)}</li>)}</ul></div>}
    {notice && <Alert className="mt-5 break-words">{notice}</Alert>}
    {(detailQuiz || mode === "view") && !detailError && <QuizSurface fullPage={mode !== "list"} title={t("Chi tiết bài kiểm tra")} onClose={() => setDetailQuiz(null)}>
      {!detail && <LoadingScreen />}
      {detail && <div className="space-y-6">
        <header className="rounded-2xl border border-line bg-surface-subtle p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-bold">{detail.quiz.title}</h2><p className="mt-2 text-sm text-content-muted">{detail.quiz.assignedClass ? `Lớp ${detail.quiz.assignedClass} · ` : ""}{detail.quiz.subject ? `${detail.quiz.subject} · ` : ""}{detail.quiz.durationMinutes} phút</p><p className="mt-2 text-sm font-semibold">{detail.quiz.status === "active" ? detail.quiz.linkExpiresAt && new Date(detail.quiz.linkExpiresAt) <= new Date() ? "Link đã hết hạn" : "Đang mở" : "Đã đóng"} · {detail.quiz.linkExpiresAt ? `Hạn link ${formatTimeFirst(detail.quiz.linkExpiresAt)}` : "Link không có hạn"}</p></div><div className="flex w-full flex-wrap gap-2 sm:w-auto">{detail.quiz.status === "active" && (!detail.quiz.linkExpiresAt || new Date(detail.quiz.linkExpiresAt) > new Date()) ? <Button type="button" onClick={() => void copyLink(detail.quiz)}>Sao chép link</Button> : <Button type="button" onClick={() => openLinkExpiry(detail.quiz)}>{detail.quiz.status === "inactive" ? "Mở lại bài kiểm tra" : "Gia hạn link"}</Button>}<Button asChild variant="outline"><Link href={`${resultsPath}?quizId=${detail.quiz.id}${detail.quiz.assignedClass ? `&className=${encodeURIComponent(detail.quiz.assignedClass)}` : ""}`}>Xem kết quả</Link></Button><Button type="button" variant="outline" onClick={() => { setDetailQuiz(null); void edit(detail.quiz); }}>Sửa bài kiểm tra</Button><QuizActions quiz={detail.quiz} t={t} copyLink={copyLink} edit={edit} openLinkExpiry={openLinkExpiry} extendAttempts={extendAttempts} stop={stop} deleteQuiz={deleteQuiz} cloneQuiz={(quiz) => { setCloneSource(quiz); setCloneClass(""); }} /></div></div></header>
        <div role="tablist" aria-label="Nội dung chi tiết bài kiểm tra" className="flex gap-2 overflow-x-auto border-b border-line pb-3"><button type="button" role="tab" aria-selected={detailTab === "overview"} onClick={() => setDetailTab("overview")} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "overview" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Tổng quan</button><button type="button" role="tab" aria-selected={detailTab === "content"} onClick={() => void showContent()} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "content" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Nội dung</button><button type="button" role="tab" aria-selected={detailTab === "variants"} onClick={() => setDetailTab("variants")} className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-focus ${detailTab === "variants" ? "bg-brand text-brand-foreground" : "border border-line"}`}>Mã đề</button></div>
        <QuizDetailPanels detail={detail} detailTab={detailTab} contentVariant={contentVariant} contentQuestions={contentQuestions} selectVariant={setContentVariantId} />
      </div>}
    </QuizSurface>}
    {timeQuiz && <Modal title={t("Cộng thời gian làm")} closeLabel={t("Đóng")} onClose={() => { if (!timeBusy) setTimeQuiz(null); }}>
      <form onSubmit={(event) => { void saveExtendedTime(event); }} className="space-y-5">
        <div className="rounded-xl border border-line bg-surface-subtle p-4"><p className="font-semibold">{timeQuiz.title}</p><p className="mt-2 text-sm text-content-muted">{t("Cộng thêm cho mọi lượt chưa nộp. Lượt đã nộp và thời lượng của lượt mới không đổi.")}</p></div>
        <label className="block text-sm font-semibold">{t("Số phút cộng thêm")}<Input type="number" min="1" max="1440" step="1" required value={additionalMinutes} onChange={(event) => { setAdditionalMinutes(event.target.value); setTimeError(""); }} className="ds-field mt-2" /></label>
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
    {cloneSource && <Modal title="Nhân bản bài kiểm tra cho lớp khác" onClose={() => setCloneSource(null)}><form onSubmit={cloneQuiz} className="space-y-4"><p>{cloneSource.title}</p><label className="block text-sm font-medium">Lớp đích<Input required maxLength={80} value={cloneClass} onChange={(event) => setCloneClass(event.target.value)} className="mt-2 w-full rounded-xl border border-line px-4 py-3" /></label><p className="text-sm text-content-muted">Bản sao có link riêng và đang đóng. Mở bài kiểm tra sau khi kiểm tra nội dung.</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCloneSource(null)}>Hủy</Button><Button type="submit" disabled={cloneBusy}>Nhân bản bài kiểm tra</Button></div></form></Modal>}
    {draftCandidate && <Modal title="Bản nháp bài kiểm tra" onClose={discardDraft}><p>Bạn có bản nháp lưu lúc {new Date(draftCandidate.savedAt).toLocaleString("vi-VN")}. Khôi phục để tiếp tục làm?</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={discardDraft}>Bỏ bản nháp</Button><Button type="button" onClick={restoreDraft}>Khôi phục</Button></div></Modal>}
    {formOpen && <QuizSurface fullPage={mode !== "list"} title={editing ? t("Sửa bài kiểm tra") : t("Tạo bài kiểm tra mới")} onClose={closeForm}><QuizEditorForm onSubmit={save} creating={mode === "create"} questionCount={questions.length}>
      {draftStatus && <p role="status" className="text-sm text-content-muted">{draftStatus}</p>}
      {formError && <p role="alert" className="rounded-xl ds-error p-3 text-sm">{formError}{formErrorTarget && <a href={`#${formErrorTarget}`} className="ml-2 font-semibold underline">{t("Đến phần cần sửa")}</a>}</p>}

      <h3 id="quiz-info" className="scroll-mt-6 flex items-center gap-3 border-b border-line pb-3 text-lg font-bold">{t("Thông tin bài kiểm tra")}</h3>
      <div className="mt-5 grid gap-4 @min-[36rem]:grid-cols-2"><label className="text-sm font-medium">{t("Tên bài kiểm tra")}<Input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" /></label><label className="text-sm font-medium">{t("Thời lượng (phút)")}<Input required type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2" /></label>{editing && <label className="text-sm font-medium @min-[36rem]:col-span-2">{t("Mô tả")}<Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-2" /></label>}{<div className="@min-[36rem]:col-span-2"><TimeFirstDateTime label={t("Hạn dùng link (để trống nếu không hết hạn)")} value={expiresAt} onChange={(value) => { setExpiresAt(value); if (formErrorTarget === "quiz-info") { setFormError(""); setFormErrorTarget(""); } }} invalid={formErrorTarget === "quiz-info"} t={t} /></div>}</div>
      <section id="quiz-classes" className="scroll-mt-6">{!editing && <label className="mb-4 block text-sm font-medium">{t("Lớp được giao")} *<Input required maxLength={80} value={assignedClass} onChange={(event) => setAssignedClass(event.target.value)} placeholder={t("Ví dụ: 9/7")} className="mt-2" /></label>}{editing && assignedClass && <p className="mb-4 text-sm">Lớp được giao: <strong>{assignedClass}</strong></p>}<div className="grid gap-4 @min-[36rem]:grid-cols-2">{([["Môn học", subject, setSubject, subjects], ["Khối lớp", gradeLevel, setGradeLevel, gradeLevels]] as const).map(([label, value, setter, items]) => <div key={label} className="text-sm font-medium"><span className="mb-2 block">{t(label)}</span><Select value={value} onValueChange={setter} ariaLabel={t(label)} options={[{ value: "", label: `${t("Chọn")} ${t(label)}` }, ...(value && !items.some((item) => item.name === value) ? [{ value, label: `${value} (${t("Đã xóa")})` }] : []), ...items.map((item) => ({ value: item.name, label: item.name }))]} /></div>)}</div></section>
      <div id="quiz-questions" className="scroll-mt-6 border-t border-line pt-6"><h3 className="flex items-center gap-3 text-lg font-bold">{t("Câu hỏi")}</h3><p className="mt-1 text-sm text-content-muted">{t("Chọn loại câu hỏi, nhập nội dung và đáp án bên dưới.")}</p></div>
      <DragDropProvider onDragEnd={(event) => { if (event.canceled || !isSortable(event.operation.source)) return; const { initialIndex, index } = event.operation.source; if (initialIndex === index) return; setQuestions((current) => { const next = [...current]; const [moved] = next.splice(initialIndex, 1); next.splice(index, 0, moved); return next; }); setQuestionError(null); setFormError(""); setFormErrorTarget(""); }}><div className="space-y-4">{questions.map((question, index) => <QuestionEditor key={question.id} question={question} index={index} count={questions.length} collapsed={collapsedQuestionIds.has(question.id)} toggle={() => toggleQuestion(question.id)} duplicate={() => duplicateQuestion(index)} error={questionError === index ? questionErrorMessage : undefined} t={t} update={(changes) => updateQuestion(index, changes)} remove={() => { setQuestions((items) => items.filter((_, i) => i !== index)); setQuestionError(null); }} />)}</div></DragDropProvider>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("choice")}>{t("+ Câu trắc nghiệm")}</Button><Button type="button" variant="outline" disabled={questions.length >= 200} onClick={() => addQuestion("essay")}>{t("+ Câu tự luận")}</Button></div>
      <details id="quiz-prompt" className="scroll-mt-6 border-t border-line pt-4" open={promptOpen} onToggle={(event) => setPromptOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer content-center rounded-xl font-semibold hover:text-brand">{t("Đề bài (tùy chọn)")}</summary><div className="mt-4"><PromptEditor value={promptDocument} onChange={setPromptDocument} /></div></details>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><p className="text-sm text-content-muted">{questions.length} {t("câu hỏi")}</p><div className="ml-auto flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={closeForm} disabled={busy || importBusy}>{t("Hủy")}</Button><Button type="submit" disabled={busy || uploading || importBusy}>{busy ? t("Đang lưu…") : editing ? t("Lưu thay đổi") : t("Tạo bài kiểm tra")}</Button></div></div>
    </QuizEditorForm></QuizSurface>}
    {mode === "list" && <QuizList quizzes={quizzes} search={search} setSearch={setSearch} status={status} setStatus={setStatus}
      openDetail={openDetail} copyLink={copyLink} edit={edit} openLinkExpiry={openLinkExpiry} extendAttempts={extendAttempts}
      stop={stop} deleteQuiz={deleteQuiz} cloneQuiz={(quiz) => { setCloneSource(quiz); setCloneClass(""); }} />}
  </DashboardLayout>;
}
