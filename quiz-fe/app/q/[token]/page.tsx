"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PromptView } from "@/components/prompt-view";
import type { JSONContent } from "@tiptap/core";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { Modal } from "@mantine/core";

type QuizQuestion = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; points: number };
type QuizInfo = { title: string; description: string; promptDocument: JSONContent; subject?: string | null; gradeLevel?: string | null };
type Attempt = { id: string; dueAt: string; submitted: boolean };
type SavedState = { attemptId: string; resumeToken: string; answers: Record<string, string>; studentName?: string; studentClass?: string; finalized?: boolean };

export default function StudentQuizPage() {
  const t = useTranslation();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);

  const storageKey = useMemo(() => `quiz-attempt:${token}`, [token]);

  const loadAttempt = useCallback(async (state: SavedState) => {
    const response = await fetch(`/api/public/attempts/${state.attemptId}`, { headers: { "x-resume-token": state.resumeToken }, cache: "no-store" });
    if (!response.ok) throw new Error(t("Không thể khôi phục bài làm trên máy chủ."));
    const payload = await response.json();
    setQuiz({ title: payload.quiz.title, description: payload.quiz.description, subject: payload.quiz.subject, gradeLevel: payload.quiz.gradeLevel, promptDocument: payload.prompt ?? { type: "doc", content: [] } });
    setQuestions(payload.questions);
    setAnswers({ ...payload.answers, ...state.answers });
    setAttempt(payload.attempt);
    setSaved(state);
    setName(state.studentName ?? "");
    setClassName(state.studentClass ?? "");
    setDone(payload.attempt.submitted);
    setPending(Boolean(state.finalized && !payload.attempt.submitted));
    if (payload.attempt.submitted) return;
    const deadline = new Date(payload.attempt.dueAt).getTime();
    setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
  }, [t]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const local = localStorage.getItem(storageKey);
        if (local) {
          try { await loadAttempt(JSON.parse(local) as SavedState); return; }
          catch { localStorage.removeItem(storageKey); }
        }
        const response = await fetch(`/api/public/quizzes/${token}`, { cache: "no-store" });
        if (!response.ok) throw new Error(t("Link quiz đã hết hạn hoặc không tồn tại."));
        const payload = await response.json();
        if (!active) return;
        setQuiz(payload.quiz);
        setQuestions(payload.questions);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : t("Không tải được quiz."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadAttempt, storageKey, token]);

  const submit = useCallback(async (finalAnswers: Record<string, string>) => {
    if (!saved || done) return;
    setDone(true);
    setPending(true);
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, answers: finalAnswers, finalized: true }));
    const body = JSON.stringify({ answers: finalAnswers });
    try {
      const response = await fetch(`/api/public/attempts/${saved.attemptId}/submit`, {
        method: "POST", headers: { "content-type": "application/json", "x-resume-token": saved.resumeToken }, body,
      });
      if (response.ok || response.status === 409) {
        setError("");
        setPending(false);
        return;
      }
      setError(t("Bài đã được chốt trên thiết bị. Sẽ gửi khi có kết nối mạng."));
    } catch {
      setError(t("Bài đã được chốt trên thiết bị. Sẽ gửi khi có kết nối mạng."));
    }
  }, [done, saved, storageKey, t]);

  useEffect(() => {
    if (!attempt || done) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((new Date(attempt.dueAt).getTime() - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0) void submit(answers);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [answers, attempt, done, submit]);

  useEffect(() => {
    if (!saved || done) return;
    localStorage.setItem(storageKey, JSON.stringify({ ...saved, answers }));
    const sync = () => {
      void fetch(`/api/public/attempts/${saved.attemptId}/answers`, {
        method: "PUT", headers: { "content-type": "application/json", "x-resume-token": saved.resumeToken }, body: JSON.stringify({ answers }),
      }).catch(() => undefined);
    };
    const interval = window.setInterval(sync, 5000);
    window.addEventListener("online", sync);
    return () => { window.clearInterval(interval); window.removeEventListener("online", sync); };
  }, [answers, done, saved, storageKey]);

  useEffect(() => {
    if (!saved || !pending) return;
    const retry = () => {
      const local = localStorage.getItem(storageKey);
      if (!local) return;
      const state = JSON.parse(local) as SavedState;
      if (state.finalized && state.answers && state.attemptId === saved.attemptId) {
        void fetch(`/api/public/attempts/${saved.attemptId}/submit`, {
          method: "POST", headers: { "content-type": "application/json", "x-resume-token": saved.resumeToken }, body: JSON.stringify({ answers: state.answers }),
        }).then((response) => {
          if (response.ok || response.status === 409) { setPending(false); setError(""); }
        }).catch(() => undefined);
      }
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [pending, saved, storageKey]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/public/quizzes/${token}/start`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, className }),
      });
      if (response.status === 409) throw new Error(t("Tên và lớp này đã có lượt làm cho quiz."));
      if (!response.ok) throw new Error(t("Không thể bắt đầu quiz. Hãy kiểm tra link và kết nối mạng."));
      const payload = await response.json();
      const state: SavedState = { attemptId: payload.attempt.id, resumeToken: payload.resumeToken, answers: {}, studentName: name, studentClass: className };
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSaved(state);
      setAttempt({ ...payload.attempt, submitted: false });
      setQuiz({ title: payload.quiz.title, description: "", promptDocument: payload.quiz.prompt ?? { type: "doc", content: [] } });
      setQuestions(payload.questions);
      setSeconds(Math.max(0, Math.ceil((new Date(payload.attempt.dueAt).getTime() - Date.now()) / 1000)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Không thể bắt đầu quiz."));
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  if (loading) return <main className="mx-auto max-w-3xl p-8 text-content-muted">{t("Đang tải bài quiz…")}</main>;
  const hasPrompt = Boolean(attempt && (quiz?.promptDocument?.content?.length));
  const answered = questions.filter((question) => Boolean(answers[question.id]?.trim())).length;
  const remaining = questions.length - answered;
  const currentQuestion = questions[Math.min(questionIndex, Math.max(questions.length - 1, 0))];
  function moveToQuestion(index: number) {
    setQuestionIndex(index);
    requestAnimationFrame(() => document.getElementById("current-question")?.focus());
  }
  return (
    <main className={`quiz-student mx-auto px-4 py-8 sm:px-6 sm:py-12 ${hasPrompt ? "max-w-[1320px]" : "max-w-3xl"} ${!attempt ? "flex min-h-dvh flex-col justify-center" : ""}`}>
      {attempt && !done && <div className="quiz-student-status sticky top-3 z-10 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-sm"><span className="text-sm font-semibold text-content-muted">{t("Đã trả lời")} <strong className="ml-1 rounded-full bg-surface-accent px-2.5 py-1 text-brand">{answered}/{questions.length}</strong></span><span className={`rounded-full px-3 py-1 font-bold ${seconds <= 300 ? "ds-warning" : "bg-surface-accent text-brand"}`} aria-live={seconds <= 300 ? "polite" : "off"}>{t("Còn")} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span></div>}
      <div className={hasPrompt ? "grid gap-5 lg:grid-cols-2 lg:items-start" : ""}>
      {hasPrompt && <><details className="quiz-student-prompt rounded-2xl border border-line bg-surface p-5 lg:hidden"><summary className="cursor-pointer font-bold text-brand">{t("Đề bài")}</summary>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</details><Card className="hidden rounded-3xl p-6 sm:p-9 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"><h2 className="text-xl font-bold">{t("Đề bài")}</h2>{quiz?.promptDocument && <PromptView document={quiz.promptDocument} />}</Card></>}
      <Card className="quiz-student-main rounded-3xl p-5 sm:p-8">
        <p className="text-sm font-semibold text-brand">{t("BÀI QUIZ")}</p>
        <h1 className="mt-2 text-3xl font-bold">{quiz?.title ?? t("Không mở được quiz")}</h1>
        {(quiz?.subject || quiz?.gradeLevel) && <div className="mt-4 flex flex-wrap gap-2">{quiz?.subject && <span className="quiz-student-chip">{t("Môn học")}: {quiz.subject}</span>}{quiz?.gradeLevel && <span className="quiz-student-chip">{t("Khối lớp")}: {quiz.gradeLevel}</span>}</div>}
        {quiz?.description && <p className="mt-3 whitespace-pre-wrap text-content-muted">{quiz.description}</p>}
        {attempt && error && <p role="alert" className="mt-5 rounded-xl ds-warning px-4 py-3 text-sm">{error}</p>}
        {!attempt && quiz && <form onSubmit={start} className="quiz-student-entry mt-7 rounded-2xl border border-line bg-surface-subtle p-5 sm:p-7">
          <h2 className="text-lg font-bold">{t("Thông tin học sinh")}</h2>
          <p className="mt-1 text-sm text-content-muted">{t("Nhập tên và lớp để bắt đầu làm bài.")}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">{t("Họ và tên")}<Input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 bg-surface" /></label>
            <label className="block text-sm font-semibold">{t("Lớp")}<Input required autoComplete="off" value={className} onChange={(event) => setClassName(event.target.value)} className="mt-2 bg-surface" /></label>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl ds-warning px-4 py-3 text-sm">{error}</p>}
          <Button type="submit" disabled={busy} className="mt-5 w-full sm:w-auto">{busy ? t("Đang bắt đầu…") : t("Bắt đầu làm bài")}</Button>
        </form>}
        {!attempt && !quiz && error && <p role="alert" className="mt-5 rounded-xl ds-warning px-4 py-3 text-sm">{error}</p>}
        {attempt && done && <p className={`mt-7 rounded-2xl p-5 font-semibold ${pending ? "ds-warning" : "ds-success"}`}>{pending ? t("Bài làm đã được chốt trên thiết bị và sẽ gửi khi có kết nối mạng.") : t("Bài làm đã được chốt. Cảm ơn bạn!")}</p>}
        {attempt && !done && <form onSubmit={(event) => { event.preventDefault(); setConfirmSubmit(true); }} className="mt-8 space-y-5">
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
        </form>}
      </Card></div>
      <Modal opened={confirmSubmit && !done} onClose={() => setConfirmSubmit(false)} title={t("Xác nhận nộp bài")} centered><p className="text-content-muted">{remaining > 0 ? `${t("Còn")} ${remaining} ${t("câu chưa trả lời")}.` : t("Bạn đã trả lời tất cả câu hỏi.")}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => setConfirmSubmit(false)}>{t("Tiếp tục làm bài")}</Button><Button type="button" onClick={() => { setConfirmSubmit(false); void submit(answers); }}>{t("Nộp bài")}</Button></div></Modal>
    </main>
  );
}
