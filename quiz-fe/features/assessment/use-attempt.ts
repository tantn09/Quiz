import { useErrorToast } from "@/components/ui/toast";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import type { JSONContent } from "@tiptap/core";

export type QuizQuestion = { id: string; position: number; type: "choice" | "essay"; prompt: string; options: string[]; points: number };
export type QuizInfo = { title: string; description: string; promptDocument?: JSONContent; subject?: string | null; gradeLevel?: string | null; assignedClass?: string | null };
type Attempt = { id: string; dueAt: string; submitted: boolean; variantCode?: number };
type SavedState = { attemptId: string; resumeToken: string; answers: Record<string, string>; studentName?: string; studentClass?: string; finalized?: boolean };

const retryDelays = [2000, 5000, 10000];

function readStorage(key: string) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function saveAttempt(key: string, state: SavedState) {
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch { return false; }
}

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [finalized, setFinalized] = useState<SavedState | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<"sending" | "waiting" | "retry" | "failed" | "sent">("waiting");
  const [persisted, setPersisted] = useState(true);
  const retrySubmissionRef = useRef<() => void>(() => {});

  const latestAnswers = useRef<Record<string, string>>({});
  const activeSave = useRef<string | null>(null);
  const finalizedRef = useRef(false);
  const acknowledged = useRef<Record<string, string>>({});
  const saveFailure = useRef(false);
  const storageKey = useMemo(() => `quiz-attempt:${token}`, [token]);

  const loadAttempt = useCallback(async (state: SavedState, signal: AbortSignal) => {
    const response = await fetch(`/api/public/attempts/${state.attemptId}`, { headers: { "x-resume-token": state.resumeToken }, cache: "no-store", signal });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error(t("Không thể khôi phục bài làm trên máy chủ."));
    const payload = await response.json();
    if (signal.aborted) return;
    setQuiz({ title: payload.quiz.title, description: payload.quiz.description, subject: payload.quiz.subject, gradeLevel: payload.quiz.gradeLevel, promptDocument: payload.prompt ?? { type: "doc", content: [] } });
    setQuestions(payload.questions);
    acknowledged.current = payload.answers;
    latestAnswers.current = { ...payload.answers, ...state.answers };
    setAnswers(latestAnswers.current);
    setAttempt(payload.attempt);
    setSaved(state);
    setName(state.studentName ?? "");
    setClassName(state.studentClass ?? "");
    setDone(Boolean(payload.attempt.submitted || state.finalized));
    if (state.finalized && !payload.attempt.submitted && !finalizedRef.current) {
      finalizedRef.current = true;
      setFinalized(state);
    }
    return true;
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let retryOnReconnect = false;
    const initialize = async () => {
      retryOnReconnect = false;
      try {
        const local = readStorage(storageKey);
        if (local) {
          let state: SavedState | undefined;
          try { state = JSON.parse(local) as SavedState; }
          catch { /* Invalid local data cannot resume a saved attempt. */ }
          if (state && await loadAttempt(state, signal)) return;
          if (signal.aborted) return;
          showError(t("Không thể khôi phục bài làm trên máy chủ."));
          try { localStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
        }
        const response = await fetch(`/api/public/quizzes/${encodeURIComponent(token)}?view=entry`, { cache: "no-store", signal });
        if (!response.ok) throw new Error(t("Link bài kiểm tra đã hết hạn hoặc không tồn tại."));
        const payload = await response.json();
        if (signal.aborted) return;
        setQuiz(payload.quiz);
        setQuestions(payload.questions);
      } catch (reason) {
        if (!signal.aborted) {
          retryOnReconnect = true;
          showError(reason instanceof Error ? reason.message : t("Không tải được bài kiểm tra."));
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };
    const reconnect = () => { if (retryOnReconnect) void initialize(); };
    void initialize();
    window.addEventListener("online", reconnect);
    return () => {
      controller.abort();
      window.removeEventListener("online", reconnect);
    };
  }, [loadAttempt, storageKey, token, showError, t]);

  const submitLatest = useCallback(() => {
    if (!saved || done || finalizedRef.current) return;
    finalizedRef.current = true;
    const state = { ...saved, answers: latestAnswers.current, finalized: true };
    setPersisted(saveAttempt(storageKey, state));
    setDone(true);
    setFinalized(state);
  }, [done, saved, storageKey]);

  useEffect(() => {
    if (!saved || done || finalizedRef.current) return;
    saveAttempt(storageKey, { ...saved, answers });
  }, [answers, done, saved, storageKey]);

  useEffect(() => {
    if (!saved || done) return;
    let active = true;
    let closed = false;
    const sync = () => {
      if (closed || finalizedRef.current || activeSave.current === saved.attemptId || !navigator.onLine) return;
      const changes = Object.fromEntries(Object.entries(latestAnswers.current).filter(([id, value]) => acknowledged.current[id] !== value));
      if (!Object.keys(changes).length) return;
      activeSave.current = saved.attemptId;
      const reportFailure = () => {
        if (!active) return;
        if (!saveFailure.current) showError(t("Không đồng bộ được câu trả lời với máy chủ."));
        saveFailure.current = true;
      };
      void fetch(`/api/public/attempts/${saved.attemptId}/answers`, {
        method: "PUT", headers: { "content-type": "application/json", "x-resume-token": saved.resumeToken }, body: JSON.stringify({ answers: changes }),
      }).then((response) => {
        if (response.ok) {
          if (active) {
            Object.assign(acknowledged.current, changes);
            saveFailure.current = false;
          }
        } else if (response.status === 409) closed = true;
        else reportFailure();
      }).catch(reportFailure).finally(() => {
        if (activeSave.current === saved.attemptId) activeSave.current = null;
      });
    };
    const interval = window.setInterval(sync, 5000);
    window.addEventListener("online", sync);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("online", sync); };
  }, [done, saved, showError, t]);

  useEffect(() => {
    if (!finalized) return;
    const state = finalized;
    const controller = new AbortController();
    let timer: number | undefined;
    let retries = 0;
    let sending = false;
    let terminal = false;

    async function send() {
      if (sending || terminal || controller.signal.aborted) return;
      window.clearTimeout(timer);
      if (!navigator.onLine) { setSubmissionStatus("waiting"); return; }
      sending = true;
      setSubmissionStatus("sending");
      try {
        const response = await fetch(`/api/public/attempts/${state.attemptId}/submit`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-resume-token": state.resumeToken },
          body: JSON.stringify({ answers: state.answers }),
          signal: controller.signal,
        });
        const duplicate = response.status === 409 && (await response.json().catch(() => null))?.error === "already_submitted";
        if (controller.signal.aborted) return;
        if (response.ok || duplicate) {
          terminal = true;
          setSubmissionStatus("sent");
          return;
        }
        if (response.status < 500) {
          terminal = true;
          setSubmissionStatus("failed");
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        sending = false;
      }

      if (!navigator.onLine) { setSubmissionStatus("waiting"); return; }
      const delay = retryDelays[retries++];
      if (delay === undefined) { setSubmissionStatus("retry"); return; }
      setSubmissionStatus("waiting");
      timer = window.setTimeout(() => void send(), delay);
    }

    const retry = () => {
      if (sending || terminal) return;
      retries = 0;
      void send();
    };
    retrySubmissionRef.current = retry;
    window.addEventListener("online", retry);
    void send();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
      retrySubmissionRef.current = () => {};
    };
  }, [finalized]);

  const [unlisted, setUnlisted] = useState(false);
  const [requestStatus, setRequestStatus] = useState("");
  const receiptKey = "quiz-access:" + token;
  const requestedNameKey = receiptKey + ":name";

  useEffect(() => {
    const receipt = readStorage(receiptKey);
    if (!receipt) return;
    setName(readStorage(requestedNameKey) ?? "");
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
      setPersisted(saveAttempt(storageKey, state));
      setSaved(state);
      setAttempt({ ...payload.attempt, submitted: false });
      setQuiz({ title: payload.quiz.title, description: "", promptDocument: payload.quiz.prompt ?? { type: "doc", content: [] } });
      setQuestions(payload.questions);
    } catch (reason) {
      showError(reason instanceof Error ? reason.message : t("Không thể bắt đầu bài kiểm tra."));
    } finally {
      setBusy(false);
    }
  }

  function setAnswer(questionId: string, value: string) {
    latestAnswers.current = { ...latestAnswers.current, [questionId]: value };
    setAnswers(latestAnswers.current);
  }

  return { quiz, questions, attempt, name, setName, className, setClassName, answers, loading, busy, done, submissionStatus: finalized ? submissionStatus : "sent", persisted, retrySubmission: () => retrySubmissionRef.current(), unlisted, setUnlisted, requestStatus, requestAccess, start, setAnswer, submitLatest };
}
