"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import { AssessmentLayout } from "@/components/page-layouts";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { AssessmentQuestions } from "./assessment-fields";
import type { QuizInfo, QuizQuestion } from "./use-attempt";

const PromptView = dynamic(() => import("@/components/prompt-view").then((module) => module.PromptView), { ssr: false });

function Countdown({ dueAt, onExpire }: { dueAt: string; onExpire: () => void }) {
  const t = useTranslation();
  const deadline = Date.parse(dueAt);
  const [seconds, setSeconds] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    let previous: number | undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) {
        onExpire();
      } else if ((previous === undefined && left <= 300) ||
        [300, 60].some((threshold) => previous !== undefined && previous > threshold && left <= threshold)) {
        setAnnouncement(`${t("Còn")} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
      }
      previous = left;
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, onExpire, t]);
  return <><span className={`rounded-full px-3 py-1 font-bold ${seconds <= 300 ? "ds-warning" : "bg-surface-accent text-brand"}`} role="timer">{t("Còn")} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span><span role="status" className="sr-only">{announcement}</span></>;
}

export function AssessmentScreen({ quiz, showPrompt, centered, variantCode, status, children }: {
  quiz: QuizInfo | null; showPrompt: boolean; centered?: boolean; variantCode?: number;
  status?: ReactNode; children: ReactNode;
}) {
  const t = useTranslation();
  const hasPrompt = Boolean(showPrompt && quiz?.promptDocument?.content?.length);
  return <AssessmentLayout wide={hasPrompt} centered={centered}>
    {status}
      <div className={hasPrompt ? "grid gap-5 lg:grid-cols-2 lg:items-start" : ""}>
      {hasPrompt && <><details className="quiz-student-prompt rounded-2xl border border-line bg-surface p-5 lg:hidden"><summary className="cursor-pointer font-bold text-brand">{t("Đề bài")}</summary>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</details><Card className="hidden rounded-3xl p-6 sm:p-9 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"><h2 className="text-xl font-bold">{t("Đề bài")}</h2>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</Card></>}
      <Card className="quiz-student-main rounded-3xl p-5 sm:p-8">
        <p className="text-sm font-semibold text-brand">{t("bài kiểm tra")}</p>
        <h1 className="mt-2 text-3xl font-bold">{quiz?.title ?? t("Không mở được bài kiểm tra")}</h1>
        {variantCode && <p className="mt-2 font-semibold text-brand">{t("Mã đề")} {variantCode}</p>}
        {(quiz?.subject || quiz?.gradeLevel) && <div className="mt-4 flex flex-wrap gap-2">{quiz?.subject && <span className="quiz-student-chip">{t("Môn học")}: {quiz.subject}</span>}{quiz?.gradeLevel && <span className="quiz-student-chip">{t("Khối lớp")}: {quiz.gradeLevel}</span>}</div>}
        {quiz?.description && <p className="mt-3 whitespace-pre-wrap text-content-muted">{quiz.description}</p>}
        {children}
      </Card>
    </div>
  </AssessmentLayout>;
}

export function AssessmentProgress({ answered, total, dueAt, onExpire }: {
  answered: number; total: number; dueAt: string; onExpire: () => void;
}) {
  const t = useTranslation();
  return <div className="quiz-student-status sticky top-3 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm"><span className="text-sm font-semibold text-content-muted">{t("Đã trả lời")} <strong className="ml-1 rounded-full bg-surface-accent px-2.5 py-1 text-brand">{answered}/{total}</strong></span><Countdown dueAt={dueAt} onExpire={onExpire} /></div>;
}

export function AssessmentRun({ questions, answers, setAnswer, onSubmit, departureDueAt, onDeparture, departureLimitEnabled }: {
  questions: QuizQuestion[]; answers: Record<string, string>;
  setAnswer: (id: string, value: string) => void; onSubmit: () => void;
  departureDueAt?: string;
  onDeparture?: () => number;
  departureLimitEnabled?: boolean;
}) {
  const t = useTranslation();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [departureWarning, setDepartureWarning] = useState(0);
  useEffect(() => {
    if (!departureDueAt || !onDeparture) return;
    const deadline = Date.parse(departureDueAt);
    let wasHidden = document.hidden;
    let departures = 0;
    const handleVisibility = () => {
      const hidden = document.hidden;
      if (hidden === wasHidden) return;
      wasHidden = hidden;
      if (Date.now() >= deadline) return;
      if (hidden) {
        departures = onDeparture();
      } else if (departures) {
        setConfirmSubmit(false);
        setDepartureWarning(departures);
        departures = 0;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [departureDueAt, onDeparture]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const remaining = questions.filter((question) => !answers[question.id]?.trim()).length;
  const index = Math.min(questionIndex, Math.max(0, questions.length - 1));
  function moveToQuestion(next: number) {
    setQuestionIndex(next);
    requestAnimationFrame(() => document.getElementById("current-question")?.focus());
  }
  return <>
    <AssessmentQuestions questions={questions} answers={answers} questionIndex={index} currentQuestion={questions[index]} moveToQuestion={moveToQuestion} setAnswer={setAnswer} confirm={() => setConfirmSubmit(true)} />
    {departureWarning > 0 && <Modal portal closeLabel={t("Đóng")} onClose={() => setDepartureWarning(0)} title={t("Cảnh báo rời trang làm bài")}>
      <div className="ds-error space-y-2 rounded-xl p-4">
        <TriangleAlert size={24} aria-hidden="true" />
        {departureLimitEnabled && <p className="font-bold">{t("Số lần rời trang")} {departureWarning}/3</p>}
        {!departureLimitEnabled && <p>{t("Lượt này chưa áp dụng quy định tự nộp sau 3 lần rời trang.")}</p>}
        <p>{t("Bạn vừa rời trang làm bài. Vui lòng ở lại trang. Thời gian làm bài vẫn tiếp tục.")}</p>
      </div>
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => setDepartureWarning(0)}>{t("Tiếp tục làm bài")}</Button></div>
    </Modal>}
      {confirmSubmit && <Modal closeLabel={t("Đóng")} onClose={() => setConfirmSubmit(false)} title={t("Xác nhận nộp bài")}><p className="text-content-muted">{remaining > 0 ? `${t("Còn")} ${remaining} ${t("câu chưa trả lời")}.` : t("Bạn đã trả lời tất cả câu hỏi.")}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => setConfirmSubmit(false)}>{t("Tiếp tục làm bài")}</Button><Button type="button" onClick={() => { setConfirmSubmit(false); onSubmit(); }}>{t("Nộp bài")}</Button></div></Modal>}
  </>;
}
