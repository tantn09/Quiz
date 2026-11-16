"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { useLocale, useTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";

type ResultRow = { id: string; studentName: string; studentClass: string; submittedAt: string | null; score: number | null; gradingStatus: string; quizId: string; quizTitle: string };
type Question = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; correctOption: number | null; points: number };
type Answer = { questionId: string; answer: string | null; awardedPoints: number | null; isCorrect: boolean | null };
type Detail = { submission: { id: string; studentName: string; studentClass: string; quizTitle: string; score: number | null; gradingStatus: string; questionSnapshot: Question[] }; answers: Answer[] };

export default function ResultsPage() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [quizOptions, setQuizOptions] = useState<{ id: string; title: string; classConfigs: { name: string; expiresAt: string }[] }[]>([]);
  const [search, setSearch] = useState("");
  const [quizId, setQuizId] = useState("");
  const [className, setClassName] = useState("");
  const [gradingStatus, setGradingStatus] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const t = useTranslation();
  const language = useLocale();

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (quizId) query.set("quizId", quizId);
    if (className) query.set("className", className);
    if (gradingStatus) query.set("gradingStatus", gradingStatus);
    const response = await fetch(`/api/teacher/results?${query}`, { cache: "no-store" });
    if (!response.ok) { setNotice(t("Không tải được kết quả.")); return; }
    const payload = await response.json();
    setRows(payload.results);
    setQuizOptions(payload.quizzes);
  }, [search, quizId, className, gradingStatus, t]);

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

  async function download(quiz: { id: string; title: string }) {
    const response = await fetch(`/api/teacher/quizzes/${quiz.id}/results.xlsx${className && quizId === quiz.id ? `?className=${encodeURIComponent(className)}` : ""}`);
    if (!response.ok) { setNotice(t("Không thể xuất Excel.")); return; }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${quiz.title}-results.xlsx`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <><DashboardNav /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-8 sm:pt-8"><div className="mx-auto max-w-6xl">
    <PageHeader title={t("Kết quả bài làm")} description={t("Xem câu trả lời, chấm tự luận và xuất bảng điểm.")} />
    {notice && <Alert className="mt-4">{notice}</Alert>}
    <section className="mt-6 rounded-2xl border border-line bg-surface p-5"><div className="grid gap-3 sm:grid-cols-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Tìm học sinh, lớp hoặc quiz")} className="rounded-xl border border-line px-4 py-3" /><Select value={quizId} onValueChange={(value) => { setQuizId(value); setClassName(""); }} ariaLabel={t("Tất cả quiz")} options={[{ value: "", label: t("Tất cả quiz") }, ...quizOptions.map((quiz) => ({ value: quiz.id, label: quiz.title }))]} /><Select value={className} onValueChange={setClassName} ariaLabel={t("Tất cả lớp")} options={[{ value: "", label: t("Tất cả lớp") }, ...(quizOptions.find((quiz) => quiz.id === quizId)?.classConfigs ?? []).map((item) => ({ value: item.name, label: item.name }))]} /><Select value={gradingStatus} onValueChange={setGradingStatus} ariaLabel={t("Mọi trạng thái chấm")} options={[{ value: "", label: t("Mọi trạng thái chấm") }, { value: "pending", label: t("Chưa chấm") }, { value: "needs_review", label: t("Cần chấm") }, { value: "graded", label: t("Đã chấm") }]} /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-line text-content-muted"><tr><th className="py-3 pr-4">{t("Học sinh")}</th><th className="py-3 pr-4">Quiz</th><th className="py-3 pr-4">{t("Nộp lúc")}</th><th className="py-3 pr-4">{t("Điểm")}</th><th className="py-3 pr-4">{t("Trạng thái")}</th><th className="py-3">{t("Thao tác")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-line"><td className="py-4 pr-4">{row.studentName}<span className="block text-xs text-content-muted">{row.studentClass}</span></td><td className="py-4 pr-4">{row.quizTitle}</td><td className="py-4 pr-4">{row.submittedAt ? new Date(row.submittedAt).toLocaleString(language === "en" ? "en-US" : "vi-VN") : "—"}</td><td className="py-4 pr-4">{row.score ?? "—"}</td><td className="py-4 pr-4">{row.gradingStatus === "graded" ? t("Đã chấm") : row.gradingStatus === "needs_review" ? t("Cần chấm") : t("Chưa chấm")}</td><td className="py-4"><button onClick={() => void openResult(row.id)} className="rounded-lg border border-line px-3 py-2">{t("Mở bài")}</button></td></tr>)}{rows.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-content-muted">{t("Chưa có bài nộp.")}</td></tr>}</tbody></table></div>
    </section>
    <section className="mt-5 rounded-2xl border border-line bg-surface p-5"><h2 className="font-bold">{t("Xuất Excel theo quiz")}</h2><div className="mt-3 flex flex-wrap gap-2">{quizOptions.map((quiz) => <button key={quiz.id} onClick={() => void download(quiz)} className="rounded-xl border border-line px-4 py-2 text-sm">{t("Tải kết quả")}: {quiz.title}.xlsx</button>)}</div></section>
    {detail && <div className="fixed inset-0 z-20 overflow-y-auto bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label={t("Chi tiết bài làm")}><form onSubmit={saveGrade} className="mx-auto my-4 max-w-3xl rounded-2xl bg-surface p-5 shadow-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-brand">{detail.submission.quizTitle}</p><h2 className="mt-1 text-2xl font-bold">{detail.submission.studentName} · {detail.submission.studentClass}</h2></div><button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-line px-3 py-2">{t("Đóng")}</button></div><div className="mt-6 space-y-4">{detail.submission.questionSnapshot.map((question, index) => { const answer = detail.answers.find((item) => item.questionId === question.id); return <section key={question.id} className="rounded-xl border border-line p-4"><h3 className="font-semibold">{t("Câu")} {index + 1} · {question.points} {t("điểm")}</h3><p className="mt-2 whitespace-pre-wrap">{question.prompt}</p>{question.type === "choice" ? <p className="mt-3 text-sm">{t("Trả lời:")} {answer?.answer === null || answer?.answer === undefined ? t("Chưa trả lời") : question.options[Number(answer.answer)]} {answer?.isCorrect === true ? t("· Đúng") : answer?.isCorrect === false ? t("· Sai") : ""}</p> : <><p className="mt-3 whitespace-pre-wrap rounded-lg bg-surface-subtle p-3 text-sm">{answer?.answer || t("Chưa trả lời")}</p><label className="mt-3 block text-sm font-medium">{t("Điểm tự luận")}<input type="number" min={0} max={question.points} value={scores[question.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [question.id]: event.target.value === "" ? 0 : Number(event.target.value) }))} className="mt-2 block w-32 rounded-lg border border-line px-3 py-2" /></label></>}</section>; })}</div><button className="mt-5 rounded-xl ds-gradient px-5 py-3 font-semibold text-white">{t("Lưu điểm")}</button></form></div>}
  </div></main></>;
}
