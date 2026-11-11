"use client";

import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const t = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="ds-gradient-soft w-full max-w-2xl rounded-3xl p-8 sm:p-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-brand">{t("Quiz lớp học")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Bài quiz rõ ràng, lớp học chủ động.")}</h1>
        <p className="mt-4 max-w-xl leading-7 text-content-muted">{t("Nền tảng tạo bài, chia sẻ link làm bài và theo dõi kết quả cho giáo viên và học sinh.")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link href="/login">{t("Đăng nhập quản trị")}</Link></Button>
          <Button asChild variant="outline"><Link href="/login">{t("Khu vực giáo viên")}</Link></Button>
        </div>
      </Card>
    </main>
  );
}
