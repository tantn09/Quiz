import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { useTranslation } from "@/lib/i18n";
import type { QuizInfo, QuizQuestion } from "./use-attempt";

export function AssessmentEntry({ quiz, name, className, busy, unlisted, requestStatus, start, requestAccess, setClassName, changeName }: {
  quiz: QuizInfo; name: string; className: string; busy: boolean; unlisted: boolean; requestStatus: string;
  start: (event: FormEvent<HTMLFormElement>) => void; requestAccess: (check: boolean) => Promise<void>;
  setClassName: (value: string) => void; changeName: (value: string) => void;
}) {
  const t = useTranslation();
  return <form onSubmit={start} className="quiz-student-entry mt-7 rounded-2xl border border-line bg-surface-subtle p-5 sm:p-7">
          <h2 className="text-lg font-bold">{t("Thông tin học sinh")}</h2>
          <p className="mt-1 text-sm text-content-muted">{quiz.assignedClass ? `Bài dành cho lớp ${quiz.assignedClass}. Nhập họ tên để bắt đầu.` : t("Nhập tên và lớp để bắt đầu làm bài.")}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">{t("Họ và tên")}<Input required autoComplete="name" value={name} onChange={(event) => changeName(event.target.value)} className="mt-2 bg-surface" /></label>
            {!quiz.assignedClass && <label className="block text-sm font-semibold">{t("Lớp")}<Input required autoComplete="off" value={className} onChange={(event) => setClassName(event.target.value)} className="mt-2 bg-surface" /></label>}
          </div>
          {unlisted && <Button type="button" variant="outline" disabled={busy} onClick={() => void requestAccess(false)} className="mt-4">{t("Yêu cầu làm bài")}</Button>}
          {requestStatus && <div className="mt-4 flex flex-wrap items-center gap-3"><p role="status">{t(requestStatus === "pending" ? "Chờ giáo viên duyệt" : requestStatus === "approved" ? "Yêu cầu đã được duyệt. Em có thể bắt đầu làm bài." : "Giáo viên đã từ chối yêu cầu.")}</p>{requestStatus === "pending" && <Button type="button" variant="outline" disabled={busy} onClick={() => void requestAccess(true)}>{t("Kiểm tra yêu cầu")}</Button>}</div>}
          <Button type="submit" disabled={busy} className="mt-5 w-full sm:w-auto">{busy ? t("Đang bắt đầu…") : t("Bắt đầu làm bài")}</Button>
        </form>;
}

export function AssessmentQuestions({ questions, answers, questionIndex, currentQuestion, moveToQuestion, setAnswer, confirm }: {
  questions: QuizQuestion[]; answers: Record<string, string>; questionIndex: number; currentQuestion?: QuizQuestion;
  moveToQuestion: (index: number) => void; setAnswer: (id: string, value: string) => void; confirm: () => void;
}) {
  const t = useTranslation();
  return <form onSubmit={(event) => { event.preventDefault(); confirm(); }} className="mt-8 space-y-5">
          <div className="text-sm font-bold uppercase tracking-wide text-brand">{t("Câu")} {questionIndex + 1} / {questions.length}</div>
          <nav aria-label={t("Điều hướng câu hỏi")} className="quiz-question-nav -mx-1 flex gap-1 overflow-x-auto px-1 py-1 sm:flex-wrap">
            {questions.map((question, index) => {
              const isAnswered = Boolean(answers[question.id]?.trim());
              return <button key={question.id} type="button" aria-current={index === questionIndex ? "step" : undefined} aria-label={`${t("Câu")} ${index + 1}: ${isAnswered ? t("Đã trả lời") : t("Chưa trả lời")}`} title={`${t("Câu")} ${index + 1}: ${isAnswered ? t("Đã trả lời") : t("Chưa trả lời")}`} onClick={() => moveToQuestion(index)} className={`quiz-question-nav-item flex size-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${isAnswered ? "border-b-4" : ""} ${index === questionIndex ? "border-brand bg-brand text-brand-foreground" : isAnswered ? "border-brand bg-surface-accent text-brand" : "border-line bg-surface text-content-muted hover:border-brand"}`}>{index + 1}</button>;
            })}
          </nav>
          {currentQuestion && <fieldset key={currentQuestion.id} id="current-question" tabIndex={-1} className="quiz-student-question rounded-2xl border border-line bg-surface p-4 outline-none sm:p-5">
            <legend className="quiz-student-legend px-2 font-semibold">{t("Câu hỏi")} <span className="font-normal text-content-muted">· {currentQuestion.points} {t("điểm")}</span></legend>
            <p className="whitespace-pre-wrap leading-7">{currentQuestion.prompt}</p>
            {currentQuestion.type === "choice" ? <div className="mt-4 space-y-2">{currentQuestion.options.map((option, optionIndex) => <label key={optionIndex} className={`quiz-student-option flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${answers[currentQuestion.id] === String(optionIndex) ? "border-brand bg-surface-accent" : "border-line bg-surface hover:bg-surface-subtle"}`}><input type="radio" name={currentQuestion.id} checked={answers[currentQuestion.id] === String(optionIndex)} onChange={() => setAnswer(currentQuestion.id, String(optionIndex))} className="mt-1" /><span>{option}</span></label>)}</div> : <Textarea value={answers[currentQuestion.id] ?? ""} onChange={(event) => setAnswer(currentQuestion.id, event.target.value)} rows={5} className="mt-4" placeholder={t("Nhập câu trả lời của bạn")} />}
          </fieldset>}
          <div className="flex flex-wrap justify-between gap-3"><Button type="button" variant="outline" disabled={questionIndex === 0} onClick={() => moveToQuestion(questionIndex - 1)}>{t("Câu trước")}</Button>{questionIndex < questions.length - 1 ? <Button type="button" onClick={() => moveToQuestion(questionIndex + 1)}>{t("Câu tiếp theo")}</Button> : <Button type="submit">{t("Nộp bài")}</Button>}</div>
        </form>;
}
