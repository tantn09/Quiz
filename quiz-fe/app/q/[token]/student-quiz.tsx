"use client";

import { LoadingScreen } from "@/components/ui/loading-screen";
import { useCallback, useState } from "react";
import { useAttempt } from "@/features/assessment/use-attempt";
import { AssessmentEntry } from "@/features/assessment/assessment-fields";
import { AssessmentProgress, AssessmentRun, AssessmentScreen } from "@/features/assessment/assessment-screen";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/modal";

export default function StudentQuizPage() {
  const t = useTranslation();
  const [expired, setExpired] = useState(false);
  const [dismissedDepartureResult, setDismissedDepartureResult] = useState(false);
  const { quiz, questions, attempt, name, setName, className, setClassName, answers, loading, busy, done, submissionStatus, persisted, retrySubmission, unlisted, setUnlisted, requestStatus, requestAccess, start, setAnswer, submitLatest, recordDeparture, departureLimitSubmitted, departureLimitPending } = useAttempt();

  const expire = useCallback(() => {
    setExpired(true);
    submitLatest();
  }, [submitLatest]);

  if (loading) return <LoadingScreen />;
  const answered = questions.filter((question) => Boolean(answers[question.id]?.trim())).length;
  return <AssessmentScreen quiz={quiz} showPrompt={Boolean(attempt)} centered={!attempt} variantCode={attempt?.variantCode} status={<>
    <span role="status" className="sr-only">{expired ? t("Đã hết giờ làm bài.") : ""}</span>
    {attempt && !done && <AssessmentProgress answered={answered} total={questions.length} dueAt={attempt.dueAt} onExpire={expire} />}
  </>}>
        {!attempt && quiz && <>
          <p className="ds-error mt-5 rounded-xl p-3 font-semibold">{t("Bài sẽ tự nộp nếu bạn rời trang làm bài 3 lần.")}</p>
          <AssessmentEntry quiz={quiz} name={name} className={className} busy={busy} unlisted={unlisted} requestStatus={requestStatus} start={start} requestAccess={requestAccess} setClassName={setClassName} changeName={(value) => { setName(value); setUnlisted(false); }} />
        </>}
        {attempt && !done && !persisted && <p role="status" className="mt-4 rounded-xl ds-warning p-3">{t("Không thể lưu trên trình duyệt. Hãy giữ trang này mở.")}</p>}
        {attempt && done && <div className={`mt-7 rounded-2xl p-5 font-semibold ${submissionStatus === "sent" ? "ds-success" : "ds-warning"}`}>
          <div role="status">
            {submissionStatus === "sent" ? t(departureLimitSubmitted ? "Tự nộp do rời trang 3 lần" : "Kết thúc bài làm") : submissionStatus === "sending" ? t("Đang gửi bài…") :
              submissionStatus === "waiting" ? t("Đang chờ gửi lại bài.") : t("Không gửi được bài làm.")}
            {!persisted && submissionStatus !== "sent" && <p className="mt-1 text-sm">{t("Không thể lưu trên trình duyệt. Hãy giữ trang này mở.")}</p>}
          </div>
          {(submissionStatus === "waiting" || submissionStatus === "retry") && <Button type="button" variant="outline" className="mt-3" onClick={retrySubmission}>{t("Thử gửi lại")}</Button>}
        </div>}
    {attempt && !done && <AssessmentRun questions={questions} answers={answers} setAnswer={setAnswer} onSubmit={submitLatest} departureDueAt={attempt.dueAt} onDeparture={recordDeparture} departureLimitEnabled={attempt.departureLimitEnabled} />}
    {done && !dismissedDepartureResult && (departureLimitSubmitted || departureLimitPending) && (
      <Modal portal closeLabel={t("Đóng")} onClose={departureLimitSubmitted ? () => setDismissedDepartureResult(true) : undefined} title={t(departureLimitSubmitted ? "Tự nộp do rời trang 3 lần" : "Bài làm đã khóa vì rời trang 3 lần")}>
        <p role="status" className="ds-error rounded-xl p-4">{t(departureLimitSubmitted ? "Kết thúc bài làm" : submissionStatus === "sending" ? "Đang gửi bài…" : submissionStatus === "waiting" ? "Đang chờ gửi lại bài." : "Không gửi được bài làm.")}</p>
        {!persisted && departureLimitPending && <p>{t("Không thể lưu trên trình duyệt. Hãy giữ trang này mở.")}</p>}
        <div className="mt-5 flex justify-end">
          {departureLimitSubmitted && <Button type="button" onClick={() => setDismissedDepartureResult(true)}>{t("Đóng")}</Button>}
          {departureLimitPending && (submissionStatus === "waiting" || submissionStatus === "retry") && <Button type="button" onClick={retrySubmission}>{t("Thử gửi lại")}</Button>}
        </div>
      </Modal>
    )}
  </AssessmentScreen>;
}
