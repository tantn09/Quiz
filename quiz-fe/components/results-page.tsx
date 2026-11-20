"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { useLocale, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Download, Ellipsis, Trash2 } from "lucide-react";

type ResultGroup = { quizId: string; quizTitle: string; className: string; inProgress: number; submitted: number; needsReview: number; graded: number };

function ResultActions({ group, download, remove }: { group: ResultGroup; download: () => void; remove: () => void }) {
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
  return <div ref={menuRef} className="relative shrink-0"><button type="button" aria-label={`Tùy chọn kết quả: ${group.quizTitle}, lớp ${group.className}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus"><Ellipsis size={20} aria-hidden="true" /></button>{open && <div role="menu" aria-label={`Tùy chọn kết quả ${group.quizTitle}`} className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl"><button type="button" role="menuitem" onClick={() => { setOpen(false); download(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus"><Download size={17} aria-hidden="true" />Xuất Excel</button><button type="button" role="menuitem" disabled={!group.submitted} onClick={() => { setOpen(false); remove(); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-red-700 hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"><Trash2 size={17} aria-hidden="true" />Xóa các bài đã nộp</button></div>}</div>;
}

type Roster = { count: number; assignedClass: string | null; notStarted: { id: string; name: string }[]; requests: { id: string; name: string; status: string }[] };

type ResultRow = { id: string; studentName: string; studentClass: string; submittedAt: string | null; score: number | null; maxScore: number; variantCode: number; gradingStatus: string; quizId: string; quizTitle: string };
type Question = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type Answer = { questionId: string; answer: string | null; awardedPoints: number | null; isCorrect: boolean | null };
type Detail = { submission: { id: string; studentName: string; studentClass: string; quizTitle: string; score: number | null; maxScore: number; variantCode: number; gradingStatus: string; questionSnapshot: Question[] }; answers: Answer[] };

export default function ResultsPage({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [selected, setSelected] = useState<{ quizId: string; className: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; quizId: string; quizTitle: string; className: string; count: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [index, setIndex] = useState(0);
  const [grade, setGrade] = useState("");
  const [gradeError, setGradeError] = useState("");
  const [grading, setGrading] = useState(false);
  const [filter, setFilter] = useState("submitted");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const initialGroupLoaded = useRef(false);
  const t = useTranslation();
  const language = useLocale();

  const load = useCallback(async () => {
    const [summaryResponse, resultsResponse] = await Promise.all([
      fetch("/api/teacher/results/summary", { cache: "no-store" }),
      fetch("/api/teacher/results", { cache: "no-store" }),
    ]);
    if (!summaryResponse.ok || !resultsResponse.ok) { setNotice("Không tải được kết quả."); return; }
    const summary = await summaryResponse.json();
    setGroups(summary.groups);
    if (!initialGroupLoaded.current) {
      initialGroupLoaded.current = true;
      const params = new URLSearchParams(window.location.search);
      const quizId = params.get("quizId");
      const className = params.get("className");
      const target = summary.groups.find((group: { quizId: string; className: string }) => group.quizId === quizId && (!className || group.className === className));
      if (target) setSelected({ quizId: target.quizId, className: target.className });
    }
    setRows((await resultsResponse.json()).results);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const quizId = selected?.quizId;
  const selectedClass = selected?.className;
  const loadRoster = useCallback(async (id: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/teacher/quizzes/${id}/roster`, { cache: "no-store", signal });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (!signal?.aborted) setRoster(result);
  }, []);

  useEffect(() => {
    setRoster(null);
    setFilter("submitted");
    if (!quizId) return;
    const controller = new AbortController();
    void loadRoster(quizId, controller.signal).catch(() => { if (!controller.signal.aborted) setNotice("Không tải được danh sách lớp."); });
    return () => controller.abort();
  }, [quizId, selectedClass, loadRoster]);

  async function decide(id: string, status: "approved" | "rejected") {
    if (!quizId) return;
    setReviewing(true);
    try {
      const response = await fetch(`/api/teacher/access-requests/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error();
      await loadRoster(quizId);
    } catch { setNotice("Không cập nhật được yêu cầu làm bài."); }
    finally { setReviewing(false); }
  }

  function move(data: Detail, next: number) {
    const question = data.submission.questionSnapshot[next];
    setIndex(next);
    setGrade(String(data.answers.find((answer) => answer.questionId === question.id)?.awardedPoints ?? ""));
    setGradeError("");
    requestAnimationFrame(() => document.getElementById("grading-question")?.focus());
  }

  function ungraded(data: Detail) {
    return data.submission.questionSnapshot.findIndex((question) => question.type === "essay" && data.answers.find((answer) => answer.questionId === question.id)?.awardedPoints == null);
  }

  async function openResult(id: string) {
    try {
      const response = await fetch(`/api/teacher/results/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as Detail;
      setDetail(data);
      move(data, Math.max(0, ungraded(data)));
    } catch { setNotice(t("Không mở được bài nộp.")); }
  }

  const question = detail?.submission.questionSnapshot[index];
  const answer = detail?.answers.find((entry) => entry.questionId === question?.id);
  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || question?.type !== "essay" || grade.trim() === "") return;
    const awardedPoints = Number(grade.replace(",", "."));
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(grade.trim()) || !Number.isInteger(awardedPoints * 4) || awardedPoints < 0 || awardedPoints > question.points) {
      setGradeError(t("Nhập điểm theo bước 0.25 và trong giới hạn của câu."));
      return;
    }
    setGrading(true);
    setGradeError("");
    try {
      const response = await fetch(`/api/teacher/results/${detail.submission.id}/grade`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores: { [question.id]: awardedPoints } }) });
      if (!response.ok) throw new Error();
      const { score, gradingStatus } = await response.json();
      const saved: Detail = {
        submission: { ...detail.submission, score, gradingStatus },
        answers: [...detail.answers.filter((entry) => entry.questionId !== question.id), { questionId: question.id, answer: answer?.answer ?? null, isCorrect: null, awardedPoints }],
      };
      setDetail(saved);
      const following = index + 1 < saved.submission.questionSnapshot.length ? index + 1 : ungraded(saved);
      if (following >= 0) move(saved, following);
      setNotice(t("Đã lưu điểm."));
      void load().catch(() => setNotice(t("Không tải được kết quả.")));
    } catch { setGradeError(t("Không lưu được điểm. Hãy thử lại.")); }
    finally { setGrading(false); }
  }

  async function download(quizId: string, quizTitle: string, className: string) {
    const response = await fetch(`/api/teacher/quizzes/${quizId}/results.xlsx?className=${encodeURIComponent(className)}`);
    if (!response.ok) { setNotice("Không thể xuất Excel."); return; }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${quizTitle}-${className}-results.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const url = deleteTarget.id ? `/api/teacher/results/${deleteTarget.id}` : `/api/teacher/quizzes/${deleteTarget.quizId}/results?className=${encodeURIComponent(deleteTarget.className)}`;
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setDeleteTarget(null); setDetail(null); setNotice("Đã xóa bài đã nộp."); await load();
    } catch { setNotice("Không thể xóa bài."); } finally { setDeleting(false); }
  }

  const classes = [...new Set(groups.map((group) => group.className))];
  return <><DashboardNav admin={admin} /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    <PageHeader title={t("Kết quả bài làm")} description={t("Xem câu trả lời, chấm tự luận và xuất bảng điểm.")} />
    {notice && <Alert className="mt-4">{notice}</Alert>}
    <div className="mt-6 space-y-5">{classes.map((classItem) => <section key={classItem} className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-xl font-bold">Lớp {classItem}</h2><div className="mt-4 space-y-3">{groups.filter((group) => group.className === classItem).map((group) => { const open = selected?.quizId === group.quizId && selected.className === group.className; const attempts = rows.filter((row) => row.quizId === group.quizId && row.studentClass === group.className && (filter === "submitted" ? Boolean(row.submittedAt) : !row.submittedAt)); return <article key={group.quizId} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{group.quizTitle}</h3><p className="mt-1 text-sm text-content-muted">Đang làm: {group.inProgress} · Đã nộp: {group.submitted} · Cần chấm: {group.needsReview} · Đã chấm: {group.graded}</p></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={reviewing} onClick={() => setSelected(open ? null : { quizId: group.quizId, className: group.className })}>{open ? "Thu gọn" : "Xem bài làm"}</Button><ResultActions group={group} download={() => void download(group.quizId, group.quizTitle, group.className)} remove={() => setDeleteTarget({ quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: group.submitted })} /></div></div>{open && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">{[["submitted", t("Đã nộp"), group.submitted], ["started", t("Đã bắt đầu, chưa nộp"), group.inProgress], ...(roster?.assignedClass === group.className ? [["missing", t("Chưa làm"), roster.count ? roster.notStarted.length : "—"], ["requests", t("Yêu cầu làm bài"), roster.requests.filter((item) => item.status === "pending").length]] : [])].map(([key, label, count]) => <Button key={key} variant={filter === key ? "default" : "outline"} aria-pressed={filter === key} disabled={reviewing} onClick={() => setFilter(String(key))}>{label} · {count}</Button>)}</div>
      {filter === "missing" && (!roster?.count ? <p>{t("Thêm học sinh vào lớp để theo dõi ai chưa làm.")} <a className="underline" href={admin ? "/admin/students" : "/teacher/students"}>{t("Học sinh")}</a></p> : <ul className="space-y-2">{roster.notStarted.map((item) => <li key={item.id}>{item.name}</li>)}{!roster.notStarted.length && <li>{t("Tất cả học sinh đã bắt đầu.")}</li>}</ul>)}
      {filter === "requests" && <ul className="space-y-2">{roster?.requests.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 border-b border-line py-2"><span className="mr-auto">{item.name}</span>{item.status === "pending" ? <><Button disabled={reviewing} onClick={() => void decide(item.id, "approved")}>{t("Duyệt và thêm vào lớp")}</Button><Button variant="outline" disabled={reviewing} onClick={() => void decide(item.id, "rejected")}>{t("Từ chối")}</Button></> : <span>{t(item.status === "approved" ? "Đã duyệt" : "Đã từ chối")}</span>}</li>)}{!roster?.requests.length && <li>{t("Chưa có yêu cầu làm bài.")}</li>}</ul>}
      {(filter === "submitted" || filter === "started") && <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th className="py-2">Học sinh</th><th>Nộp lúc</th><th>Điểm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{attempts.map((row) => <tr key={row.id} className="border-t border-line"><td className="py-3">{row.studentName}<span className="block text-xs">Mã đề {row.variantCode}</span></td><td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString(language === "en" ? "en-US" : "vi-VN") : ""}</td><td>{row.score ?? "—"}/{row.maxScore}</td><td>{!row.submittedAt ? t("Chưa nộp") : row.gradingStatus === "graded" ? t("Đã chấm") : t("Cần chấm")}</td><td className="py-2">{row.submittedAt && <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => void openResult(row.id)}>Mở bài</Button><Button type="button" variant="outline" onClick={() => setDeleteTarget({ id: row.id, quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: 1 })}>Xóa bài</Button></div>}</td></tr>)}{!attempts.length && <tr><td colSpan={5} className="py-5 text-content-muted">{t(filter === "submitted" ? "Chưa có bài đã nộp." : "Chưa có bài đang chờ nộp.")}</td></tr>}</tbody></table></div>}</div>}</article>; })}</div></section>)}{!classes.length && <p className="rounded-2xl border border-line bg-surface p-8 text-content-muted">Chưa có lớp hoặc bài làm.</p>}</div>
    {deleteTarget && <Modal title={deleteTarget.id ? "Xóa bài đã nộp" : "Xóa các bài đã nộp"} onClose={() => !deleting && setDeleteTarget(null)}><p>{deleteTarget.id ? `Xóa bài đã nộp của lớp ${deleteTarget.className} trong bài kiểm tra “${deleteTarget.quizTitle}”?` : `Xóa ${deleteTarget.count} bài đã nộp của lớp ${deleteTarget.className} trong bài kiểm tra “${deleteTarget.quizTitle}”?`}</p><p className="mt-2 text-sm text-content-muted">Các bài đang làm dở được giữ nguyên. Không thể khôi phục bài đã xóa.</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button><Button type="button" onClick={() => void confirmDelete()} disabled={deleting}>Xác nhận xóa</Button></div></Modal>}
    {detail && question && <Modal title={detail.submission.studentName + " · " + detail.submission.studentClass} onClose={() => !grading && setDetail(null)}>
      <p aria-live="polite" className="mb-4 text-sm text-content-muted">{detail.submission.quizTitle} · {t("Mã đề")} {detail.submission.variantCode} · {detail.submission.score ?? "—"}/{detail.submission.maxScore}</p>
      <form onSubmit={saveGrade} className="space-y-4">
        <h3 id="grading-question" tabIndex={-1} className="font-semibold">{t("Câu")} {index + 1}/{detail.submission.questionSnapshot.length} · {question.points} {t("điểm")}</h3>
        <p className="whitespace-pre-wrap">{question.prompt}</p>
        <div className="whitespace-pre-wrap break-words rounded-lg bg-surface-subtle p-3">
          <p>{t("Trả lời:")} {question.type === "choice" && answer?.answer ? question.options[Number(answer.answer)] ?? t("Chưa trả lời") : answer?.answer || t("Chưa trả lời")}</p>
          {question.type === "choice" && <p>{t("Đáp án đúng")} · {question.options[question.correctOption ?? -1]} · {answer?.awardedPoints ?? 0}/{question.points}</p>}
        </div>
        {question.type === "essay" && <label className="block">{t("Điểm tự luận")}<input disabled={grading} inputMode="decimal" value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-2 block w-32 rounded-lg border border-line bg-surface p-2" /></label>}
        {gradeError && <p role="alert">{gradeError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={grading || index === 0} onClick={() => move(detail, index - 1)}>{t("Câu trước")}</Button>
          <Button type="button" variant="outline" disabled={grading || index + 1 === detail.submission.questionSnapshot.length} onClick={() => move(detail, index + 1)}>{t("Câu sau")}</Button>
          <Button type="button" variant="outline" disabled={grading || ungraded(detail) < 0} onClick={() => move(detail, ungraded(detail))}>{t("Đến câu chưa chấm")}</Button>
          {question.type === "essay" && <Button type="submit" disabled={grading || grade.trim() === ""}>{t("Lưu và tiếp tục")}</Button>}
        </div>
      </form>
    </Modal>}
  </div></main></>;
}
