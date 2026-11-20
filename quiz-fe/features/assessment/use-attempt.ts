import { useErrorToast } from "@/components/ui/toast";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { JSONContent } from "@tiptap/core";

export type QuizQuestion = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; points: number };
export type QuizInfo = { title: string; description: string; promptDocument: JSONContent; subject?: string | null; gradeLevel?: string | null; assignedClass?: string | null };
type Attempt = { id: string; dueAt: string; submitted: boolean; variantCode?: number };
type SavedState = { attemptId: string; resumeToken: string; answers: Record<string, string>; studentName?: string; studentClass?: string; finalized?: boolean };

export function useAttempt() {
  const t = useTranslation();
  const showError = useErrorToast();
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
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const saveFailure = useRef(false);
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
          catch {
            if (active) showError(t("Không thể khôi phục bài làm trên máy chủ."));
            localStorage.removeItem(storageKey);
          }
        }
        const response = await fetch(`/api/public/quizzes/${token}`, { cache: "no-store" });
        if (!response.ok) throw new Error(t("Link bài kiểm tra đã hết hạn hoặc không tồn tại."));
        const payload = await response.json();
        if (!active) return;
        setQuiz(payload.quiz);
        setQuestions(payload.questions);
      } catch (reason) {
        if (active) showError(reason instanceof Error ? reason.message : t("Không tải được bài kiểm tra."));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadAttempt, storageKey, token, showError, t]);

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
        setPending(false);
        return;
      }
      showError(t("Bài sẽ được gửi khi có kết nối mạng."));
    } catch {
      showError(t("Bài sẽ được gửi khi có kết nối mạng."));
    }
  }, [done, saved, storageKey, t, showError]);

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
      const reportFailure = () => {
        if (!saveFailure.current) showError(t("Không đồng bộ được câu trả lời với máy chủ."));
        saveFailure.current = true;
      };
      void fetch(`/api/public/attempts/${saved.attemptId}/answers`, {
        method: "PUT", headers: { "content-type": "application/json", "x-resume-token": saved.resumeToken }, body: JSON.stringify({ answers }),
      }).then((response) => {
        if (response.ok) saveFailure.current = false;
        else if (response.status !== 409) reportFailure();
      }).catch(reportFailure);
    };
    const interval = window.setInterval(sync, 5000);
    window.addEventListener("online", sync);
    return () => { window.clearInterval(interval); window.removeEventListener("online", sync); };
  }, [answers, done, saved, storageKey, showError, t]);

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
          if (response.ok || response.status === 409) { setPending(false); }
        }).catch(() => undefined);
      }
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [pending, saved, storageKey]);

  const [unlisted, setUnlisted] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const receiptKey = "quiz-access:" + token;
  const requestedNameKey = receiptKey + ":name";

  useEffect(() => {
    const receipt = localStorage.getItem(receiptKey);
    if (!receipt) return;
    setName(localStorage.getItem(requestedNameKey) ?? "");
    fetch(`/api/public/quizzes/${token}/access-request`, { headers: { "x-request-receipt": receipt }, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); setRequestStatus((await response.json()).status); })
      .catch(() => showError(t("Không tải được trạng thái yêu cầu.")));
  }, [receiptKey, requestedNameKey, token, showError, t]);

  useEffect(() => { if (quiz?.title) document.title = quiz.title; }, [quiz?.title]);

  async function requestAccess(check: boolean) {
    setBusy(true);
    try {
      const receipt = localStorage.getItem(receiptKey) ?? "";
      const response = await fetch(`/api/public/quizzes/${token}/${check ? "access-request" : "access-requests"}`, check
        ? { headers: { "x-request-receipt": receipt }, cache: "no-store" }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error === "request_exists" ? t("Yêu cầu cho họ tên này đã được gửi.") : data.error === "can_start" ? t("Em có thể thử bắt đầu làm bài.") : t("Không thể xử lý yêu cầu làm bài."));
      }
      const data = await response.json();
      if (data.receipt) {
        localStorage.setItem(receiptKey, data.receipt);
        localStorage.setItem(requestedNameKey, name);
      }
      setRequestStatus(data.status);
      setUnlisted(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : t("Không thể xử lý yêu cầu làm bài."));
    } finally { setBusy(false); }
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/public/quizzes/${token}/start`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(quiz?.assignedClass ? { name } : { name, className }),
      });
      if (response.status === 403) {
        setUnlisted(true);
        showError(t("Họ tên của em chưa có trong danh sách lớp. Hãy kiểm tra lại hoặc gửi yêu cầu để giáo viên duyệt."));
        return;
      }
      if (response.status === 409) throw new Error(t("Tên và lớp này đã có lượt làm cho bài kiểm tra."));
      if (!response.ok) throw new Error(t("Không thể bắt đầu bài kiểm tra. Hãy kiểm tra link và kết nối mạng."));
      const payload = await response.json();
      const state: SavedState = { attemptId: payload.attempt.id, resumeToken: payload.resumeToken, answers: {}, studentName: name, studentClass: quiz?.assignedClass ?? className };
      localStorage.setItem(storageKey, JSON.stringify(state));
      setSaved(state);
      setAttempt({ ...payload.attempt, submitted: false });
      setQuiz({ title: payload.quiz.title, description: "", promptDocument: payload.quiz.prompt ?? { type: "doc", content: [] } });
      setQuestions(payload.questions);
      setSeconds(Math.max(0, Math.ceil((new Date(payload.attempt.dueAt).getTime() - Date.now()) / 1000)));
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : t("Không thể bắt đầu bài kiểm tra."));
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  return { quiz, questions, attempt, name, setName, className, setClassName, answers, seconds, loading, busy, done, pending, unlisted, setUnlisted, requestStatus, requestAccess, start, setAnswer, submit };
}
