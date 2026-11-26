"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { AssessmentLayout } from "@/components/page-layouts";
import { useCallback, useEffect, useState } from "react";
import { useAttempt } from "@/features/assessment/use-attempt";
import { AssessmentEntry, AssessmentQuestions } from "@/features/assessment/assessment-fields";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { Modal } from "@/components/modal";
import { Card } from "@/components/ui/card";

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

export default function StudentQuizPage() {
  const t = useTranslation();
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [expired, setExpired] = useState(false);
  const { quiz, questions, attempt, name, setName, className, setClassName, answers, loading, busy, done, submissionStatus, persisted, retrySubmission, unlisted, setUnlisted, requestStatus, requestAccess, start, setAnswer, submitLatest } = useAttempt();

  const expire = useCallback(() => {
    setExpired(true);
    submitLatest();
  }, [submitLatest]);

  if (loading) return <LoadingScreen />;
  const hasPrompt = Boolean(attempt && (quiz?.promptDocument?.content?.length));
  const answered = questions.filter((question) => Boolean(answers[question.id]?.trim())).length;
  const remaining = questions.length - answered;
  const currentQuestion = questions[Math.min(questionIndex, Math.max(questions.length - 1, 0))];
  function moveToQuestion(index: number) {
    setQuestionIndex(index);
    requestAnimationFrame(() => document.getElementById("current-question")?.focus());
  }
  return (
    <AssessmentLayout wide={hasPrompt} centered={!attempt}>
      <span role="status" className="sr-only">{expired ? t("Đã hết giờ làm bài.") : ""}</span>
      {attempt && !done && <div className="quiz-student-status sticky top-3 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm"><span className="text-sm font-semibold text-content-muted">{t("Đã trả lời")} <strong className="ml-1 rounded-full bg-surface-accent px-2.5 py-1 text-brand">{answered}/{questions.length}</strong></span><Countdown dueAt={attempt.dueAt} onExpire={expire} /></div>}
      <div className={hasPrompt ? "grid gap-5 lg:grid-cols-2 lg:items-start" : ""}>
      {hasPrompt && <><details className="quiz-student-prompt rounded-2xl border border-line bg-surface p-5 lg:hidden"><summary className="cursor-pointer font-bold text-brand">{t("Đề bài")}</summary>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</details><Card className="hidden rounded-3xl p-6 sm:p-9 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"><h2 className="text-xl font-bold">{t("Đề bài")}</h2>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</Card></>}
      <Card className="quiz-student-main rounded-3xl p-5 sm:p-8">
        <p className="text-sm font-semibold text-brand">{t("bài kiểm tra")}</p>
        <h1 className="mt-2 text-3xl font-bold">{quiz?.title ?? t("Không mở được bài kiểm tra")}</h1>
        {attempt?.variantCode && <p className="mt-2 font-semibold text-brand">Mã đề {attempt.variantCode}</p>}
        {(quiz?.subject || quiz?.gradeLevel) && <div className="mt-4 flex flex-wrap gap-2">{quiz?.subject && <span className="quiz-student-chip">{t("Môn học")}: {quiz.subject}</span>}{quiz?.gradeLevel && <span className="quiz-student-chip">{t("Khối lớp")}: {quiz.gradeLevel}</span>}</div>}
        {quiz?.description && <p className="mt-3 whitespace-pre-wrap text-content-muted">{quiz.description}</p>}
        {!attempt && quiz && <AssessmentEntry quiz={quiz} name={name} className={className} busy={busy} unlisted={unlisted} requestStatus={requestStatus} start={start} requestAccess={requestAccess} setClassName={setClassName} changeName={(value) => { setName(value); setUnlisted(false); }} />}
        {attempt && !done && !persisted && <p role="status" className="mt-4 rounded-xl ds-warning p-3">{t("Không thể lưu trên trình duyệt. Hãy giữ trang này mở.")}</p>}
        {attempt && done && <div className={`mt-7 rounded-2xl p-5 font-semibold ${submissionStatus === "sent" ? "ds-success" : "ds-warning"}`}>
          <div role="status">
            {submissionStatus === "sent" ? t("Kết thúc bài làm") : submissionStatus === "sending" ? t("Đang gửi bài…") :
              submissionStatus === "waiting" ? t("Đang chờ gửi lại bài.") : t("Không gửi được bài làm.")}
            {!persisted && submissionStatus !== "sent" && <p className="mt-1 text-sm">{t("Không thể lưu trên trình duyệt. Hãy giữ trang này mở.")}</p>}
          </div>
          {(submissionStatus === "waiting" || submissionStatus === "retry") && <Button type="button" variant="outline" className="mt-3" onClick={retrySubmission}>{t("Thử gửi lại")}</Button>}
        </div>}
        {attempt && !done && <AssessmentQuestions questions={questions} answers={answers} questionIndex={questionIndex} currentQuestion={currentQuestion} moveToQuestion={moveToQuestion} setAnswer={setAnswer} confirm={() => setConfirmSubmit(true)} />}
      </Card></div>
      {confirmSubmit && !done && <Modal onClose={() => setConfirmSubmit(false)} title={t("Xác nhận nộp bài")}><p className="text-content-muted">{remaining > 0 ? `${t("Còn")} ${remaining} ${t("câu chưa trả lời")}.` : t("Bạn đã trả lời tất cả câu hỏi.")}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => setConfirmSubmit(false)}>{t("Tiếp tục làm bài")}</Button><Button type="button" onClick={() => { setConfirmSubmit(false); submitLatest(); }}>{t("Nộp bài")}</Button></div></Modal>}
    </AssessmentLayout>
  );
}
