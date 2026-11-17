"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { useLocale, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";

type ResultRow = { id: string; studentName: string; studentClass: string; submittedAt: string | null; score: number | null; maxScore: number; variantCode: number; gradingStatus: string; quizId: string; quizTitle: string };
type Question = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type Answer = { questionId: string; answer: string | null; awardedPoints: number | null; isCorrect: boolean | null };
type Detail = { submission: { id: string; studentName: string; studentClass: string; quizTitle: string; score: number | null; maxScore: number; variantCode: number; gradingStatus: string; questionSnapshot: Question[] }; answers: Answer[] };

export default function ResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [groups, setGroups] = useState<{ quizId: string; quizTitle: string; className: string; inProgress: number; submitted: number; needsReview: number; graded: number }[]>([]);
  const [selected, setSelected] = useState<{ quizId: string; className: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; quizId: string; quizTitle: string; className: string; count: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
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

  async function openResult(id: string) {
    const response = await fetch(`/api/teacher/results/${id}`);
    if (!response.ok) { setNotice(t("Không mở được bài nộp.")); return; }
    const data = await response.json() as Detail;
    setDetail(data);
    setScores(Object.fromEntries(data.answers.filter((answer) => answer.awardedPoints !== null).map((answer) => [answer.questionId, answer.awardedPoints as number])));
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const response = await fetch(`/api/teacher/results/${detail.submission.id}/grade`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scores }) });
    setNotice(response.ok ? t("Đã lưu điểm.") : t("Không thể lưu điểm. Kiểm tra điểm tối đa của từng câu."));
    if (response.ok) { setDetail(null); await load(); }
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
  return <><DashboardNav /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    <PageHeader title={t("Kết quả bài làm")} description={t("Xem câu trả lời, chấm tự luận và xuất bảng điểm.")} />
    {notice && <Alert className="mt-4">{notice}</Alert>}
    <div className="mt-6 space-y-5">{classes.map((classItem) => <section key={classItem} className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-xl font-bold">Lớp {classItem}</h2><div className="mt-4 space-y-3">{groups.filter((group) => group.className === classItem).map((group) => { const open = selected?.quizId === group.quizId && selected.className === group.className; const attempts = rows.filter((row) => row.quizId === group.quizId && row.studentClass === group.className && row.submittedAt); return <article key={group.quizId} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{group.quizTitle}</h3><p className="mt-1 text-sm text-content-muted">Đang làm: {group.inProgress} · Đã nộp: {group.submitted} · Cần chấm: {group.needsReview} · Đã chấm: {group.graded}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void download(group.quizId, group.quizTitle, group.className)}>Xuất Excel</Button><Button type="button" variant="outline" disabled={!group.submitted} onClick={() => setDeleteTarget({ quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: group.submitted })}>Xóa các bài đã nộp</Button><Button type="button" onClick={() => setSelected(open ? null : { quizId: group.quizId, className: group.className })}>{open ? "Thu gọn" : "Xem bài làm"}</Button></div></div>{open && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th className="py-2">Học sinh</th><th>Nộp lúc</th><th>Điểm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{attempts.map((row) => <tr key={row.id} className="border-t border-line"><td className="py-3">{row.studentName}<span className="block text-xs">Mã đề {row.variantCode}</span></td><td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString(language === "en" ? "en-US" : "vi-VN") : ""}</td><td>{row.score ?? "—"}/{row.maxScore}</td><td>{row.gradingStatus === "graded" ? "Đã chấm" : "Cần chấm"}</td><td className="flex gap-2 py-2"><Button type="button" variant="outline" onClick={() => void openResult(row.id)}>Mở bài</Button><Button type="button" variant="outline" onClick={() => setDeleteTarget({ id: row.id, quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: 1 })}>Xóa bài</Button></td></tr>)}{!attempts.length && <tr><td colSpan={5} className="py-5 text-content-muted">Chưa có bài đã nộp.</td></tr>}</tbody></table></div>}</article>; })}</div></section>)}{!classes.length && <p className="rounded-2xl border border-line bg-surface p-8 text-content-muted">Chưa có lớp hoặc bài làm.</p>}</div>
    {deleteTarget && <Modal title={deleteTarget.id ? "Xóa bài đã nộp" : "Xóa các bài đã nộp"} onClose={() => !deleting && setDeleteTarget(null)}><p>{deleteTarget.id ? `Xóa bài đã nộp của lớp ${deleteTarget.className} trong quiz “${deleteTarget.quizTitle}”?` : `Xóa ${deleteTarget.count} bài đã nộp của lớp ${deleteTarget.className} trong quiz “${deleteTarget.quizTitle}”?`}</p><p className="mt-2 text-sm text-content-muted">Các bài đang làm dở được giữ nguyên. Không thể khôi phục bài đã xóa.</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button><Button type="button" onClick={() => void confirmDelete()} disabled={deleting}>Xác nhận xóa</Button></div></Modal>}
    {detail && <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={t("Chi tiết bài làm")}><form onSubmit={saveGrade} className="mx-auto my-4 max-w-3xl rounded-2xl bg-surface p-5 shadow-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-brand">{detail.submission.quizTitle} · Mã đề {detail.submission.variantCode} · {detail.submission.score ?? "—"}/{detail.submission.maxScore}</p><h2 className="mt-1 text-2xl font-bold">{detail.submission.studentName} · {detail.submission.studentClass}</h2></div><button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-line px-3 py-2">{t("Đóng")}</button></div><div className="mt-6 space-y-4">{detail.submission.questionSnapshot.map((question, index) => { const answer = detail.answers.find((item) => item.questionId === question.id); return <section key={question.id} className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t("Câu")} {index + 1} · {question.points} {t("điểm")}</h3><p className="mt-2 whitespace-pre-wrap">{question.prompt}</p>{question.type === "choice" ? <p className="mt-3 text-sm">{t("Trả lời:")} {answer?.answer === null || answer?.answer === undefined ? t("Chưa trả lời") : question.options[Number(answer.answer)]} {answer?.isCorrect === true ? t("· Đúng") : answer?.isCorrect === false ? t("· Sai") : ""}</p> : <><p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-subtle p-3 text-sm">{answer?.answer || t("Chưa trả lời")}</p><label className="mt-3 block text-sm font-medium">{t("Điểm tự luận")}<input type="number" min={0} max={question.points} value={scores[question.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [question.id]: event.target.value === "" ? 0 : Number(event.target.value) }))} className="mt-2 block w-32 rounded-lg border border-line px-3 py-2" /></label></>}</section>; })}</div><button className="mt-5 rounded-xl ds-gradient px-5 py-3 font-semibold text-white">{t("Lưu điểm")}</button></form></div>}
  </div></main></>;
}
