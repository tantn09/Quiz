"use client";

import { DashboardNav } from "@/components/dashboard-nav";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslation } from "@/lib/i18n";

export default function AdminPage() {
  const t = useTranslation();
  return <><DashboardNav admin /><main id="page-content" tabIndex={-1} className="min-h-screen px-4 pb-8 pt-20 sm:ml-64 sm:px-10 sm:py-10"><div className="mx-auto max-w-5xl"><Card className="ds-gradient-soft p-8"><PageHeader eyebrow={t("QUẢN TRỊ")} title={t("Chào mừng, Admin")} description={t("Khu vực quản lý giáo viên và bài kiểm tra.")} /><Button asChild className="mt-6"><Link href="/admin/teachers">{t("Quản lý giáo viên")}</Link></Button></Card></div></main></>;
}
