"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AssessmentProgress, AssessmentRun, AssessmentScreen } from "@/features/assessment/assessment-screen";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { apiFetch } from "@/lib/api-request";
import { useTranslation } from "@/lib/i18n";
import type { QuizDetail } from "./quiz-detail-panels";

export function QuizPreview({ id, back, initialVariant }: { id: string; back: string; initialVariant?: string }) {
  const t = useTranslation();
  const [detail, setDetail] = useState<QuizDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(initialVariant ?? "");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await apiFetch(`/api/teacher/quizzes/${encodeURIComponent(id)}`, {
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json() as QuizDetail;
        if (!controller.signal.aborted) setDetail(payload);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [id]);

  if (!detail && !failed) return <LoadingScreen />;
  const variants = detail?.variants ?? [];
  const variant = variants.find((item) => item.id === selected && item.questions.length)
    ?? variants.find((item) => item.active && item.questions.length)
    ?? variants.find((item) => item.questions.length);
  return <PreviewBody key={variant?.id} detail={detail} variant={variant} back={back} select={setSelected} />;
}

function PreviewBody({ detail, variant, back, select }: {
  detail: QuizDetail | null; variant?: QuizDetail["variants"][number]; back: string; select: (id: string) => void;
}) {
  const t = useTranslation();
  const [dueAt, setDueAt] = useState<string>();
  const [result, setResult] = useState<"submitted" | "expired">();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const expire = useCallback(() => setResult((current) => current ?? "expired"), []);
  const questions = variant?.questions.map(({ id, type, prompt, options, points }, position) =>
    ({ id, type, prompt, options, points, position })) ?? [];
  const answered = questions.filter(({ id }) => answers[id]?.trim()).length;
  const backLink = <Button asChild variant="outline"><Link href={back}>{t("Về chi tiết bài kiểm tra")}</Link></Button>;

  return <AssessmentScreen quiz={detail?.quiz ?? null} showPrompt={Boolean(dueAt)} centered={!dueAt}
    variantCode={dueAt ? variant?.code : undefined} status={<>
      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-brand">{t("Chế độ làm thử")}</p>
        {backLink}
      </div>
      {dueAt && !result && <AssessmentProgress answered={answered} total={questions.length} dueAt={dueAt} onExpire={expire} />}
    </>}>
    {!detail && <p role="alert" className="mt-4">{t("Không tải được bài kiểm tra để làm thử.")}</p>}
    {detail && !dueAt && <div className="mt-6 space-y-4">
      <label className="block font-semibold">{t("Mã đề")}
        <NativeSelect className="mt-2" value={variant?.id ?? ""} onChange={(event) => select(event.target.value)} disabled={!variant}>
          {!variant && <option value="">{t("Không có mã đề có câu hỏi.")}</option>}
          {detail.variants.map((item) => <option key={item.id} value={item.id} disabled={!item.questions.length}>
            {item.code}{item.active ? "" : ` · ${t("Đã tắt")}`}
          </option>)}
        </NativeSelect>
      </label>
      <Button type="button" disabled={!variant} onClick={() => setDueAt(new Date(Date.now() + detail.quiz.durationMinutes * 60_000).toISOString())}>{t("Bắt đầu làm thử")}</Button>
    </div>}
    {dueAt && !result && <AssessmentRun questions={questions} answers={answers}
      setAnswer={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
      onSubmit={() => setResult(Date.now() >= Date.parse(dueAt) ? "expired" : "submitted")} />}
    {result && <div className="mt-7 space-y-4 rounded-2xl ds-success p-5">
      <p role="status">{t(result === "expired" ? "Đã hết giờ làm bài." : "Kết thúc bài làm")}</p>
      <Button type="button" onClick={() => { setDueAt(undefined); setResult(undefined); setAnswers({}); }}>{t("Làm lại")}</Button>
    </div>}
  </AssessmentScreen>;
}
