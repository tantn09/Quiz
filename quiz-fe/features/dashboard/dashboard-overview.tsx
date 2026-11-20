"use client";

import { useErrorToast } from "@/components/ui/toast";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, BookOpenCheck, ClipboardCheck, GraduationCap, UserCheck, Users } from "lucide-react";
import { DashboardContent, DashboardLoading } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useLocale, useTranslation } from "@/lib/i18n";

type SharedMetrics = { students: number; quizzes: number; openQuizzes: number; submitted: number; needsReview: number };
type Overview = {
  submissionsByDay: { date: string; count: number }[];
} & (
  | { role: "admin"; metrics: SharedMetrics & { teachers: number; pendingTeachers: number } }
  | { role: "teacher"; metrics: SharedMetrics & { pendingRequests: number } }
);

export function DashboardOverview({ admin }: { admin: boolean }) {
  const t = useTranslation();
  const showError = useErrorToast();
  const locale = useLocale() === "en" ? "en-US" : "vi-VN";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const root = admin ? "/admin" : "/teacher";
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/overview", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data: Overview = await response.json();
        if (!controller.signal.aborted) setOverview(data);
      })
      .catch(() => { if (!controller.signal.aborted) { setFailed(true); showError(t("Không tải được số liệu tổng quan.")); } });
    return () => controller.abort();
  }, [showError, t]);

  const metrics = overview ? [
    ...(overview.role === "admin" ? [
      { label: "Giáo viên", value: overview.metrics.teachers, icon: GraduationCap },
      { label: "Giáo viên chờ duyệt", value: overview.metrics.pendingTeachers, icon: UserCheck },
    ] : []),
    { label: "Hồ sơ học sinh", value: overview.metrics.students, icon: Users },
    { label: "Bài kiểm tra", value: overview.metrics.quizzes, icon: BookOpenCheck, open: overview.metrics.openQuizzes },
    { label: "Lượt đã nộp", value: overview.metrics.submitted, icon: BarChart3 },
    { label: "Bài cần chấm", value: overview.metrics.needsReview, icon: ClipboardCheck },
    ...(overview.role === "teacher" ? [{ label: "Yêu cầu làm bài chờ duyệt", value: overview.metrics.pendingRequests, icon: UserCheck }] : []),
  ] : [];
  const peak = Math.max(1, ...(overview?.submissionsByDay.map(({ count }) => count) ?? []));
  const links = admin ? [
    ["/admin/teachers?status=pending", "Giáo viên chờ duyệt"],
    ["/admin/quiz", "Bài kiểm tra"],
  ] : [
    ["/teacher/quiz/new", "Tạo bài kiểm tra mới"],
    ["/teacher/students", "Quản lý học sinh"],
  ];

  if (!overview && !failed) return <DashboardLoading />;

  return <DashboardContent>
    <PageHeader title={t("Tổng quan")} />
    {overview && <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, open }) => <Card key={label} className="flex items-start gap-3">
          <span className="rounded-xl bg-surface-accent p-2.5 text-brand"><Icon size={20} aria-hidden="true" /></span>
          <div className="min-w-0"><h2 className="text-sm font-medium text-content-muted">{t(label)}</h2><p className="mt-1 text-2xl font-bold tabular-nums">{number.format(value)}</p>
            {open !== undefined && <p className="mt-1 text-xs text-content-muted">{t("Đang mở")} · {number.format(open)}</p>}
          </div>
        </Card>)}
      </div>
      <Card className="mt-5">
        <h2 className="text-lg font-bold">{t("Lượt nộp bài trong 7 ngày")}</h2>
        <ul className="mt-5 grid grid-cols-7 gap-1.5 text-center sm:gap-3">
          {overview.submissionsByDay.map((point) => <li key={point.date} className="min-w-0">
            <div className="relative mx-auto flex h-28 max-w-12 items-end rounded-md bg-surface-subtle sm:h-36" aria-hidden="true">
              <div className="w-full rounded-md bg-brand" style={{ height: (point.count / peak) * 100 + "%" }} />
            </div>
            <time dateTime={point.date} className="mt-2 block text-xs text-content-muted">{date.format(new Date(point.date + "T00:00:00Z"))}</time>
            <p className="break-all text-xs font-semibold tabular-nums sm:text-sm">{number.format(point.count)}</p>
          </li>)}
        </ul>
      </Card>
    </>}
    <Card className="mt-5">
      <h2 className="text-lg font-bold">{t("Truy cập nhanh")}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...links, [root + "/results", "Xem kết quả"]].map(([href, label]) =>
          <Button key={href} asChild variant="outline"><Link href={href}>{t(label)}</Link></Button>)}
      </div>
    </Card>
  </DashboardContent>;
}
