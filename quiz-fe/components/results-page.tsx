"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useErrorToast } from "@/components/ui/toast";
import { Table } from "@/components/ui/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGradingDialog } from "@/features/results/use-grading-dialog";
import { AccessRequests } from "@/features/results/access-requests";
import { DashboardLayout } from "@/components/page-layouts";
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
export default function ResultsPage({ admin }: { admin: boolean }) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [selected, setSelected] = useState<{ quizId: string; className: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; quizId: string; quizTitle: string; className: string; count: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState("submitted");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const initialGroupLoaded = useRef(false);
  const t = useTranslation();
  const showError = useErrorToast();
  const language = useLocale();

  const [initialLoading, setInitialLoading] = useState(true);
  const load = useCallback(async () => {
    const [summaryResponse, resultsResponse] = await Promise.all([
      fetch("/api/teacher/results/summary", { cache: "no-store" }),
      fetch("/api/teacher/results", { cache: "no-store" }),
    ]);
    if (!summaryResponse.ok || !resultsResponse.ok) { showError(t("Không tải được kết quả.")); return; }
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
  }, [showError, t]);

  useEffect(() => { void load().catch(() => showError(t("Không tải được kết quả."))).finally(() => setInitialLoading(false)); }, [load, showError, t]);

  const { openResult, closeResult, gradingDialog } = useGradingDialog(load, setNotice);
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
    void loadRoster(quizId, controller.signal).catch(() => { if (!controller.signal.aborted) showError(t("Không tải được danh sách lớp.")); });
    return () => controller.abort();
  }, [quizId, selectedClass, loadRoster, showError, t]);

  async function decide(id: string, status: "approved" | "rejected") {
    if (!quizId) return;
    setReviewing(true);
    try {
      const response = await fetch(`/api/teacher/access-requests/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error();
      await loadRoster(quizId);
    } catch { showError(t("Không cập nhật được yêu cầu làm bài.")); }
    finally { setReviewing(false); }
  }

  async function download(quizId: string, quizTitle: string, className: string) {
    const response = await fetch(`/api/teacher/quizzes/${quizId}/results.xlsx?className=${encodeURIComponent(className)}`);
    if (!response.ok) { showError(t("Không thể xuất Excel.")); return; }
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
      setDeleteTarget(null); closeResult(); setNotice("Đã xóa bài đã nộp."); await load();
    } catch { showError(t("Không thể xóa bài.")); } finally { setDeleting(false); }
  }

  const classes = [...new Set(groups.map((group) => group.className))];
  if (initialLoading) return <LoadingScreen />;

  return <DashboardLayout admin={admin}>
    <PageHeader title={t("Kết quả bài làm")} description={t("Xem câu trả lời, chấm tự luận và xuất bảng điểm.")} />
    {notice && <Alert className="mt-4">{notice}</Alert>}
    <div className="mt-6 space-y-5">{classes.map((classItem) => <section key={classItem} className="rounded-2xl border border-line bg-surface p-5"><h2 className="text-xl font-bold">Lớp {classItem}</h2><div className="mt-4 space-y-3">{groups.filter((group) => group.className === classItem).map((group) => { const open = selected?.quizId === group.quizId && selected.className === group.className; const attempts = rows.filter((row) => row.quizId === group.quizId && row.studentClass === group.className && (filter === "submitted" ? Boolean(row.submittedAt) : !row.submittedAt)); return <article key={group.quizId} className="rounded-xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{group.quizTitle}</h3><p className="mt-1 text-sm text-content-muted">Đang làm: {group.inProgress} · Đã nộp: {group.submitted} · Cần chấm: {group.needsReview} · Đã chấm: {group.graded}</p></div><div className="flex flex-wrap gap-2"><Button type="button" disabled={reviewing} onClick={() => setSelected(open ? null : { quizId: group.quizId, className: group.className })}>{open ? "Thu gọn" : "Xem bài làm"}</Button><ResultActions group={group} download={() => void download(group.quizId, group.quizTitle, group.className)} remove={() => setDeleteTarget({ quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: group.submitted })} /></div></div>{open && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">{[["submitted", t("Đã nộp"), group.submitted], ["started", t("Đã bắt đầu, chưa nộp"), group.inProgress], ...(roster?.assignedClass === group.className ? [["missing", t("Chưa làm"), roster.count ? roster.notStarted.length : "—"], ["requests", t("Yêu cầu làm bài"), roster.requests.filter((item) => item.status === "pending").length]] : [])].map(([key, label, count]) => <Button key={key} variant={filter === key ? "default" : "outline"} aria-pressed={filter === key} disabled={reviewing} onClick={() => setFilter(String(key))}>{label} · {count}</Button>)}</div>
      {filter === "missing" && (!roster?.count ? <p>{t("Thêm học sinh vào lớp để theo dõi ai chưa làm.")} <a className="underline" href={admin ? "/admin/students" : "/teacher/students"}>{t("Học sinh")}</a></p> : <ul className="space-y-2">{roster.notStarted.map((item) => <li key={item.id}>{item.name}</li>)}{!roster.notStarted.length && <li>{t("Tất cả học sinh đã bắt đầu.")}</li>}</ul>)}
      {filter === "requests" && <AccessRequests requests={roster?.requests ?? []} reviewing={reviewing} decide={decide} />}
      {(filter === "submitted" || filter === "started") && <div><Table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th scope="col">Học sinh</th><th scope="col">Nộp lúc</th><th scope="col">Điểm</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>{attempts.map((row) => <tr key={row.id} className="border-t border-line"><td className="py-3">{row.studentName}<span className="block text-xs">Mã đề {row.variantCode}</span></td><td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString(language === "en" ? "en-US" : "vi-VN") : ""}</td><td>{row.score ?? "—"}/{row.maxScore}</td><td>{!row.submittedAt ? t("Chưa nộp") : row.gradingStatus === "graded" ? t("Đã chấm") : t("Cần chấm")}</td><td className="py-2">{row.submittedAt && <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => void openResult(row.id)}>Mở bài</Button><Button type="button" variant="outline" onClick={() => setDeleteTarget({ id: row.id, quizId: group.quizId, quizTitle: group.quizTitle, className: group.className, count: 1 })}>Xóa bài</Button></div>}</td></tr>)}{!attempts.length && <tr><td colSpan={5} className="py-5 text-content-muted">{t(filter === "submitted" ? "Chưa có bài đã nộp." : "Chưa có bài đang chờ nộp.")}</td></tr>}</tbody></Table></div>}</div>}</article>; })}</div></section>)}{!classes.length && <p className="rounded-2xl border border-line bg-surface p-8 text-content-muted">Chưa có lớp hoặc bài làm.</p>}</div>
    {deleteTarget && <Modal title={deleteTarget.id ? "Xóa bài đã nộp" : "Xóa các bài đã nộp"} onClose={() => !deleting && setDeleteTarget(null)}><p>{deleteTarget.id ? `Xóa bài đã nộp của lớp ${deleteTarget.className} trong bài kiểm tra “${deleteTarget.quizTitle}”?` : `Xóa ${deleteTarget.count} bài đã nộp của lớp ${deleteTarget.className} trong bài kiểm tra “${deleteTarget.quizTitle}”?`}</p><p className="mt-2 text-sm text-content-muted">Các bài đang làm dở được giữ nguyên. Không thể khôi phục bài đã xóa.</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button><Button type="button" onClick={() => void confirmDelete()} disabled={deleting}>Xác nhận xóa</Button></div></Modal>}
    {gradingDialog}
  </DashboardLayout>;
}
